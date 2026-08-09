# SmartTodo Phase 3: Azure Deployment

Deploy the completed application from the first two phases to Azure Functions Flex Consumption. Read [`PLAN.md`](./PLAN.md) first and treat the application behavior in [`PLAN-phase1-api.md`](./PLAN-phase1-api.md) and [`PLAN-phase2-ios.md`](./PLAN-phase2-ios.md) as fixed contracts.

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## Azure Deployment

Deploy the API to Azure Functions **Flex Consumption** plan — a serverless, scale-to-zero hosting plan with per-function scaling, virtual network support, and configurable instance memory sizes. See [Flex Consumption plan docs](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan) for details.

### Azure Resources

Prefer AVM modules for consistency. If an AVM module blocks deployment because of parameter drift, unsupported passthrough, or schema mismatch, switch that single resource to a raw `Microsoft.*` Bicep resource and document why.

Required resources: Function App on Flex Consumption, App Service Plan (`FC1`), Azure SQL Server + Database, Microsoft Foundry/Azure OpenAI with `gpt-5-mini`, Storage Account, Log Analytics, and Application Insights.

| Resource | Module / Approach |
|----------|-------------------|
| Function App | `br/public:avm/res/web/site` (`kind: functionapp,linux`) |
| App Service Plan | `br/public:avm/res/web/serverfarm` (Flex Consumption SKU: `FC1`) |
| Azure SQL Server | `br/public:avm/res/sql/server`; database as a child resource (Basic, `zoneRedundant: false`, `maxSizeBytes` 2 GB) |
| Microsoft Foundry | `br/public:avm/ptn/ai-ml/ai-foundry` (gpt-5-mini deployment) |
| Monitoring | `br/public:avm/ptn/azd/monitoring` |
| Storage Account | `br/public:avm/res/storage/storage-account` |

### azure.yaml

The `language` field should match the learner's chosen stack:

```yaml
name: smart-todo
metadata:
  template: smart-todo@0.0.1
services:
  api:
    project: ./src/api
    host: function
    language: ts   # Use: ts, python, csharp, java
infra:
  provider: bicep
  path: ./infra
hooks:
  postprovision:
    run: ./infra/hooks/postprovision.js
```

Single service only — no `web` service. The iOS app runs on device, not in Azure.

### Flex Consumption Configuration

- **Instance memory size:** 2048 MB (default, suitable for most API workloads)
- **Per-function scaling:** Enabled automatically — each function (getTodos, generateSteps, etc.) scales independently
- **Always ready instances:** Optional — set to 1 for the HTTP trigger group to eliminate cold starts during demos

### Bicep Requirements

