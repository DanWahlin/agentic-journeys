# Evidence contract

Staging evidence uses schema `factory-evidence-v1` and includes:

- repository, run ID, task ID, approved commit SHA, policy version, immutable producer run ID, and timestamps
- PASS, FAIL, or BLOCKED status with deterministic check results
- the exact run resource-group name plus a SHA-256 binding
- cleanup status `PENDING` until measured cleanup finishes
- sanitized metrics that contain no tokens, authorization headers, cookies, connection strings, private endpoints, or ephemeral hostnames

Cleanup evidence uses schema `factory-cleanup-evidence-v1`. The workflow builds it from Azure reads before and after the exact resource-group deletion. It records hashed owned and unrelated inventories, observed resource-group absence, the mandatory tag set, lifecycle-exception policy, and immutable repository/run/SHA/policy/producer bindings. The private cleanup artifact includes the raw inventory JSON; immediate verification and release both recompute its hashes rather than trusting hash strings supplied by the producer. It must never infer absence from a requested delete operation.

PR post-check writes use `factory-post-check-result-v1` with repository, PR, base and head SHA, required check names and conclusions, policy version, and immutable producer run ID.

The release workflow downloads staging and cleanup artifacts from their recorded Actions runs, validates both bindings against the current approved default-branch SHA, and creates no prerelease unless staging is PASS and cleanup verification succeeds.
