# Frontend Build Progress

Tracks every backend API, which ones are wired into the frontend, and feature status.
Backend is read-only reference — see `backend/apps/*` for source of truth if this drifts.

Auth model: httpOnly JWT cookies (`access_token`, `refresh_token`), CSRF token cookie for
unsafe methods. Already wired in `frontend/src/lib/api.js` / `frontend/src/lib/auth.js`.
All list endpoints are paginated: `{count, next, previous, results}` (page_size=20, max 100).

## API Inventory

### Auth & Users — `apps/users` (base path `/api/auth/`, `/api/addresses/`)

| Method | Endpoint | Auth | Purpose | Used in FE? |
|---|---|---|---|---|
| POST | `/api/auth/signup/` | Public | Create account, sets auth cookies | Yes (register page) |
| POST | `/api/auth/signin/` | Public | Login, sets auth cookies | Yes (login page) |
| POST | `/api/auth/logout/` | Public | Blacklist refresh token, clear cookies | Yes (dashboard sidebar) |
| POST | `/api/auth/token/refresh/` | Cookie | Rotate access/refresh cookies | Yes (silent retry-on-401 in `lib/api.js`) |
| POST | `/api/auth/change-password/` | Auth | Change own password | Yes (`/dashboard/change-password`, `/account/set-password`) |
| GET | `/api/auth/me/` | Auth | Current user profile | Yes (`AuthContext`, `/dashboard`) |
| GET/POST | `/api/addresses/` | Auth | List / create own addresses | Yes (`/dashboard/addresses`) |
| GET/PUT/PATCH/DELETE | `/api/addresses/{id}/` | Auth | Manage one address (own only) | Yes (`/dashboard/addresses`) |

### Catalog — `apps/catalog`

| Method | Endpoint | Auth | Purpose | Used in FE? |
|---|---|---|---|---|
| GET | `/api/categories/` | Public | List categories | No |
| GET | `/api/categories/{id}/` | Public | Category detail + nested children | No |
| POST/PUT/PATCH/DELETE | `/api/categories/...` | Staff | Manage categories | No |
| GET | `/api/attributes/` | Public | List attributes (+ nested values) | No |
| POST/PUT/PATCH/DELETE | `/api/attributes/...` | Staff | Manage attributes | No |
| GET | `/api/attribute-values/` | Public | List attribute values | No |
| POST/PUT/PATCH/DELETE | `/api/attribute-values/...` | Staff | Manage attribute values | No |
| GET | `/api/products/` | Public | List products (filters: `category`, `product_type`, `visibility_type`, `status`, `attribute_value`, `min_price`, `max_price`; search: name/description/sku_prefix; ordering: name/created_at) | No |
| GET | `/api/products/{id}/` | Public | Product detail (variations, images, attrs, avg rating, review count) | No |
| GET | `/api/products/{id}/addons/` | Public | Valid add-ons for a product | No |
| POST/PUT/PATCH/DELETE | `/api/products/...` | Staff | Manage products (nested variations on create) | No |
| GET/POST/PUT/PATCH/DELETE | `/api/product-variations/...` | Staff write / public read | Manage variations (sku, price, stock, attrs) | No |
| GET/POST/PUT/PATCH/DELETE | `/api/product-images/...` | Staff write / public read | Manage product/variation images | No |
| GET/POST/PUT/PATCH/DELETE | `/api/product-attribute-values/...` | Staff write / public read | Link attribute values to products | No |
| GET/POST/PUT/PATCH/DELETE | `/api/product-addons/...` | Staff write / public read | Manage addon links between products | No |

### Cart — `apps/cart` (guest via `cart_token` cookie, or logged-in user)

| Method | Endpoint | Auth | Purpose | Used in FE? |
|---|---|---|---|---|
| GET | `/api/cart/` | Public | Current cart (items, subtotal, item_count) | No |
| GET | `/api/cart/items/` | Public | List items in current cart | No |
| POST | `/api/cart/items/` | Public | Add item `{product, variation, quantity}` (merges qty if same line exists) | No |
| GET/PUT/PATCH/DELETE | `/api/cart/items/{id}/` | Public | Manage one cart item | No |
| POST | `/api/cart/items/{id}/addons/` | Public | Attach an addon under a parent cart item | No |

### Orders / Checkout — `apps/orders`

| Method | Endpoint | Auth | Purpose | Used in FE? |
|---|---|---|---|---|
| POST | `/api/checkout/` | Public | Place order from current cart (guest or user; optional `create_account`, `coupon_code`) | No |
| GET | `/api/orders/` | Auth | List own orders (staff see all); filters: `status`, `payment_status` | Yes (`/dashboard/orders`) |
| GET | `/api/orders/{id}/` | Auth | Order detail | Yes (`/dashboard/orders/{id}`) |
| GET/POST/PUT/PATCH/DELETE | `/api/coupons/...` | Staff only | Manage coupons | Yes (`/dashboard/coupons`) |

### Reviews — `apps/reviews`

| Method | Endpoint | Auth | Purpose | Used in FE? |
|---|---|---|---|---|
| GET | `/api/reviews/` | Public | List reviews (filters: `product`, `rating`) | No |
| POST | `/api/reviews/` | Auth | Create review (one per user per product) | No |
| GET | `/api/reviews/{id}/` | Public | Review detail | No |
| PUT/PATCH/DELETE | `/api/reviews/{id}/` | Owner or staff | Edit/delete own review | No |

### Reference only (not app features)

- `GET /api/schema/`, `GET /api/docs/` — OpenAPI schema / Swagger UI, useful as a live shape reference.
- `/admin/` — Django admin, not part of this frontend.

## Decisions

- **Global state**: React Context (AuthContext, CartContext) — no new dependency, sits on top of the existing `lib/api.js` fetch wrapper.
- **Scope**: Customer-facing storefront only for this build. Full catalog backoffice (products, categories, attributes, variations, images, addons) is still out of scope.
- **Role-based dashboard**: nav-only split by `role` (`customer`/`staff`/`admin`) from `/api/auth/me/`. Staff/admin additionally see a Coupons screen; Orders already shows everyone's orders to staff via the backend queryset. Real authorization is still enforced server-side by `is_staff` — see flag below.

## Feature Status

| # | Feature | Status |
|---|---|---|
| 1 | Auth & Session | **Done** |
| 2 | Address Book | **Done** |
| 3 | Product Catalog Browsing | Pending |
| 4 | Product Reviews | Pending |
| 5 | Cart | Pending |
| 6 | Checkout & Orders | Pending |
| 7 | Order History | **Done** |

Out of scope for now: Staff/Admin Catalog Management, Staff/Admin Coupon Management.

## Flagged for backend team

- No password-reset ("forgot password") endpoint exists. The login page has a "Forgot password?"
  link pointing at `/forgot-password`, which I have not built — there's nothing to wire it to.
  Left as-is pending your call (add a backend endpoint, or remove the link for now).
- `UserSerializer` (used by `/api/auth/me/`) has `read_only_fields = fields` — there is no way to
  update name/phone from the API. The profile page I built is read-only display for this reason.
  Flag if profile editing is wanted later.
- `UserSerializer` exposes `role` but not `is_staff`. The dashboard's role-based nav (customer vs
  staff/admin) can only key off `role`, but staff-only endpoints (coupons, catalog writes) actually
  check `is_staff`, a separate field with no guaranteed sync to `role`. Not a blocker — the backend
  still enforces the real check and 403s regardless — but a `role="staff"` account with
  `is_staff=False` would see the Coupons nav item and then get a 403 using it. Worth adding
  `is_staff` to the serializer if precise gating matters later.
