# Shordindu API Guide

A reference for the frontend (Next.js) to integrate against the Django backend. Covers every
endpoint that exists as of Module 8. Interactive, always-current docs are also available at
`/api/docs/` (Swagger UI) once the backend is running — use this guide for the concepts and
gotchas that Swagger won't tell you (cookies, nesting, guest-cart flow).

## 1. Base setup

- **Base URL (dev)**: `http://localhost:8000/api/`
- **Admin**: `http://localhost:8000/admin/`
- **Swagger UI**: `http://localhost:8000/api/docs/`

### Auth model — read this first

Auth is **cookie-based, not token-based**. On signup/signin, the backend sets two `httpOnly`
cookies (`access_token`, `refresh_token`) — they are never present in the JSON response body,
and JavaScript cannot read them (that's the point — it defeats XSS token theft).

This means:

- Every `fetch`/`axios` call to the API **must** send `credentials: 'include'` (fetch) or
  `withCredentials: true` (axios), or the browser won't attach the cookies.
- There is nothing to store in `localStorage` or Redux for auth — just track "am I logged in"
  via the response of `GET /api/auth/me/` (200 = logged in, 401 = not).
- CORS on the backend is locked to `CORS_ALLOWED_ORIGINS` (`http://localhost:3000` in dev) with
  `credentials: true`. If the frontend runs on a different port, ask the backend to add it to
  `.env`'s `CORS_ALLOWED_ORIGINS`.

### Content types

- Almost everything is `application/json`.
- Endpoints that accept a file (category image, product image, review image) need
  `multipart/form-data` — use `FormData` in the browser, don't JSON.stringify.

### Pagination

Every list endpoint (`GET` on a collection) is paginated:

```json
{
  "count": 42,
  "next": "http://localhost:8000/api/products/?page=2",
  "previous": null,
  "results": [ /* ... */ ]
}
```

Default page size is 20. Override with `?page_size=50` (max 100).

### Errors

DRF's default shape. Field-specific errors are keyed by field name; general errors use
`non_field_errors` or `detail`:

```json
{ "email": ["This field is required."] }
{ "non_field_errors": ["Invalid email or password."] }
{ "detail": "Not found." }
```

Status codes: `400` validation, `401` not authenticated, `403` authenticated but not allowed,
`404` not found / not yours.

### Read vs. write permissions, at a glance

| Resource | Read | Write |
|---|---|---|
| Categories, Attributes, Products, Addons | anyone | staff only |
| Cart | anyone (guest or logged in) | anyone (scoped to their own cart) |
| Addresses | owner only | owner only |
| Orders | owner only (staff see all) | system-created only (via checkout) |
| Coupons | staff only | staff only |
| Reviews | anyone | logged-in users (own review only to edit/delete) |

---

## 2. Auth & Users

Base path: `/api/auth/`

### Sign up
`POST /api/auth/signup/`
```json
{ "email": "a@b.com", "name": "Ayesha", "phone": "01700000000", "password": "StrongPass123!" }
```
→ `201`, sets auth cookies, body is the user object (see below). `phone` is optional.

### Sign in
`POST /api/auth/signin/`
```json
{ "email": "a@b.com", "password": "StrongPass123!" }
```
→ `200`, sets auth cookies, same user object body.

### Sign out
`POST /api/auth/logout/` → `205`, clears cookies, blacklists the refresh token.

### Refresh
`POST /api/auth/token/refresh/` (empty body — reads the `refresh_token` cookie) → `200`, rotates
both cookies. Call this when a request comes back `401` and retry the original request once.
Returns `401` itself if the refresh token is expired/blacklisted — at that point, treat the user
as logged out.

### Who am I
`GET /api/auth/me/` (auth required) → `200` with the user object, or `401` if not logged in.
**This is the endpoint to call on app load to determine auth state.**

User object shape (same on signup/signin/me):
```json
{
  "id": 5,
  "email": "a@b.com",
  "name": "Ayesha",
  "phone": "01700000000",
  "role": "customer",
  "force_password_change": false,
  "created_at": "2026-08-19T10:30:00Z"
}
```
- `role`: `customer` | `staff` | `admin`
- `force_password_change`: `true` for accounts auto-created during guest checkout. **If true,
  redirect the user to a "set a new password" screen right after login**, using the endpoint
  below.

### Change password
`POST /api/auth/change-password/` (auth required)
```json
{ "old_password": "...", "new_password": "..." }
```
→ `200`. Clears `force_password_change` automatically.

---

## 3. Addresses

Base path: `/api/addresses/` — standard REST (`GET` list, `POST` create, `GET/PATCH/DELETE
/:id/`). Auth required; always scoped to the logged-in user (no `user` field to set).

```json
{ "id": 1, "name": "Ayesha", "phone": "01700000000", "address": "House 4, Road 2, Dhanmondi", "district": "Dhaka", "is_default": false }
```

Note the address model is intentionally minimal — just `name`, `phone`, `address` (free text),
`district`, `is_default`. No line1/line2/city/postal_code/country. Setting `is_default: true`
automatically unsets any other default address for that user.

---

## 4. Catalog

### Categories — `/api/categories/`

```json
{ "id": 3, "name": "Sharee", "slug": "sharee", "image": "http://.../media/categories/x.jpg", "parent": null, "description": "..." }
```

- `parent`: id of another category, or `null` for top-level.
- **List/create response** does not include `children`. **Retrieve** (`GET /:id/`) *does*
  include a `children` array (one level of nested subcategories) — use retrieve when building a
  category tree.
- Creating with an image: multipart form, field name `image`.

### Attributes & values — `/api/attributes/`, `/api/attribute-values/`

```json
{ "id": 1, "name": "Size", "values": [
  { "id": 1, "attribute": 1, "value": "Unstitch", "sort_order": 1 },
  { "id": 2, "attribute": 1, "value": "32", "sort_order": 2 }
]}
```
Attribute values are also directly reachable/writable at `/api/attribute-values/` (needs
`attribute` id in the payload).

### Products — `/api/products/`

The big one. Full shape:

```json
{
  "id": 1,
  "category": 3,
  "category_name": "Dress",
  "name": "ABC Dress",
  "slug": "abc-dress",
  "description": "...",
  "product_type": "variable",
  "visibility_type": "standalone",
  "status": "active",
  "sku_prefix": "ABCDRS",
  "attribute_values": [
    { "id": 1, "product": 1, "attribute_value": 1, "attribute": "Size", "value": "Unstitch" }
  ],
  "variations": [
    {
      "id": 1, "product": 1, "sku": "ABCDRS-UNSTITCH",
      "price": "1500.00", "compare_at_price": null,
      "stock_quantity": 10, "is_active": true,
      "attribute_values": [ { "attribute_value": 1, "attribute": "Size", "value": "Unstitch" } ],
      "images": []
    }
  ],
  "images": [ { "id": 1, "product": 1, "variation": null, "image": "http://.../x.jpg", "alt_text": "", "sort_order": 0, "is_primary": true } ],
  "average_rating": 4.5,
  "review_count": 2,
  "created_at": "...", "updated_at": "..."
}
```

- `product_type`: `simple` | `variable`. `visibility_type`: `standalone` | `addon_only` | `both`.
  `status`: `draft` | `active` | `archived`.
- **`GET /api/products/` (list) excludes `addon_only` products.** Those only ever appear via a
  parent's addon endpoint (below) or by fetching their own detail id directly.
- **Simple products still have exactly one variation** — a "default" SKU created automatically
  if you don't supply one on creation. There is no such thing as a variation-less product; always
  read price/stock from `variations[0]` even for simple products.
- `average_rating` is `null` (not `0`) when there are no reviews yet.

**Filtering & search** (all query params on `GET /api/products/`):

| Param | Example | Notes |
|---|---|---|
| `category` | `?category=3` | exact category id |
| `product_type` | `?product_type=simple` | |
| `visibility_type` | `?visibility_type=standalone` | |
| `status` | `?status=active` | |
| `attribute_value` | `?attribute_value=1` | products that offer this attribute value |
| `min_price` / `max_price` | `?min_price=500&max_price=2000` | filters on variation price |
| `search` | `?search=dress` | matches name, description, sku_prefix |
| `ordering` | `?ordering=-created_at` | or `name`, `created_at` (prefix `-` for desc) |

Combine freely, e.g. `?category=3&min_price=1000&search=silk&ordering=-created_at`.

### Product addons

`GET /api/products/{id}/addons/` — returns everything linked as an addon to that product,
**regardless of the addon's own `visibility_type`** (this is the intended way to reach an
`addon_only` product):

