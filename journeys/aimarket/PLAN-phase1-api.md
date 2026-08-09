# AIMarket Phase 1: API

Build the AIMarket API, data model, repository layer, REST contracts, and deterministic seed data.

Read [`PLAN.md`](./PLAN.md) first for the journey vision, shared decisions, and end-to-end acceptance criteria. README prompts use the exact section names in this document as stable references. If a section is renamed, update its README references in the same change.

**Out of scope:** No auth, no payments, no image upload, no email, no admin dashboard, no rate limiting, no WebSockets.

---

## Choose Your Stack

Pick your API language. Data models, endpoints, and acceptance criteria are identical across stacks.

**Happy path (recommended for first run):** Node.js + TypeScript + Express, region `westus`, model `gpt-5-mini` (fallback `gpt-5.4-mini`). Complete the work from `journeys/aimarket` inside the workspace created at the beginning of the journey.

| | Node.js | Python | .NET | Java |
|---|---------|--------|------|------|
| **Framework** | Express + TypeScript | FastAPI | ASP.NET Core Minimal APIs | Spring Boot |
| **SQLite** | `better-sqlite3` | `sqlite3` (stdlib) | `Microsoft.Data.Sqlite` | `JdbcTemplate` + SQLite |

The frontend is always React 18 + Tailwind CSS. AI uses **gpt-5-mini on Microsoft Foundry** (with gpt-5.4-mini as the fallback if gpt-5-mini is unavailable in your region). Deploy with **azd** + **Bicep**, preferring Azure Verified Modules (AVM) with raw `Microsoft.*` resources when AVM blocks deployment. See the [`data-access-abstraction` skill](../../.github/skills/data-access-abstraction/SKILL.md) for repository pattern examples in all four languages.

## Project Structure

```
aimarket/
├── api/          # Your chosen language
├── client/       # React frontend (Vite + Tailwind)
├── infra/        # Bicep with AVM modules (Azure deployment)
└── azure.yaml    # azd configuration (Azure deployment)
```

The API must follow the **repository pattern** (interfaces → implementations → factory) so routes stay independent of the data layer. SQLite is the default implementation. A Cosmos DB or PostgreSQL deployment also requires its repository implementation, database infrastructure, credentials, and `DATA_PROVIDER` configuration.

---

## API

Build the API with a local SQLite database. No Azure services needed yet.

### Data Access Layer

Define these repository contracts as interfaces or protocols in your chosen language:

```
ProductRepository:
  getAll(page, pageSize, category?, minPrice?, maxPrice?, status?) → { data: Product[], totalCount }
  getById(id) → Product | null
  create(input) → Product
  update(id, fields) → Product | null
  search(query, filters?) → Product[]

OrderRepository:
  create(userId, items, shippingAddress) → Order
  getById(id) → Order | null
  getByUserId(userId, page, pageSize) → { data: Order[], totalCount }

UserRepository:
  create(email, name, role) → User
  getById(id) → User | null
  getByEmail(email) → User | null
```

The factory reads the `DATA_PROVIDER` environment variable (default: `sqlite`) and returns the matching implementation. Routes never import database clients directly.

**SQLite notes:** Store arrays and objects as JSON strings, then parse them on read. Use an `order_items` junction table for order line items. Set `journal_mode=WAL` and `foreign_keys=ON`. Store the database at `api/aimarket.db` and add it to `.gitignore`.

**API entry point:** Listen on `0.0.0.0:3000` by default and honor the `PORT` environment variable when it is set. Binding to all interfaces keeps the API reachable both at `localhost:3000` during development and through Container Apps ingress after deployment. Enable CORS, parse JSON, expose `GET /api/health` → `{status:"ok"}`, mount routes at `/api/{products,orders,users,chat}`, and register the global error handler last.

### Data Models

