# AIMarket Phase 4: Azure Deployment

Deploy the completed application from the first three phases to Azure Container Apps. Read [`PLAN.md`](./PLAN.md) first and treat the application behavior in the earlier phase plans as fixed contracts.

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## Azure Deployment

Deploy the full stack to Azure Container Apps using Bicep and azd. Prefer AVM modules when the complete generated template passes Azure validation. Use the documented raw-resource fallback when AVM composition blocks validation.

> **📖 Read the [`container-apps-deployment` skill](../../.github/skills/container-apps-deployment/SKILL.md) before generating infrastructure.** It covers critical gotchas with ACR authentication, zone redundancy, azure.yaml configuration, and SPA frontend deployment that apply to this deployment.

### Azure Skills Plugin

The Azure Skills plugin for GitHub Copilot provides MCP tools and plugin skills for infrastructure generation and deployment. Install it with `/plugin install azure@azure-skills` (Copilot CLI) or the equivalent plugin install flow in your surface if not already installed.

| Tool / Skill | When to Use |
|------|-------------|
| `azure_bicep_schema` | Look up AVM module properties, required fields, and latest API versions |
| `azure_deploy_iac_guidance` | Get best practices for azd project structure and Container Apps configuration |
| `azure_deploy_plan` | Before `azd up` — validate deployment plan and check for misconfigurations |
| `azure_deploy_app_logs` | Post-deployment — fetch Log Analytics logs to troubleshoot startup errors |
| `azure-prepare` (skill) | Generate Bicep infrastructure, azure.yaml, and deployment configuration |
| `azure-validate` (skill) | Validate generated infrastructure before deployment |
| `azure-deploy` (skill) | Execute the deployment with azd |

### Containerization

- **API Dockerfile:** Multi-stage build for your language. Builder stage compiles, final stage runs production artifacts only. Include the native build toolchain in the builder stage when a dependency compiles native modules (for example, SQLite drivers). Include `.dockerignore` to exclude dependency directories and db files while keeping build configuration files the container build needs (for example, `tsconfig.json`).
- **Client Dockerfile:** Multi-stage `node:24-alpine` → `nginx:alpine`. Azure Container Registry builds the image as `linux/amd64`, so the Dockerfile must not require host-specific Buildx variables. Accept `VITE_API_URL` before `npm run build`. Serve with `nginx.conf` using `try_files` for SPA routing. **No `/api/` proxy block** — the frontend calls the API directly via `VITE_API_URL`.
- **`.dockerignore`:** Both directories must exclude dependency dirs, build output, `.env`, and Git metadata (`.git/`).

### Azure Resources

Prefer **Azure Verified Modules (AVM)** from `br/public:avm/...` when they keep the complete deployment graph small and Azure validation passes. Validate AVM modules incrementally in the complete template. If one AVM or the combined AVM graph blocks validation, replace the smallest coupled resource set that restores validation with raw `Microsoft.*` Bicep resources and document why. Do not require a one-resource fallback when several AVM modules form the failing deployment graph. For a resource that requires a key, such as Azure AI Search, use a deterministic `existing` resource reference with `dependsOn` on the AVM module before calling `listAdminKeys()`.

| Resource | Module / Approach | Purpose |
|----------|------------------|---------|
| Monitoring | `br/public:avm/ptn/azd/monitoring` | Log Analytics + Application Insights |
| Container Registry | `br/public:avm/res/container-registry/registry`; use Azure CLI authentication for pushes and managed identity for pulls | Docker images |
| Azure AI Search | `br/public:avm/res/search/search-service` (Basic SKU — required for semantic ranking) + `existing` ref for `listAdminKeys()` | Semantic product search |
| Container Apps Env | `br/public:avm/res/app/managed-environment` | Hosts API + frontend |
| Container Apps (×2) | `br/public:avm/res/app/container-app` | API + web |
| Microsoft Foundry | Prefer `br/public:avm/ptn/ai-ml/ai-foundry` only when its complete template passes preview and the application uses the project resources it creates. AIMarket needs only an `AIServices` account and model deployment, so raw `Microsoft.CognitiveServices/accounts` and `accounts/deployments` resources are the approved minimal fallback. | gpt-5-mini model hosting (fallback: gpt-5.4-mini). The API authenticates with managed identity. |

**Pattern for wiring secrets:** At subscription scope, `existing` resource references cannot use `dependsOn`, so `listAdminKeys()` calls can fail before a resource exists. Create a resource-group-scoped wrapper module for Azure AI Search, then use a deterministic `existing` reference with `dependsOn` to read its admin key. Do not extract a Foundry key or ACR admin credentials. Foundry uses managed identity, and container image pulls use each Container App's system-assigned identity with `AcrPull`.

#### AVM Validation and Raw Fallback

Use this sequence while generating the infrastructure:

1. Add AVM modules incrementally and run `az bicep build` plus a full `azd provision --preview --no-prompt` after each coupled resource group.
2. Inspect the compiled ARM template. Record the resource types and API versions that AVM modules add. An AVM module can add many conditional resource definitions that are not visible in the short Bicep wrapper.
3. If the complete preview fails but the reported resource passes an isolated preview, treat the failure as a template-composition problem. Do not report an account restriction without independent evidence.
4. Remove or replace the last AVM addition and rerun the complete preview. Start with repeated Container App modules and large pattern modules because they expand the deployment graph most.
5. If targeted replacement does not restore validation quickly, use one resource-group-scoped raw module for the coupled resources. The raw fallback must preserve naming, tags, managed identities, role assignments, probes, secrets, outputs, and cleanup behavior.

