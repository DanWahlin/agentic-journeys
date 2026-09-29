# Superset Infrastructure Gate

Generate `scripts/check-infra-superset.mjs` at the repository root **before** `infra-superset/` exists. It turns this skill's rules, and the deployment failures that earlier runs of the Superset journey hit, into checks with a deterministic exit code. Running it before the infrastructure exists must fail.

Every rule below cost a failed `azd up` in a validation run, and `azd provision --preview` caught none of them.

## Portability

Resolve paths relative to the repository root (the parent of the script's `scripts/` folder). Use only the Node.js standard library. Invoke CLIs with argument arrays and `shell: false`. On Windows, run CLI shims such as `az` and `azd` through the PowerShell JSON-payload launcher pattern from `.github/scripts/_utils.mjs`, copied into the script rather than imported. Run Node.js itself with `process.execPath`.

## Checks

Print one `PASS` or `FAIL` line per check with a short reason, then exit `1` if any check failed:

1. **Files:** `azure.yaml`, `infra-superset/main.bicep`, and `infra-superset/hooks/postprovision.js` exist, and `infra-superset/` contains at least one Kubernetes manifest (`.yaml` or `.yml`) with `kind: Ingress`.
2. **azure.yaml:** `infra.path` is `infra-superset`, `hooks.postprovision.run` points to the `.js` hook, and there is no `shell: sh`.
3. **Hook:** `node --check` passes, and the source:
   - contains no `curl`, `grep`, or `shell: true`, and never starts `kubectl` or `helm` as a local process (they run inside Azure through `az aks command invoke`);
   - never passes `--no-wait` to `az aks command invoke`, whose asynchronous output is plain text the hook can't parse;
   - gives each attached file its own `--file` argument, whose value ends in `.yaml`, `.yml`, or `.json`, not a directory;
   - sets `azure-load-balancer-health-probe-request-path` to `/healthz` inside a double-quoted `--set-string "..."` value. Unquoted, the remote shell strips the backslashes, the load balancer probes `/` and gets a 404, and every public request times out;
   - waits for the `ingress-nginx-controller` deployment (`kubectl rollout status` or `kubectl wait`) before the command that applies the Ingress manifest. Helm returns before the admission webhook has an endpoint, so applying the Ingress right away fails;
   - generates `SUPERSET_SECRET_KEY` and `SUPERSET_ADMIN_PASSWORD` with `crypto` when they're missing and saves them with `azd env set`.
4. **Build:** `az bicep build --file infra-superset/main.bicep --stdout` exits `0` and prints valid JSON. Ignore the "a new Bicep release is available" notice.
5. **Lint:** `az bicep lint --file infra-superset/main.bicep` reports no errors.
6. **Contract rules** on the compiled JSON. Walk the whole tree, including nested module templates. Evaluate literal values and `{ "value": ... }` parameter assignments, and ignore parameter declarations (objects with a `type` key); for a parameter referenced by a property, use its `defaultValue`. For ARM expressions (strings that start with `[`), search for the required literal inside the expression. Only deployable resource properties count, except where a rule names outputs:
   - The `Microsoft.ContainerService/managedClusters` agent pool `count` is at least `2`. On one node, Superset and NGINX leave no room for the run-command pod, and `az aks command invoke` fails with `invalid status 'OK'`.
   - Every agent pool `availabilityZones` value is empty or absent, and `disableLocalAccounts` is `false` where it's a literal.
   - `Microsoft.DBforPostgreSQL/flexibleServers` uses API version `2024-08-01` or later, and has no `availabilityZone` property with a value. Zone `1` isn't available for every subscription in `westus`.
   - A `Microsoft.ContainerRegistry/registries` resource, if present, doesn't combine `exportPolicy.status: 'disabled'` with `publicNetworkAccess: 'Enabled'`.
   - The top-level outputs include a resource group name (`AZURE_RESOURCE_GROUP`, `AZURE_RESOURCE_GROUP_NAME`, or `RESOURCE_GROUP_NAME`) and a cluster name (`AZURE_AKS_CLUSTER_NAME` or `AKS_CLUSTER_NAME`), which the journey verifier reads.
7. **Preview** (skipped with `--offline`): Confirm that `AZURE_SUBSCRIPTION_ID` and `AZURE_LOCATION` are set in the selected `azd` environment, then run `azd provision --preview --no-prompt` and require exit `0`.

The script never prints secrets.

## Gate

`node scripts/check-infra-superset.mjs --offline` must pass before the preview, and `node scripts/check-infra-superset.mjs` must pass before `azd up`. Don't change the script to get past a failure; change the infrastructure.