#### Product

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | auto | UUID v4, generated on create |
| name | string | yes | 1–200 characters |
| description | string | yes | 1–2000 characters |
| shortDescription | string | yes | 1–200 characters |
| price | number | yes | > 0, two decimal places |
| category | string | yes | Must be one of: `Electronics`, `Clothing`, `Home`, `Sports`, `Books`, `Toys` |
| tags | string[] | no | Defaults to `[]` |
| inventory | number | yes | >= 0, integer |
| rating | number | no | 0 means unrated; otherwise 1.0–5.0. Default `0` |
| reviewCount | number | no | >= 0, default `0` |
| imageUrl | string | no | Valid URL or empty string |
| sellerId | string | yes | Must reference an existing user with role `seller` |
| status | string | no | `draft`, `active`, or `archived`. Default `active` |
| createdAt | string | auto | ISO 8601, set on create |
| updatedAt | string | auto | ISO 8601, set on create and update |

**Price validation:** Never validate two decimal places with `Math.round(value * 100) === value * 100` or another exact comparison against an unrounded IEEE-754 product. First require a finite positive number, then normalize to integer cents or compare against a value rounded back to two decimals. Regression tests must accept `64.99` and `0.1`, reject `64.991`, and reject `NaN`, positive infinity, and negative infinity.

#### Order

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | auto | UUID v4 |
| userId | string | yes | Must reference an existing user |
| items | OrderItem[] | yes | At least 1 item. Each: `{ productId: string, quantity: number, priceAtPurchase: number }` |
| total | number | auto | Sum of (quantity × priceAtPurchase) for all items. Calculated server-side. |
| status | string | auto | `pending` on create. Valid transitions: pending → confirmed → shipped → delivered; pending → cancelled |
| shippingAddress | object | yes | `{ street: string, city: string, state: string, zip: string, country: string }` — all fields required |
| createdAt | string | auto | ISO 8601 |

**Order creation behavior:** When an order is placed, the API must:
1. Validate all `productId` references exist and have status `active`
2. Validate each product has sufficient `inventory` for the requested `quantity`
3. Decrement `inventory` for each product by the ordered `quantity`
4. Set `priceAtPurchase` from the product's current `price` (not from the request)
5. Calculate `total` server-side

#### User

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | auto | UUID v4 |
| email | string | yes | Valid email format, unique across all users |
| name | string | yes | 1–100 characters |
| role | string | yes | `buyer` or `seller` |
| createdAt | string | auto | ISO 8601 |

### API Endpoints

Base URL: `http://localhost:3000/api`

#### `GET /products`

List products with pagination and optional filters.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number (1-based) |
| pageSize | number | 20 | Items per page (max 100) |
| category | string | — | Filter by exact category |
| minPrice | number | — | Filter by minimum price |
| maxPrice | number | — | Filter by maximum price |
| status | string | `active` | Filter by status. Only return `active` products by default. |

**Response (200):**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "UltraBook Pro 15",
      "shortDescription": "Lightweight 15-inch ultrabook with all-day battery",
      "price": 1299.99,
      "category": "Electronics",
      "tags": ["laptop", "ultrabook", "portable"],
      "inventory": 25,
      "rating": 4.7,
      "reviewCount": 142,
      "imageUrl": "https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?w=400&h=300&fit=crop",
      "status": "active"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 10,
  "totalPages": 1
}
```

Note: List responses return a subset of fields (no `description`, `sellerId`, `createdAt`, `updatedAt`). Full details are returned by `GET /products/:id`.

#### `GET /products/:id`

**Response (200):** Full product object with all fields.

**Response (404):**

```json
{
  "error": { "code": "NOT_FOUND", "message": "Product not found" }
}
```

#### `POST /products`

**Request body:**

```json
{
  "name": "Mechanical Keyboard",
  "description": "Cherry MX Brown switches with RGB backlighting and USB-C connection.",
  "shortDescription": "Mechanical keyboard with Cherry MX switches",
  "price": 149.99,
  "category": "Electronics",
  "tags": ["keyboard", "mechanical", "rgb"],
  "inventory": 50,
  "imageUrl": "https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?w=400&h=300&fit=crop",
  "sellerId": "seller-user-id"
}
```

**Response (201):** The created product with `id`, `createdAt`, `updatedAt`, and defaults applied.

**Response (400):** Validation error with specific field failures.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "price", "message": "Price must be greater than 0" },
      { "field": "category", "message": "Category must be one of: Electronics, Clothing, Home, Sports, Books, Toys" }
    ]
  }
}
```