```json
[
  {
    "id": 1, "parent_product": 1, "addon_product": 4,
    "addon_product_detail": { /* full product object, see above */ },
    "is_required": false, "min_select": 0, "max_select": 1, "price_override": null, "sort_order": 1
  }
]
```

Managing the links themselves (staff only): `/api/product-addons/` (standard CRUD, needs
`parent_product` + `addon_product` ids).

### Variations & images (standalone endpoints)

- `/api/product-variations/` — CRUD for a single SKU. Needs `product` id on create. Use this to
  restock (`PATCH` `stock_quantity`) or reprice an existing variation.
- `/api/product-images/` — multipart CRUD (`product`, optional `variation`, `image`, `alt_text`,
  `sort_order`, `is_primary`).
- `/api/product-attribute-values/` — which attribute values a product *offers* (separate from
  which combination a specific variation *is* — see `variation.attribute_values` above).

---

## 5. Cart

Base path: `/api/cart/`. Works identically for guests and logged-in users — **no special-casing
needed on the frontend.**

### How the guest cart works

The first time an unauthenticated visitor adds something to their cart, the backend sets an
`httpOnly` cookie `cart_token` (scoped to path `/`). Every subsequent cart request from that
browser (with `credentials: 'include'`) automatically resolves back to the same cart — there's
nothing to read, store, or pass manually. **When that visitor signs up or signs in, their guest
cart is automatically merged into their account cart** (addon nesting preserved) and the
`cart_token` cookie is cleared. Just call signin/signup normally; the merge is transparent.

