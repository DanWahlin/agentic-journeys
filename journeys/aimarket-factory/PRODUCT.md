# AIMarket Factory Product Contract

AIMarket Factory builds the same customer-facing AIMarket application defined by the existing AIMarket phase plans, using a fixed Node.js stack and a governed GitHub factory. Product behavior is inherited unless this document explicitly marks a requirement as factory-only.

## Scope and source of truth

The inherited product sources remain:

- [`../aimarket/PLAN.md`](../aimarket/PLAN.md)
- [`../aimarket/PLAN-phase1-api.md`](../aimarket/PLAN-phase1-api.md)
- [`../aimarket/PLAN-phase2-storefront.md`](../aimarket/PLAN-phase2-storefront.md)
- [`../aimarket/PLAN-phase3-ai.md`](../aimarket/PLAN-phase3-ai.md)
- [`../aimarket/PLAN-phase4-azure.md`](../aimarket/PLAN-phase4-azure.md)

This contract freezes their stable customer behavior for the factory run. `FACTORY.md` governs how work is authorized and delivered; it does not redefine the product.

**F0 frozen baseline:** The complete, reviewable index of this contract's
headings and its repository-local and inherited source references is
[`docs/contract-heading-inventory.md`](./docs/contract-heading-inventory.md).
References to an inherited phase-plan file are whole-document references:
every heading below that document's title is in scope, not only the examples
restated here.

**Included:** Product browsing and filtering, product details, cart management, order creation, local semantic-search fallback, Azure AI Search, catalog-grounded chat, local verification, disposable Azure staging, monitoring, evidence, and cleanup.

**Out of scope:** Authentication, payments, image upload, email, an admin dashboard, rate limiting, WebSockets, production deployment, multi-language implementations, and a durable customer database.

## Fixed implementation stack

Unlike the interactive AIMarket journey, this factory has one stack: Node.js 24, TypeScript, Express, SQLite behind repository interfaces, React 18, Vite, Tailwind CSS, Playwright, Azure Developer CLI, Bicep, Azure Container Apps, Azure AI Search, and Microsoft Foundry. Images are built in Azure Container Registry for `linux/amd64`; local Docker is not required.

## Inherited product contract

### API and data

- The API listens on `0.0.0.0`, honors `PORT`, defaults to port 3000 locally, and mounts routes under `/api`.
- `GET /api/health` returns HTTP 200 and `{ "status": "ok" }`.
- Product, Order, and User fields, constraints, error envelopes, repository interfaces, and endpoint behavior remain as specified in `PLAN-phase1-api.md`.
- Routes depend on repository interfaces; `DATA_PROVIDER` defaults to `sqlite`. SQLite uses WAL mode, foreign keys, JSON serialization for arrays/objects, and an `order_items` table.
- Product prices are finite positive values with no more than two decimal places. Validation accepts `64.99` and `0.1`, and rejects `64.991`, `NaN`, and infinities.
- Order creation is one transaction: validate the user, active products, quantities, and inventory; take prices from current products; decrement inventory; calculate the total server-side; and roll back all changes on failure.
- Errors use `{ "error": { "code": "ERROR_CODE", "message": "...", "details": [] } }`; `details` is present only for validation errors. The inherited status/code mapping includes `VALIDATION_ERROR`, `DUPLICATE_EMAIL`, `INSUFFICIENT_INVENTORY`, `NOT_FOUND`, `AI_RESPONSE_ERROR`, and `INTERNAL_ERROR`.

### Canonical fixtures

The database contains exactly the two users, ten products, and two historical orders from `PLAN-phase1-api.md`. Stable product IDs are `prod-1` through `prod-10`; the buyer is `user-buyer-1` and seller is `user-seller-1`. Historical seed orders do not decrement current inventory. Product images must return HTTP 2xx; `prod-10` uses Unsplash photo ID `photo-1587654780291-39c9404d746b`.

### Storefront

- `/` shows all active products in a responsive grid with image, name, short description, price, rating, and category.
- `/products/:id` shows full details, quantity 1–10, inventory state, and Add to Cart behavior.
- `/cart` supports quantity edits, removal, item count, subtotal, and order placement for `user-buyer-1` with the documented demo shipping address. Success displays the order ID and clears the cart.
- Cart state uses React context, survives navigation, and resets on refresh.
- One typed `api.ts` module owns all client calls. `VITE_API_URL` defaults to `/api`; endpoint methods do not repeat the `/api` prefix.
- Local name/tag/category filtering works without AI. The AI Search toggle switches to semantic search and visibly identifies AI-powered results.
- The accessible chat widget starts collapsed, sends full conversation history, displays pending state, and preserves the inherited opening message.

### Search and chat

