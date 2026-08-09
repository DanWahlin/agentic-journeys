# AIMarket Phase 2: Storefront

Build the React storefront against the API contract from [`PLAN-phase1-api.md`](./PLAN-phase1-api.md). Read [`PLAN.md`](./PLAN.md) first for the journey vision and shared decisions. The API must be running for the frontend to work.

README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

## Frontend

### Pages

#### Product Grid (Home Page — `/`)

- Displays all active products in a responsive card grid (3 columns on desktop, 2 on tablet, 1 on mobile)
- Each card shows: image, name, short description, price, rating (stars), and category badge
- Search bar at the top of the page (plain text search that filters by name and tags client-side)
- Category filter buttons below the search bar (All, Electronics, Clothing, Home, Sports, Books, Toys)
- Clicking a product card navigates to the product detail page

#### Product Detail (`/products/:id`)

- Full product view: large image, name, full description, price, rating, review count, category, tags, inventory status
- "Add to Cart" button with quantity selector (1-10, default 1)
- If inventory is 0, show "Out of Stock" and disable the button
- "Back to Products" link

#### Cart (`/cart`)

- List of cart items with: product name, image (small), unit price, quantity (editable), line total
- "Remove" button per item
- Cart summary: subtotal, item count
- "Place Order" button that calls `POST /api/orders` with a hardcoded `userId` of `user-buyer-1` and a hardcoded shipping address
- After successful order, show a confirmation message with the order ID and clear the cart
- Empty cart state: "Your cart is empty" with a link to browse products

### Components

#### SearchBar: Client-Side Filtering

- Text input with placeholder "Search products..."
- Filters the product grid as the user types (debounced, 300ms)

#### SearchBar: AI Search Integration

- Add a toggle for "AI Search" that uses the semantic search endpoint instead of client-side filtering

#### ChatWidget: Shared Layout

- Floating button in the bottom-right corner (collapsed by default)
- Click to expand a chat panel (400px wide, 500px tall)

#### ChatWidget: Placeholder State

- Show a placeholder message: "Shopping assistant coming soon!"
- Do not wire up the API

#### ChatWidget: AI Integration

- Wire up to `POST /api/chat`
- Message list showing conversation history (user messages right-aligned, assistant messages left-aligned)
- Text input at the bottom with a send button
- Sends full message history to `POST /api/chat` on each message
- Shows a typing indicator while waiting for a response
- Initial assistant message on open: "Hi! I'm the AIMarket assistant. I can help you find products, compare options, or answer questions about our catalog. What are you looking for?"

#### CartIcon

- Shopping cart icon in the top-right navigation
- Badge showing total item count
- Clicking navigates to `/cart`

### State Management

- Cart state stored in React context (not persisted to a backend)
- Cart structure: `Map<productId, { product: Product, quantity: number }>`
- Cart survives page navigation but resets on browser refresh

### API Client

All API calls go through a single `api.ts` module:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function getProducts(params?: { category?: string; page?: number }): Promise<PaginatedResponse<Product>>
export async function getProduct(id: string): Promise<Product>
export async function searchProducts(query: string): Promise<Product[]>
export async function placeOrder(order: CreateOrderRequest): Promise<Order>
export async function sendChatMessage(messages: ChatMessage[]): Promise<string>
```

**URL convention:** Endpoint paths in the client (e.g., `/products`, `/orders`) do NOT include the `/api` prefix — that's part of `API_BASE`. In development, the Vite proxy maps `/api` → `localhost:3000/api`. In production, set `VITE_API_URL` to the full API base including `/api` (e.g., `https://ca-api-xxx.azurecontainerapps.io/api`).

## Phase 2 Acceptance Criteria

- All 10 seeded products render with working images, prices, ratings, and categories.
- Name, tag, and category filtering work without AI services.
- Product details match the Phase 1 API response.
- Cart quantities, badge count, and totals stay consistent during navigation.
- Placing an order displays its ID and clears the cart.
- The chat widget uses the shared layout and placeholder state only; Phase 3 owns AI integration.
