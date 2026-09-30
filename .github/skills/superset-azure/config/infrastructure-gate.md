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
   - sets `azure-load-balancer-health-probe-request-path` to `/healthz`, with each dot of the annotation key escaped for the remote shell (a doubled backslash, `\\.`, in the command string). With a single backslash, the remote shell strips it, the load balancer probes `/` and gets a 404, and every public request times out. Accept a double-quoted value too, but don't require one;
   - builds every string it passes to `az aks command invoke --command` without `"`, `&`, `|`, `<`, `>`, `^`, `%`, or `!`, because the Windows launcher rejects them: steps are chained with `; ` after `set -e`, not `&&`;
   - waits for the `ingress-nginx-controller` deployment (`kubectl rollout status` or `kubectl wait`) before the command that applies the Ingress manifest. Helm returns before the admission webhook has an endpoint, so applying the Ingress right away fails;
   - generates `SUPERSET_SECRET_KEY` and `SUPERSET_ADMIN_PASSWORD` with `crypto` when they're missing and saves them with `azd env set`.
   - applies every attached manifest by the base name of the file it attaches: `az aks command invoke --file` keeps only the base name, so a randomly named temporary file must be applied by that random name, or created with a fixed name inside a random directory.
   - supports `--dry-run`: it prints the repository root it resolved and `DRY RUN`, then exits `0` without calling `az` or `azd`. Run it with `process.execPath` and require the printed root to contain `azure.yaml`. A hook that resolved the root one folder too high ran its `azd` commands in the wrong place, and its only error was `azd failed (1)`.
4. **Build:** `az bicep build --file infra-superset/main.bicep --stdout` exits `0` and prints valid JSON. Ignore the "a new Bicep release is available" notice.
5. **Lint:** `az bicep lint --file infra-superset/main.bicep` reports no errors.
6. **Manifests:** every Superset container that imports `psycopg2` declares `PYTHONPATH` in its `env:` list. An `export PYTHONPATH=...` in the start command isn't enough: `kubectl exec` starts a new process that only sees declared env vars.
7. **Contract rules** on the compiled JSON. Walk the whole tree, including nested module templates. Evaluate literal values and `{ "value": ... }` parameter assignments, and ignore parameter declarations (objects with a `type` key). Resolve parameters across module boundaries: inside a nested template, `parameters('name')` takes the value the parent deployment passes for `name`, or else that parameter's `defaultValue`. AVM modules receive their settings this way. For ARM expressions (strings that start with `[`), search for the required literal inside the expression. Only deployable resource properties count, except where a rule names outputs:
   - The `Microsoft.ContainerService/managedClusters` agent pool `count` is at least `2`. On one node, Superset and NGINX leave no room for the run-command pod, and `az aks command invoke` fails with `invalid status 'OK'`.
   - Every agent pool `availabilityZones` value is empty or absent, and `disableLocalAccounts` is `false` where it's a literal.
   - `Microsoft.DBforPostgreSQL/flexibleServers` uses API version `2024-08-01` or later, and has no `availabilityZone` property with a value. Zone `1` isn't available for every subscription in `westus`.
   - A `Microsoft.ContainerRegistry/registries` resource, if present, doesn't combine `exportPolicy.status: 'disabled'` with `publicNetworkAccess: 'Enabled'`.
   - The top-level outputs include a resource group name (`AZURE_RESOURCE_GROUP`, `AZURE_RESOURCE_GROUP_NAME`, or `RESOURCE_GROUP_NAME`) and a cluster name (`AZURE_AKS_CLUSTER_NAME` or `AKS_CLUSTER_NAME`), which the journey verifier reads.
8. **Preview** (skipped with `--offline`): Confirm that `AZURE_SUBSCRIPTION_ID` and `AZURE_LOCATION` are set in the selected `azd` environment, then run `azd provision --preview --no-prompt` and require exit `0`.

The script never prints secrets. When a CLI check fails, print the last 20 lines of its output (with secrets removed) under the `FAIL` line, so the reason is visible without rerunning it.

## Gate

`node scripts/check-infra-superset.mjs --offline` must pass before the preview, and `node scripts/check-infra-superset.mjs` must pass before `azd up`. Don't change the script to get past a failure; change the infrastructure.
