# SmartTodo: AI-Powered Task Breakdown

SmartTodo is an iPhone app and Azure backend that turns vague goals into actionable steps. This document defines the overall vision, shared decisions, phase boundaries, and end goals. Detailed implementation requirements live in the phase plans so an agent can load only the context needed for the current phase.

README prompts use exact document names and section names as stable references. If a document or section is renamed, update its README references in the same change.

## Vision

Build a focused productivity application that demonstrates an incremental agentic development workflow:

1. Generate and inspect an Azure Functions API with Azure SQL storage and AI task decomposition.
2. Build a native SwiftUI client against the fixed API contract.
3. Deploy the backend to Azure and verify it with real requests.

The learner should work in small generate, inspect, test, and refine loops rather than asking an agent to build the entire system in one prompt.

## End State

The completed application has:

- An Azure Functions REST API for todos and action steps.
- Azure SQL storage behind repository interfaces.
- AI task decomposition with `gpt-5-mini` on Microsoft Foundry.
- A SwiftUI iOS client that can create, update, delete, and complete todos and generated steps.
- Azure Functions Flex Consumption hosting with managed-identity access to Azure SQL.
- Application Insights and Log Analytics monitoring.
- Portable local and production verification.

## Scope

**Included:** Todo management, AI-generated action steps, step completion, automatic todo status changes, deterministic seed data, local development, a SwiftUI client, Azure deployment, monitoring, and verification.

**Out of scope:** User authentication, push notifications, collaboration and sharing, offline sync, recurring todos, image attachments, rate limiting, and mobile-app distribution through azd.

## Shared Decisions

- **Recommended API stack:** Node.js + TypeScript + Azure Functions v4.
- **Alternative API stacks:** Python v2 programming model, .NET isolated worker, or Java.
- **Client:** Swift and SwiftUI for iOS 17 or later.
- **Data:** Azure SQL, accessed only through repository interfaces.
- **AI:** `gpt-5-mini` on Microsoft Foundry, with `gpt-4.1` as the regional fallback.
- **Deployment:** Azure Developer CLI (`azd`) and Bicep. Prefer Azure Verified Modules, and use a raw `Microsoft.*` fallback when AVM parameter drift blocks deployment.
- **Default region:** `westus`.
- **API status values:** `pending`, `in_progress`, and `completed`.

## Target Project Structure

```text
smart-todo/
├── src/
│   ├── api/          # Selected Azure Functions language
│   └── ios/          # SwiftUI application
├── infra/            # Bicep and portable deployment hooks
└── azure.yaml        # azd configuration
```

## Phase Plans

| Journey phase | Detailed plan | Outcome |
| --- | --- | --- |
| Phase 1: Build the API and AI | [`PLAN-phase1-api.md`](./PLAN-phase1-api.md) | Models, repositories, Azure SQL schema, REST endpoints, seed data, and AI task decomposition |
| Phase 2: Build the iOS App | [`PLAN-phase2-ios.md`](./PLAN-phase2-ios.md) | SwiftUI models, API client, todo views, and simulator-ready project |
| Phase 3: Deploy to Azure | [`PLAN-phase3-azure.md`](./PLAN-phase3-azure.md) | Flex Consumption backend deployed and verified on Azure |

Read this overview before beginning. During implementation, load the current phase plan and only the earlier phase plan needed to confirm an existing contract. A final review must check this overview and all three phase plans.

## Cross-Phase Contracts

- Phase 1 ([`PLAN-phase1-api.md`](./PLAN-phase1-api.md)) owns the canonical Todo, ActionStep, error, REST response, and AI-generation contracts.
- Phase 2 ([`PLAN-phase2-ios.md`](./PLAN-phase2-ios.md)) consumes the Phase 1 contracts and centralizes calls in one Swift API client.
- Phase 3 ([`PLAN-phase3-azure.md`](./PLAN-phase3-azure.md)) configures and deploys the application built in the first two phases. It does not redefine application behavior.
- Section names referenced by README prompts are part of the journey contract.

## End-to-End Acceptance Criteria

The local application is complete when:

- The API returns the three deterministic seed todos for `user-1`.
- Todo create, update, delete, and cascade behavior match the Phase 1 contracts.
- AI generation returns 3 to 7 ordered action steps when credentials are configured.
- Completing all action steps marks the parent todo as completed.
- The SwiftUI app builds for an iPhone simulator and completes the main todo workflow.

The Azure deployment is complete when:

- The post-provision hook creates managed-identity SQL access, the schema, and seed data.
- The checked-in verifier passes seed reads, create, AI generation, step completion, deletion, and final absence.
- The iOS app can use the deployed HTTPS API URL.

The journey is complete only after the README assignment is finished and `azd down --force --purge` removes the run's Azure resources.

## Production Hardening (Out of Scope)

Before exposing this beyond a demo, add API authentication, move `AZURE_AI_KEY` to Key Vault or managed identity, add rate limiting for `/generate-steps`, encode output if data is rendered in a browser, and replace broad storage/SQL firewall rules with private networking.