- Prefer AVM modules, but allow raw `Microsoft.*` resources when AVM blocks deployment
- System-assigned managed identity on the Function App
- AI access: default path uses `AZURE_AI_KEY` with the plain `openai` SDK. Add `Cognitive Services User` only if you later switch to managed identity for AI.
- Role assignment: `Storage Blob Data Owner` (`b7e6dc6d-f1e8-4753-8033-0f276bb0955b`) for Function App identity → Storage Account (required for Flex Consumption deployment)
- Role assignment: `Storage Blob Data Contributor` (`ba92f5b4-2d11-453d-a403-e96b0029c9fe`) for the deploying user → Storage Account (required for `azd deploy` to upload the zip package)
- Azure SQL: set the deploying user as Microsoft Entra admin, add a firewall rule named `AllowAzureServices` with `0.0.0.0` start/end addresses, then create a database user for the Function App identity in post-provision. Do not generate names containing Azure reserved words such as `WINDOWS`.
- Azure SQL Database: set `maxSizeBytes: 2147483648` (2 GB) when using Basic tier (default 32 GB exceeds the limit)
- **Azure SQL Database: set `zoneRedundant: false`** — Basic tier does not support zone redundancy. AVM module may default to true, causing "ProvisioningDisabled: Provisioning of zone redundant database/pool is not supported."
- Microsoft Foundry: use `br/public:avm/ptn/ai-ml/ai-foundry` with `baseName` (max 12 chars), `aiModelDeployments` array for gpt-5-mini, `aiFoundryConfiguration.disableLocalAuth: false`, and system-assigned managed identity
- If AVM parameter drift requires raw `Microsoft.CognitiveServices` resources, create the account first and deploy the model from a separate nested Bicep module that receives the created account name. Do not issue the account and model child operations concurrently; Azure can reject the child with `RequestConflict` while the parent is non-terminal.
- **AI model version is region-specific** — use `az cognitiveservices model list --location <region> --query "[?model.name=='gpt-5-mini']"` to find the correct version before generating Bicep. For example, `westus` requires `2025-08-07` (not `2025-02-27`).
- Outputs in SCREAMING_SNAKE_CASE: `API_URL`, `SQL_SERVER_NAME`, `SQL_DATABASE_NAME`, `FUNCTION_APP_NAME`, `AZURE_AI_ENDPOINT`, `AZURE_AI_DEPLOYMENT`, `RESOURCE_GROUP_NAME`
- Module parameters derived from `uniqueString()` must declare explicit `@minLength(13)`/`@maxLength(13)` constraints so the build emits no BCP334 warnings
- `azd-service-name: 'api'` tag on the Function App
- Function App settings: `AZURE_AI_ENDPOINT`, `AZURE_AI_DEPLOYMENT`, `AZURE_AI_KEY`, `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`. `AZURE_SQL_SERVER` must be the SQL FQDN, not just the short server name.
- **Do NOT include `FUNCTIONS_WORKER_RUNTIME` in app settings** — Flex Consumption sets this via `functionAppConfig.runtime`, and having it in app settings causes a deployment error
- **Set `siteConfig.alwaysOn` to `false`** — the AVM module defaults to `true`, which is invalid for Flex Consumption
- **Set Storage Account `networkAcls.defaultAction` to `Allow`** — the AVM module defaults to `Deny`, which blocks `azd deploy` zip uploads
- **Flex Consumption `deploymentpackage` container** — `azd deploy` uploads the zip to a blob container named `deploymentpackage`. This container may not exist after first provisioning. If `azd deploy` fails with "The specified container does not exist", create it with `az storage container create --name deploymentpackage --account-name <name> --auth-mode login` and retry.

### .NET-Specific Notes

- Use the `OpenAI` NuGet package for the `/openai/v1/` endpoint path.
- Do NOT add `Microsoft.Azure.Functions.Worker.ApplicationInsights` or `Microsoft.ApplicationInsights.WorkerService`; App Insights is wired through infrastructure.

### Post-Provision: Managed Identity SQL Access

Azure SQL requires a post-provision step to add the Function App's managed identity as a database user. Generate `infra/hooks/postprovision.js` and reference it directly as `hooks.postprovision` in `azure.yaml` without `shell: sh`. This repository requires Node.js LTS or later, `azd` 1.28.0+, Azure CLI, and the current Go-based `sqlcmd`; Windows, Mac, and Linux installation options are in [`../../docs/tool-installation.md`](../../docs/tool-installation.md).

Before provisioning, resolve and set the complete Entra administrator contract: `AZURE_PRINCIPAL_ID`, `AZURE_PRINCIPAL_LOGIN`, and `AZURE_PRINCIPAL_TYPE`. Interactive accounts use type `User`; non-interactive automation uses `ServicePrincipal`. Stop before Azure changes and report all missing values together.

The JavaScript hook must use argument arrays, not interpolated shell commands. On Mac and Linux, invoke executables directly. On Windows, use the static PowerShell JSON-payload launcher from the `container-apps-deployment` skill for Azure CLI shims rather than passing `.cmd` files directly to `execFileSync()` or `spawnSync()`. It must:

