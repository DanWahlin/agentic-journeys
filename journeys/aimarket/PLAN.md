# AIMarket: AI-Powered Marketplace

AIMarket is a full-stack marketplace with a REST API, React storefront, semantic product search, and an AI shopping assistant. This document defines the overall vision, shared decisions, phase boundaries, and end goals. Detailed implementation requirements live in the phase plans so an agent can load only the context needed for the current phase.

README prompts use exact document names and section names as stable references. If a document or section is renamed, update its README references in the same change.

## Vision

Build a lightweight marketplace that demonstrates an incremental agentic development workflow:

1. Generate and inspect a repository-based API with deterministic local data.
2. Build a usable storefront against the API contract.
3. Add semantic search and a catalog-grounded shopping assistant.
4. Deploy the complete application to Azure and verify it with real requests.

The learner should work in small generate, inspect, test, and refine loops rather than asking an agent to build the entire system in one prompt.

## End State

The completed application has:

- A REST API for products, orders, and users.
- SQLite storage behind repository interfaces, with a provider factory that can support a cloud database later.
- A React storefront with product discovery, product details, cart state, and order placement.
- Azure AI Search semantic product discovery with a local SQLite fallback.
- A Microsoft Foundry shopping assistant grounded only in the current product catalog.
- Azure Container Apps hosting, Azure Container Registry cloud builds, Application Insights, and Log Analytics.
- Portable local and production verification.

## Scope

**Included:** Product browsing, filtering, semantic search, cart management, order creation, catalog-grounded chat, local development, containerization, Azure deployment, monitoring, and verification.

**Out of scope:** Authentication, payments, image upload, email, an admin dashboard, rate limiting, and WebSockets.

## Shared Decisions

- **Recommended API stack:** Node.js + TypeScript + Express.
- **Alternative API stacks:** Python + FastAPI, .NET Minimal APIs, or Java + Spring Boot.
- **Frontend:** React 18 + Vite + Tailwind CSS.
- **Local data:** SQLite, accessed only through repository interfaces.
- **AI:** `gpt-5-mini` on Microsoft Foundry, with `gpt-5.4-mini` as the regional fallback.
- **Deployment:** Azure Developer CLI (`azd`) and Bicep. Prefer Azure Verified Modules, validate each AVM addition in the complete template, and use a raw `Microsoft.*` fallback for one resource or a coupled resource set when AVM composition blocks Azure validation.
- **Default region:** `westus`.
- **Image architecture:** ACR cloud builds targeting `linux/amd64`; local Docker is not required.

## Target Project Structure

```text
aimarket/
├── api/          # Selected API language
├── client/       # React frontend
├── infra/        # Bicep and portable deployment hooks
└── azure.yaml    # azd configuration
```

## Phase Plans

| Journey phase | Detailed plan | Outcome |
| --- | --- | --- |
| Phase 1: Build the API | [`PLAN-phase1-api.md`](./PLAN-phase1-api.md) | Models, validation, repositories, SQLite seed data, and REST endpoints |
| Phase 2: Build the Storefront | [`PLAN-phase2-storefront.md`](./PLAN-phase2-storefront.md) | React product grid, detail page, cart, and placeholder chat UI |
| Phase 3: Add AI Features | [`PLAN-phase3-ai.md`](./PLAN-phase3-ai.md) | Semantic search and catalog-grounded shopping assistant |
| Phase 4: Deploy to Azure | [`PLAN-phase4-azure.md`](./PLAN-phase4-azure.md) | Containerized application deployed and verified on Azure |

Read this overview before beginning. During implementation, load the current phase plan and only the earlier phase plan needed to confirm an existing contract. A final review must check this overview and all four phase plans.

## Cross-Phase Contracts

- Phase 1 ([`PLAN-phase1-api.md`](./PLAN-phase1-api.md)) owns the canonical product, order, user, error, and REST response contracts.
- Phase 2 ([`PLAN-phase2-storefront.md`](./PLAN-phase2-storefront.md)) consumes those API contracts and centralizes calls in one frontend API client.
- Phase 3 ([`PLAN-phase3-ai.md`](./PLAN-phase3-ai.md)) extends the existing API and frontend without breaking Phase 1 or Phase 2 behavior.
- Phase 4 ([`PLAN-phase4-azure.md`](./PLAN-phase4-azure.md)) configures and deploys the application built in the first three phases; it does not redefine application behavior.
- Section names referenced by README prompts are part of the journey contract.

## End-to-End Acceptance Criteria

The local application is complete when:

- `GET /api/health` returns HTTP 200.
- The product grid shows all 10 seed products and every image loads.
- Placing an order decrements inventory.
- Search works locally through its SQLite fallback.
- The chat endpoint returns 503 when Foundry is not configured rather than crashing.

The Azure deployment is complete when:

- The checked-in verifier passes health, product count, image, semantic-search, chat, storefront, and frontend-to-API integration checks.
- Semantic search returns relevant catalog products.
- The shopping assistant mentions real catalog products and does not invent products.
- The storefront assets contain the deployed API host.

The journey is complete only after the README assignment is finished and `azd down --force --purge` removes the run's Azure resources.