#### `PUT /products/:id`

Partial update. Only include fields to change. Returns the updated product (200) or 404.

#### `POST /orders`

**Request body:**

```json
{
  "userId": "buyer-user-id",
  "items": [
    { "productId": "product-1-id", "quantity": 2 },
    { "productId": "product-2-id", "quantity": 1 }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "US"
  }
}
```

**Response (201):**

```json
{
  "id": "order-id",
  "userId": "buyer-user-id",
  "items": [
    { "productId": "product-1-id", "quantity": 2, "priceAtPurchase": 1299.99 },
    { "productId": "product-2-id", "quantity": 1, "priceAtPurchase": 249.99 }
  ],
  "total": 2849.97,
  "status": "pending",
  "shippingAddress": { "street": "123 Main St", "city": "Seattle", "state": "WA", "zip": "98101", "country": "US" },
  "createdAt": "2026-04-02T10:30:00.000Z"
}
```

**Error cases:**
- 400 if `items` is empty
- 400 if any `productId` doesn't exist or isn't `active`
- 400 if any product has insufficient `inventory`
- 400 if `shippingAddress` is missing required fields

#### `GET /orders/:id`

Full order object (200) or 404.

#### `GET /orders?userId=xxx`

Paginated list of orders for a user. Same pagination format as products.

#### `POST /users/register`

**Request body:**

```json
{
  "email": "alex@example.com",
  "name": "Alex Johnson",
  "role": "buyer"
}
```

**Response (201):** The created user with `id` and `createdAt`.

**Response (400):** If email already exists: `{ "error": { "code": "DUPLICATE_EMAIL", "message": "A user with this email already exists" } }`

#### `GET /users/:id`

Full user object (200) or 404.

### Error Format

All errors: `{ "error": { "code": "ERROR_CODE", "message": "...", "details": [] } }`. `details` only on validation errors.

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 400 | `DUPLICATE_EMAIL` | Email already registered |
| 400 | `INSUFFICIENT_INVENTORY` | Not enough stock |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 502 | `AI_RESPONSE_ERROR` | Foundry returned no usable assistant content |
| 500 | `INTERNAL_ERROR` | Unexpected error |

### Seed Data

Loaded into the SQLite database on startup. Persists locally in the `aimarket.db` file.

**Users:**

| id | email | name | role |
|----|-------|------|------|
| `user-buyer-1` | `alex@example.com` | Alex Johnson | buyer |
| `user-seller-1` | `jordan@example.com` | Jordan Lee | seller |

**Products** (all `sellerId: "user-seller-1"`, all `status: "active"`):

| id | name | category | price | inventory | rating | tags |
|----|------|----------|-------|-----------|--------|------|
| `prod-1` | UltraBook Pro 15 | Electronics | 1299.99 | 25 | 4.7 | laptop, ultrabook, portable |
| `prod-2` | Wireless Noise-Canceling Headphones | Electronics | 249.99 | 100 | 4.5 | headphones, wireless, noise-canceling |
| `prod-3` | Trail Runner X200 | Sports | 129.99 | 60 | 4.3 | running, shoes, trail |
| `prod-4` | Organic Cotton Crew Neck | Clothing | 34.99 | 200 | 4.1 | t-shirt, organic, cotton |
| `prod-5` | Smart Home Hub | Electronics | 89.99 | 75 | 4.4 | smart-home, hub, voice-control |
| `prod-6` | Ceramic Pour-Over Set | Home | 45.99 | 40 | 4.8 | coffee, pour-over, ceramic |
| `prod-7` | Pro Django | Books | 39.99 | 150 | 4.6 | programming, python, django |
| `prod-8` | Yoga Mat Premium | Sports | 59.99 | 80 | 4.2 | yoga, mat, exercise |
| `prod-9` | Winter Puffer Jacket | Clothing | 189.99 | 35 | 4.5 | jacket, winter, puffer |
| `prod-10` | Building Block Castle Set | Toys | 49.99 | 90 | 4.9 | building, blocks, kids |