- `POST /api/products/search` requires `query`, accepts category/minimum/maximum price filters, returns at most ten products, and normalizes every score to `[0,1]`.
- Search uses the `aimarket-products` index and `aimarket-semantic` configuration when configured, then joins IDs/scores to canonical database records. Without Search configuration it falls back to SQLite text search.
- `POST /api/products/reindex` can republish active catalog records.
- `POST /api/chat` injects all active products into the inherited system prompt, accepts full user/assistant history, and can recommend only catalog products with accurate names, prices, ratings, and capabilities.
- Chat uses the versionless `<endpoint>/openai/v1/` API, deployment `gpt-5-mini` with regional fallback `gpt-5.4-mini`, default temperature, `reasoning_effort: minimal`, and at least 2000 output tokens. It retries once without `reasoning_effort` only when the deployment rejects that parameter.
- Missing Foundry configuration returns 503. Empty upstream content returns 502 with `AI_RESPONSE_ERROR`. The assistant cannot process orders, returns, or payments and must resist instructions to ignore its catalog boundary.

### Disposable Azure staging

The inherited runtime topology remains two Container Apps, Container Registry, Container Apps environment, Basic Azure AI Search with semantic ranking, Microsoft Foundry model deployment, Application Insights, and Log Analytics. The API uses managed identity for Foundry and both apps use managed identity for ACR pulls. Azure AI Search credentials are an app secret; Foundry and ACR keys are not extracted. Complete-template validation determines whether AVM modules or the documented smallest-coupled raw resource fallback is used.

Factory staging adds governance but not production behavior: one uniquely named, tagged, ephemeral resource group per run; protected approval; bounded public exposure; ownership inventory; and verified teardown.

## Acceptance contract

### Deterministic merge gates

Deterministic local fixtures and mocks must prove:

1. Health and exactly ten canonical products with valid images.
2. Pagination, filters, validation, and the error envelope.
3. Atomic order creation and the expected inventory decrement.
4. Product details, cart badge/totals, order confirmation, responsive flows, and accessibility.
5. A local/mock travel search includes UltraBook Pro 15 in the expected top-N and every normalized score is in `[0,1]`.
6. Disabling AI Search preserves client-side filtering.
7. Mocked chat covers lookup, comparison, multi-turn context, nonexistent products, prompt injection, missing configuration, and empty upstream content without invented products or leaked secrets.
8. Production assets and browser requests contain the selected API host with exactly one `/api` prefix and no failed required resource requests.

### Live service conformance

After human staging approval, a bounded two-attempt verifier applies the same search and chat invariants to Azure AI Search and Foundry and records sanitized responses. Provider, quota, or transient service failure is `BLOCKED`, never fabricated as PASS and never allowed to redefine deterministic PR checks.

## Contract diff from interactive AIMarket

| Requirement | Classification | Factory contract |
|---|---|---|
| API models, endpoints, repositories, errors, and ten-product seed catalog | Inherited unchanged | Implement the phase-one contract exactly. |
| React product, detail, cart, search-toggle, and chat flows | Inherited unchanged | Implement the phase-two behavior and phase-three integrations. |
| SQLite fallback, Search index/configuration, normalized scores, grounded Foundry chat | Inherited unchanged | Preserve all fallback and failure semantics. |
| Container Apps, ACR cloud builds, AI Search, Foundry, monitoring, managed identities | Inherited unchanged | Preserve runtime behavior and documented deployment fallback. |
| Language choice | Clarified | Factory version is Node.js 24 + TypeScript only; interactive alternatives remain available in the original journey. |
| Order inventory consistency | Clarified | All validation, inventory decrements, and order inserts are atomic and rollback together. |
| Product verification | Clarified | Deterministic mocks gate merges; bounded live conformance gates the prerelease. |
| GitHub Issues, Project, specialist agents, and sequential dependent PRs | New factory-only | These govern delivery and do not change customer behavior. |
| Human plan, gate, merge, and staging approvals | New factory-only | The controller projects readiness only inside the approved plan; automation cannot broaden authority or merge. |
| WIP, Actions/Copilot/Azure budgets, and dispatch serialization | New factory-only | Flow and spend are bounded by `factory/policy.yml`. |
| Dedicated ephemeral staging resource group, TTL, evidence, and verified cleanup | New factory-only | Cleanup is a prerequisite for prerelease success. |
| Production deployment | New factory-only prohibition | No workflow, agent, or learner action may target production. |

## Change control

F0 freezes this document and every referenced heading as indexed in
[`docs/contract-heading-inventory.md`](./docs/contract-heading-inventory.md).
A product change requires an approved RFC, a contract issue that names the
affected headings, updated deterministic fixtures, and human review. Agents
may identify ambiguity but may not silently weaken inherited behavior or
change this contract while implementing another issue.