For the raw Foundry fallback, create an `AIServices` account with S0 SKU, system-assigned identity, public network access enabled, local authentication disabled only when all clients use managed identity, and a unique custom subdomain. Create the selected model as a child deployment with `GlobalStandard` SKU and a capacity supported by the subscription. Use current stable API versions that pass Bicep build and the full Azure preview.

Error `715-123420` can be attributed to `Microsoft.CognitiveServices/accounts` even when the isolated account and model template passes. In that case, reduce the full deployment graph as described above. Do not split Foundry into a separate deployment only to hide the error.

### Bicep Requirements

1. **Prefer AVM modules with full-template proof** - add them incrementally and keep them only when the complete preview passes. Fall back to the smallest raw `Microsoft.*` resource set that restores validation, and document the exact failing AVM combination.
2. **Deterministic naming** — all resources named with `${abbrs.xxx}${resourceToken}` so `existing` refs can resolve
3. **`azd-service-name` tags** on each Container App: `api` lets azd map its declared service, while `web` lets the postdeploy hook discover the storefront Container App. The web app serves on port 80 but is not declared as an azd service.
4. **Output `AZURE_CONTAINER_REGISTRY_ENDPOINT`** (azd reads this for image push)
5. **Wire Azure AI Search credentials** into API container secrets using `listAdminKeys()`. Configure Foundry with `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT`; do not inject a Foundry API key into the deployed app.
6. **Azure AI Search** — use `basic` SKU (not `free`), set `disableLocalAuth: false`, and set `semanticSearch: 'free'` to enable the semantic ranker
7. **Microsoft Foundry** - use `br/public:avm/ptn/ai-ml/ai-foundry` only when AIMarket needs its project resources and the complete preview passes. Otherwise, use the approved raw `AIServices` account and child model deployment. Enable system-assigned managed identity on both the AI Services account and API container app.
8. **Managed identity for Foundry** — assign the `Cognitive Services User` role (`a97b65f3-24c7-4388-baec-2e87135dc908`) from the API container app's managed identity to the AI Services resource. This allows the API to authenticate to Microsoft Foundry without API keys.
9. **Container App startup probe** — `failureThreshold` max is 10 (not 30) when using the AVM container-app module. The API app's probes target `GET /api/health`.
10. **Container Registry** — Basic tier. **Container Apps Environment** — set `zoneRedundant: false` (required in many regions, e.g. westus).
11. **Soft-deleted Cognitive Services** — if a previous deployment fails or is torn down, the AI Services resource may be soft-deleted and block re-creation. Run `az cognitiveservices account list-deleted` and `az cognitiveservices account purge` before redeploying
12. **AI model version is region-specific** — use `az cognitiveservices model list --location <region> --query "[?model.name=='gpt-5-mini' || model.name=='gpt-5.4-mini']"` to find the correct version before generating Bicep
13. **ACR pull authentication** - create each Container App once with a public placeholder image and system-assigned identity, but no `configuration.registries` entry. Grant that principal `AcrPull` in Bicep. Then use the required `postprovision` JavaScript hook to run `az containerapp registry set --identity system` before the first private-image deployment. This is the AIMarket-specific two-phase pattern. It avoids a second pair of large Container App AVM deployments. Verify the registry configuration instead of assuming azd added it.
14. **Placeholder compatibility** — the public placeholder must listen on the configured ingress and probe port and return HTTP 200 for the probe path. For the default Node.js deployment, configure both the placeholder and deployed API on port 80 while retaining `GET /api/health`.
15. **Compiled template review** - reject unexpected preview or future API versions, unrelated resource families, and duplicate resource declarations unless the selected AVM requires them and the full preview passes.

### Deployment

1. Read the subscription with `az account show --query id -o tsv`, set `AZURE_SUBSCRIPTION_ID` to that value, then run `azd up`.
2. **API cloud build:** Configure the API service in `azure.yaml` with `docker.remoteBuild: true` and `platform: linux/amd64`. Do not declare the web Container App as an azd build service; Bicep provisions it with a public placeholder image until the postdeploy hook runs.
3. **Required lifecycle hooks:** Generate `infra/hooks/postprovision.js` and `infra/hooks/postdeploy.js`, and reference both directly from `azure.yaml` without `shell: sh`. The postprovision hook must configure managed-identity ACR access for both Container Apps and verify it. The postdeploy hook must invoke `az acr build` with argument arrays to build the web image in Azure with `VITE_API_URL=<API_URL>/api` and `--platform linux/amd64`, then update the web Container App. Treat a revision using the expected image as ready when it is healthy and provisioned with a running state of either `Running` or `ScaledToZero`; `minReplicas: 0` makes scale-to-zero an expected healthy state. First-time success must not require Docker or a manual rebuild on the host.
4. **All host architectures:** Build both deployment images in Azure Container Registry. Do not require Docker, Buildx, emulation, or privileged binfmt/QEMU handlers on the host.
5. To replace SQLite, first implement the corresponding repository, provision the chosen cloud database, and configure its credentials. Then set `DATA_PROVIDER=cosmos` or `DATA_PROVIDER=postgres`.

### Deployment Acceptance Criteria

Deployment is complete only when every required check passes: `/api/health`, exactly 10 products, successful product images, non-empty semantic search, an assistant-shaped response to a product-comparison prompt that mentions **UltraBook Pro 15**, storefront HTTP 200, and the production API host in the built frontend assets. Use a comparison prompt rather than only a simple lookup so verification catches GPT-5 reasoning budgets that can be exhausted before visible content is produced. The journey README owns the command that executes these deployment checks. After completing the README assignment, run `azd down --force --purge`.
