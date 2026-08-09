# AIMarket Phase 3: AI Features

Add semantic search and a shopping assistant to the application from Phases 1 and 2. Read [`PLAN.md`](./PLAN.md) first, then use the existing contracts in [`PLAN-phase1-api.md`](./PLAN-phase1-api.md) and UI extension points in [`PLAN-phase2-storefront.md`](./PLAN-phase2-storefront.md).

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## AI Features

**Local development and deployment:** Implement endpoints with graceful fallbacks (SQLite LIKE for search; chat returns 503 without a Foundry endpoint) so the AI features work without long-lived standalone AI resources. [`PLAN-phase4-azure.md`](./PLAN-phase4-azure.md) provisions Azure AI Search + Microsoft Foundry, injects the Search key, and configures managed-identity authentication for Foundry. You can use temporary local credentials to test AI before deployment, but don't create a second permanent Search/Foundry pair when the Azure deployment will provision them.

### Semantic Product Search

Replace keyword filtering with semantic search that understands intent.

#### Azure AI Search Index

**Index name:** `aimarket-products`

**Fields:**

| Field | Type | Searchable | Filterable | Sortable | Facetable |
|-------|------|-----------|-----------|---------|----------|
| id | string (key) | no | yes | no | no |
| name | string | yes | no | yes | no |
| description | string | yes | no | no | no |
| category | string | yes | yes | no | yes |
| tags | string collection | yes | yes | no | yes |
| price | double | no | yes | yes | no |
| rating | double | no | yes | yes | no |

**Semantic configuration:**
- Semantic configuration name: `aimarket-semantic`
- Title field: `name`
- Content fields: `description`
- Keyword fields: `tags`

#### Endpoint: `POST /api/products/search`

**Request body:**

```json
{
  "query": "something lightweight for travel",
  "category": "Electronics",
  "minPrice": 100,
  "maxPrice": 1500
}
```

Only `query` is required. `category`, `minPrice`, and `maxPrice` are optional filters applied alongside semantic ranking.

**Response (200):**

```json
{
  "data": [
    {
      "id": "prod-1",
      "name": "UltraBook Pro 15",
      "shortDescription": "Lightweight 15-inch ultrabook with all-day battery",
      "price": 1299.99,
      "category": "Electronics",
      "rating": 4.7,
      "imageUrl": "https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?w=400&h=300&fit=crop",
      "score": 0.92
    }
  ],
  "query": "something lightweight for travel",
  "count": 3
}
```

**Behavior:**
- Uses Azure AI Search with semantic ranking (query type: `semantic`)
- Falls back to simple text search if Azure AI Search is unavailable
- Returns top 10 results ranked by semantic relevance
- Each result includes an API-normalized `score` from 0 to 1. Normalize the semantic reranker score from its 0–4 range, or squash the unbounded BM25 score into the same 0–1 contract before returning it.
- **Two-step process:** Search returns IDs and scores from the index, then the API fetches full product details (including `shortDescription`, `imageUrl`) from the database and merges them into the response

#### Indexing

- On API startup, push all seed products to the Azure AI Search index
- Provide a script or endpoint (`POST /api/products/reindex`) to re-push all products

#### Frontend Integration

- Add an "AI Search" toggle to the SearchBar component
- When enabled, search calls `POST /api/products/search` instead of client-side filtering
- Show a small label on results: "AI-powered results" when semantic search is active

#### Semantic Search Environment Variables

`AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_KEY`, and `AZURE_SEARCH_INDEX` (default: `aimarket-products`).

There is deliberately no api-version variable. The chat client calls the versionless `/openai/v1` API, so do not add `AZURE_OPENAI_API_VERSION` here or to the Container App environment.

When Azure AI Search variables are not set, search falls back to SQLite LIKE queries.

### Shopping Assistant

A conversational agent that helps users find products.

#### Endpoint: `POST /api/chat`

**Request body:**

```json
{
  "messages": [
    { "role": "user", "content": "What laptops do you have?" }
  ]
}
```

**Response (200):**

```json
{
  "role": "assistant",
  "content": "We have the UltraBook Pro 15, a lightweight 15-inch ultrabook at $1,299.99 with a 4.7 rating. It's great for travel and has all-day battery life. Would you like more details, or are you looking for something in a different price range?"
}
```

#### System Prompt

```text
You are the AIMarket shopping assistant. You help customers find and compare
products from the AIMarket catalog.

Rules:
- Only recommend products that exist in the catalog provided below.
- Include the product name, price, and rating when recommending products.
- If a customer asks about a product category you don't have, say so honestly.
- Keep responses concise (2-3 sentences for simple questions, up to a paragraph for comparisons).
- Do not make up products, prices, or features that aren't in the catalog.
- You cannot process orders, handle returns, or take payments. If asked, explain
  that the customer can add items to their cart on the website.

Current catalog:
{products_json}
```

**Behavior:**
- On each request, fetch all active products and inject them into the system prompt as JSON
- Use Microsoft Foundry chat completions API with `gpt-5-mini` (fallback to `gpt-5.4-mini` if unavailable in your region)
- Call the versionless `/openai/v1` API. Use the OpenAI client with a base URL of `<AZURE_OPENAI_ENDPOINT>/openai/v1/` (tolerate a trailing slash on the endpoint) and send the deployment name as `model`. Do **not** use a dated `api-version` and do **not** use an Azure-specific client that requires one: the dated GA version (`2024-10-21`) rejects `reasoning_effort`, and the v1 API has been GA since August 2025.
- Temperature: leave at the model default — both supported models are in the gpt-5 family and reject custom temperature values.
- Reasoning effort: `minimal` — product lookup and comparison are latency-sensitive assistant tasks that do not need deep reasoning.
- If a deployment rejects `reasoning_effort` anyway (`gpt-5-chat` variants are not reasoning models), retry the request once without the parameter rather than failing the conversation.
- Max completion/output tokens: at least `2000`. This limit includes hidden reasoning tokens for GPT-5 models; a 500-token limit can be exhausted before the model emits visible content.
- Pass the full message history from the request (the client maintains conversation state)
- Treat an empty or whitespace-only model response as an upstream failure. Return HTTP 502 with code `AI_RESPONSE_ERROR` and a user-safe message instead of exposing it as a generic 500.

#### Shopping Assistant Environment Variables

`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (default: `gpt-5-mini`), and optional `AZURE_OPENAI_KEY` for local testing.

When `AZURE_OPENAI_ENDPOINT` is not set, `/api/chat` returns 503. In Azure, authenticate to Foundry with the API Container App's managed identity and the `Cognitive Services User` role. For optional local testing, use `AZURE_OPENAI_KEY` as a fallback.

## Phase 3 Acceptance Criteria

- Local search returns relevant catalog products through the SQLite fallback.
- Configured Azure AI Search uses semantic ranking and normalized scores.
- The AI Search toggle preserves client-side filtering when disabled.
- Chat sends full conversation history and grounds every answer in active products.
- Missing Foundry configuration returns 503.
- Empty model content returns 502 with `AI_RESPONSE_ERROR`.
- A product comparison produces visible content and mentions a real catalog product.