### Get the cart
`GET /api/cart/`
```json
{
  "id": 2,
  "items": [
    {
      "id": 3, "product": 1, "product_name": "ABC Dress", "variation": 1, "variation_sku": "ABCDRS-UNSTITCH",
      "quantity": 2, "unit_price_snapshot": "1500.00", "line_total": 3000.0,
      "parent_cart_item": null,
      "children": [
        { "id": 4, "product": 4, "product_name": "PQR Pant", "variation": 7, "variation_sku": "PQRPNT-DEFAULT",
          "quantity": 1, "unit_price_snapshot": "600.00", "line_total": 600.0,
          "parent_cart_item": 3, "children": [] }
      ]
    }
  ],
  "subtotal": 3600.0,
  "item_count": 3,
  "created_at": "..."
}
```
`items` only lists **top-level** lines; addons are nested under `children`. `item_count` sums
quantities (addons included), so 2 dresses + 1 pant = 3 above.

### Add an item
`POST /api/cart/items/`
```json
{ "product": 1, "variation": 1, "quantity": 1 }
```
→ `201` if it's a new line, or `200` if it matched an existing top-level line (quantity just got
bumped — check the status code if you need to distinguish "added" vs "incremented" in the UI).

### Update / remove an item
`PATCH /api/cart/items/{id}/` with `{ "quantity": 3 }`, or `DELETE /api/cart/items/{id}/`.
Deleting a parent line cascades and removes its addon children too.

### Add an addon under a specific line
`POST /api/cart/items/{parent_item_id}/addons/`
```json
{ "product": 4, "variation": 7, "quantity": 1 }
```
`product` must actually be linked as an addon of the **parent item's product** (via
`/api/products/{parent_product_id}/addons/` — check that first to know what's offerable), or
this returns `400`. Also enforces the addon link's `max_select`.

---

## 6. Checkout & Orders

### Checkout
`POST /api/checkout/` — builds an order from **whatever is currently in the cart** (you don't
pass line items; it reads the same cart `GET /api/cart/` would show). Payment method is fixed to
Cash on Delivery for now.

Three shapes depending on who's checking out:

**A. Logged in, using a saved address:**
```json
{ "shipping_address_id": 5 }
```

**B. Logged in, new address (gets saved to the account):**
```json
{ "shipping_name": "Ayesha", "shipping_phone": "017...", "shipping_address": "House 4, Road 2", "shipping_district": "Dhaka" }
```

**C. Guest — no account:**
```json
{
  "email": "guest@example.com", "create_account": false,
  "shipping_name": "Ayesha", "shipping_phone": "017...",
  "shipping_address": "House 4, Road 2", "shipping_district": "Dhaka"
}
```

**D. Guest — auto-create an account:**
Same as C but `"create_account": true`. The backend generates a password, emails it to them,
creates the account with `force_password_change: true`, **and logs them in immediately**
(same auth cookies as signin) — check `response.ok` and then treat the frontend as authenticated
right away; no separate login step needed. Show them a "we made you an account, check your
email" message.

All four accept an optional `"coupon_code": "SAVE10"`.