**Product descriptions:**

| id | description | shortDescription |
|----|-------------|------------------|
| `prod-1` | The UltraBook Pro 15 is a lightweight 15-inch laptop computer built for professionals on the move. Featuring a full-day battery, a vivid IPS display, and a backlit keyboard, this portable computer handles everything from code to presentations without breaking a sweat. | Lightweight 15-inch ultrabook with all-day battery |
| `prod-2` | Block out distractions with industry-leading active noise cancellation. These wireless headphones deliver rich, balanced sound over Bluetooth 5.2 with 30 hours of battery life. Foldable design fits easily in a backpack. | Wireless over-ear headphones with active noise cancellation |
| `prod-3` | Designed for rugged terrain, the Trail Runner X200 features aggressive lugs for grip, a rock plate for protection, and a breathable mesh upper. Ideal for trail runs, hiking, and obstacle courses. | Rugged trail running shoes with aggressive grip |
| `prod-4` | Made from 100% GOTS-certified organic cotton, this crew neck tee is soft, breathable, and built to last. Pre-shrunk fabric and reinforced stitching mean it holds its shape wash after wash. | Soft organic cotton t-shirt, pre-shrunk and durable |
| `prod-5` | Control your lights, thermostat, and locks with voice commands or the companion app. The Smart Home Hub supports Zigbee, Z-Wave, and Wi-Fi devices and works with Alexa and Google Assistant out of the box. | Voice-controlled smart home hub with multi-protocol support |
| `prod-6` | Hand-thrown ceramic dripper and server set for pour-over coffee enthusiasts. The ribbed interior promotes even extraction while the double-wall server keeps your brew warm. Dishwasher safe. | Handcrafted ceramic pour-over coffee dripper and server |
| `prod-7` | Master Django from models to deployment. Covers the ORM, class-based views, REST APIs with Django REST Framework, authentication, testing, and production deployment with Docker and CI/CD pipelines. | Complete Django guide from models to production deployment |
| `prod-8` | Extra-thick 6mm natural rubber mat with a non-slip textured surface on both sides. Alignment lines help with pose positioning. Includes a carrying strap. Free from PVC, latex, and heavy metals. | Extra-thick 6mm natural rubber yoga mat with alignment lines |
| `prod-9` | Stay warm in sub-zero temperatures with this 700-fill-power down puffer jacket. Water-resistant shell, elastic cuffs, and a detachable hood keep the cold out. Packs into its own pocket for travel. | 700-fill down puffer jacket, water-resistant and packable |
| `prod-10` | Build a medieval castle with 850 interlocking pieces including turrets, a drawbridge, and 6 knight minifigures. Compatible with all major building block brands. Recommended for ages 6 and up. | 850-piece castle building set with 6 knight minifigures |

Use Unsplash image URLs for `imageUrl`. Format: `https://images.unsplash.com/photo-{id}?w=400&h=300&fit=crop`. For `prod-10`, use the validated building-block photo ID `photo-1587654780291-39c9404d746b`; the previously generated `photo-1558877385-8c1b8e6c0b8f` returns an error. Choose matching photos for the remaining products. Before accepting seed data, request every image URL and require HTTP 2xx. Replace any URL that redirects to an error or returns 4xx/5xx. The generated API verifier or browser test must fail if any product image is broken.

**Orders:**

| id | userId | items | total | status |
|----|--------|-------|-------|--------|
| `order-1` | `user-buyer-1` | prod-1 × 1 ($1299.99), prod-6 × 2 ($45.99 each) | 1391.97 | confirmed |
| `order-2` | `user-buyer-1` | prod-4 × 3 ($34.99 each) | 104.97 | pending |

**Note:** Seed orders are pre-loaded historical data. They do **not** decrement product inventory. Inventory values in the products table represent current stock.