1. Fail before making Azure changes if `az`, `azd`, `node`, or `sqlcmd` is unavailable.
2. Read `SQL_SERVER_NAME`, `SQL_DATABASE_NAME`, `FUNCTION_APP_NAME`, and `RESOURCE_GROUP_NAME` through `azd env get-value`.
3. Normalize the SQL server to both its short name and `<name>.database.windows.net` FQDN in JavaScript.
4. Read the server's current Azure SQL connection policy. If it is `Redirect`, temporarily change it to `Proxy` so developer-host traffic stays on port 1433 instead of redirecting to ports 11000–11999.
5. Obtain the developer's public IP with Node.js HTTPS/fetch, create a uniquely named temporary SQL firewall rule, and register cleanup in a `finally` block.
6. Invoke `sqlcmd` with `--authentication-method ActiveDirectoryAzCli` to create the Function App managed-identity user and grant `db_datareader`, `db_datawriter`, and `db_ddladmin`. Escape SQL identifiers and string values before constructing the statement.
7. Invoke `sqlcmd` again with `-i infra/hooks/postprovision-schema.sql` to apply the idempotent schema and seed data.
8. In `finally`, delete the temporary firewall rule and restore the original SQL connection policy even if schema creation fails.
9. Print `Post-provision SQL setup complete.` only after every required step succeeds.

The hook must be idempotent and must never print secrets, connection strings, or firewall rule contents. Do not use shell traps, command substitution, `curl`, `grep`, or OS-specific path syntax in the generated hook.

### Database Schema Initialization

Also generate `infra/hooks/postprovision-schema.sql` with the CREATE TABLE statements from [Database Schema (SQL)](./PLAN-phase1-api.md#database-schema-sql) and the seed rows from [Seed Data](./PLAN-phase1-api.md#seed-data). Make it idempotent (`IF OBJECT_ID(...) IS NULL` around DDL; only insert seed rows when the Todos table is empty) so re-running the hook is safe. The post-provision hook runs it after the managed identity setup so the deployed API and iOS app return data immediately.

### Mobile Distribution

The iOS app is NOT deployed via azd. To test: replace the `Config.swift` `apiBaseURL` with the deployed URL (`azd env get-value API_URL`) and run from Xcode on the Simulator (⌘R). For physical devices, use the deployed URL with a development signing profile.

### Known Deployment Gotchas

1. **SQL/AI region limits:** If SQL provisioning or `gpt-5-mini` deployment fails, try `westus3`, `centralus`, or `southcentralus`; verify model version with `az cognitiveservices model list`.
2. **Post-provision SQL access:** The deploying user must be Microsoft Entra admin, and local SQL setup needs a temporary firewall rule for the developer IP. The portable hook must clean it up in `finally`.
3. **Azure SQL Redirect policy:** Clients outside Azure may be redirected from port 1433 to ports 11000–11999. If those ports are blocked, temporarily switch the server to `Proxy` during post-provision and restore its original policy afterward.
4. **Azure SQL DNS failures:** If logs show `getaddrinfo ENOTFOUND <sql-name>`, `AZURE_SQL_SERVER` is only the short name. Use `<sql-name>.database.windows.net`.
5. **Oryx TypeScript build fails:** Check `.funcignore`; do not exclude `src/` or `tsconfig.json`.
6. **Storage deploy failures:** For 403 or missing container errors, ensure Storage `networkAcls.defaultAction` is `Allow`, the deploying user has `Storage Blob Data Contributor`, and the `deploymentpackage` container exists.
7. **Simulator preflight busy:** If Xcode reports `Application failed preflight checks` or `SBMainWorkspace Busy`, terminate/uninstall the app from that simulator, reboot the simulator, then clean build and run again.

---

## Deployment Acceptance Criteria

Deployment is complete only when every required check passes: post-provision prints `Post-provision SQL setup complete.`, the checked-in verifier passes seed reads, create, AI generation, step completion, deletion, and final absence, and the iOS app can call the deployed HTTPS `API_URL`. The journey README owns the command that executes these deployment checks. After completing the README assignment, run `azd down --force --purge`.