Response (`201`) is a full order object:
```json
{
  "id": 3, "order_number": "ORD20260819292683",
  "user": 6, "guest_email": null,
  "status": "pending",
  "subtotal": "6000.00", "discount_total": "600.00", "shipping_total": "0.00", "tax_total": "0.00", "grand_total": "5400.00",
  "shipping_address": 5, "shipping_address_detail": { /* address object */ },
  "billing_address": 5,
  "payment_status": "unpaid",
  "placed_at": "...",
  "items": [ /* same nested shape as cart items — parent_order_item / children */ ],
  "payments": [ { "id": 3, "method": "cod", "transaction_id": "", "amount": "5400.00", "status": "pending", "paid_at": null } ],
  "coupons": [ { "coupon": 1, "code": "SAVE10", "discount_amount": "600.00" } ]
}
```
An invalid coupon code fails the whole checkout with `400 {"coupon_code": [...]}` — nothing is
created, cart is untouched, safe to let the user fix the code and resubmit.

`status`: `pending` | `processing` | `shipped` | `delivered` | `cancelled`.
`payment_status`: `unpaid` | `paid` | `refunded`.

### Order history
`GET /api/orders/` (auth required) — the caller's own orders (staff accounts see everyone's).
Filterable: `?status=pending`, `?payment_status=unpaid`. `GET /api/orders/{id}/` for one order.

### Coupons
`/api/coupons/` — **staff only**, both read and write (customers never browse available coupons;
they just type a code at checkout and the checkout endpoint validates it).

---

## 7. Reviews

Base path: `/api/reviews/`. Public read, auth required to write, and **one review per user per
product** (a second `POST` for the same product returns `400 non_field_errors`).

```json
{ "id": 1, "product": 1, "user_name": "Ayesha", "rating": 5, "comment": "Great!", "image": "http://.../reviews/x.jpg", "created_at": "..." }
```

- `rating`: integer 1–5.
- `image`: optional — send as multipart if attaching one, otherwise omit.
- `user_name` is filled in automatically from the account; there's no `user` field to set.
- Only the review's author (or staff) can `PATCH`/`DELETE` it — others get `403`.
- Filter: `?product=1`, `?rating=5`.
- Product detail (`/api/products/{id}/`) carries `average_rating` and `review_count` computed
  live — no need to fetch all reviews just to show a star rating on a product card.

---

## 8. Full endpoint index

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/signup/` | — |
| POST | `/api/auth/signin/` | — |
| POST | `/api/auth/logout/` | — |
| POST | `/api/auth/token/refresh/` | — |
| POST | `/api/auth/change-password/` | ✓ |
| GET | `/api/auth/me/` | ✓ |
| GET/POST/PATCH/DELETE | `/api/addresses/[:id/]` | ✓ |
| GET/POST/PATCH/DELETE | `/api/categories/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/attributes/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/attribute-values/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/products/[:id/]` | read: —, write: staff |
| GET | `/api/products/:id/addons/` | — |
| GET/POST/PATCH/DELETE | `/api/product-variations/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/product-images/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/product-attribute-values/[:id/]` | read: —, write: staff |
| GET/POST/PATCH/DELETE | `/api/product-addons/[:id/]` | read: —, write: staff |
| GET | `/api/cart/` | — |
| GET/POST/PATCH/DELETE | `/api/cart/items/[:id/]` | — |
| POST | `/api/cart/items/:id/addons/` | — |
| POST | `/api/checkout/` | — |
| GET | `/api/orders/[:id/]` | ✓ |
| GET/POST/PATCH/DELETE | `/api/coupons/[:id/]` | staff only |
| GET/POST/PATCH/DELETE | `/api/reviews/[:id/]` | read: —, write: ✓ (own only) |

("—" = no auth needed; "✓" = must be logged in)

---

## 9. Media / images

In dev, uploaded images are served from `http://localhost:8000/media/...` — the URLs returned in
API responses are already absolute, so just use them directly in `<img src>`. In production
these will point at S3 instead (same field, same usage — nothing changes on the frontend side).

---

## 10. Known gaps (not bugs, just not built yet)

- No SSLCommerz/bKash — checkout is Cash on Delivery only.
- No search/filter beyond what's listed above (no full-text search engine, no faceted nav).
- No rate limiting on auth endpoints yet.
- No automated backend test suite yet — treat responses as documented here, but flag anything
  that doesn't match what you see from `/api/docs/`.
