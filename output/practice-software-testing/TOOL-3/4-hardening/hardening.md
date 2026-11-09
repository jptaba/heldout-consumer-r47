# Hardening log — TOOL-3
**Tiers used:** tier 3 only (`heldout inspect` walks P3, P4 and `heldout api-probe` P1, P2, P5, P6). Tiers 1 and 2 were not used: the session's folder is not the project, so no IDE browser or native Playwright MCP browser was usable for it, and the inspector answered every question.
**AUT profile:** practice-software-testing — http://localhost:4200/ · http://localhost:8091/ · **Date:** 2026-11-09

## UI locators
| Test(s) | Element | Draft locator | Hardened locator | Verified (probe) | Evidence |
| --- | --- | --- | --- | --- | --- |
| SCN-004, SCN-005 (via `openProduct`) | product page readiness | `getByTestId('product-name')` on `/product/{id}` | unchanged | 1 match, visible | P3 |
| SCN-004, SCN-005 (via `addToCartOnPage`) | quantity control | `getByTestId('quantity')` | unchanged | 1 match, a number field | P3 |
| SCN-004, SCN-005 (via `addToCartOnPage`) | "Add to cart" button | `getByTestId('add-to-cart')` | unchanged | 1 match, text "Add to cart" | P3 |
| SCN-004 (via `cartIconCount`) | cart icon count | `getByTestId('cart-quantity')` | unchanged | 1 match | P3 |
| SCN-005 (via `openCartPage`, `cartPageRows`) | cart page rows, name, quantity, unit price, line total | `/checkout`, `table tbody tr`, `product-title`, `product-quantity`, `product-price`, `line-price` | unchanged | one row per product (2 for 2), one of each test id per row | P4 |
| SCN-005 (via `cartTotal`) | cart total | `getByTestId('cart-total')` | unchanged | 1 match | P4 |

## API mechanics
| Item | Verified | Evidence |
| --- | --- | --- |
| G1 read a cart: `GET /carts/{id}`, lines in `cart_items[]` with `product_id` and `quantity` | 200, empty list for a new cart, one line after an add, empty after a remove; 404 for a missing cart | P2 |
| G2 delete a cart: `DELETE /carts/{id}` | 204, empty body | P2 |
| Error answers `{message}`, validation `{message, errors: {quantity: [...]}}` | 422 for quantity 0 | P2 |
| A made-up cart id (digits to 9, letters to z, the lowercase ULID format) reads as no cart | 404 on GET and DELETE | P5, P6 |
| G5 products in stock: `in_stock` boolean on each product of `GET /products` | present, true or false | P1 |
| The web shop's add: `POST /carts` on the first add, then `POST /carts/{id}` `{product_id, quantity}`; cart id in sessionStorage `cart_id` | as the journey's wait expects | P3 |

## Journeys (reused, fixed, added)
| Journey | Change | Why | Evidence |
| --- | --- | --- | --- |
| all of `journeys/fixtures/carts.ts` (19 marks) | marks removed, code unchanged | every guess confirmed | P2, P3, P4, P5 |
| `api.products.products-in-stock`, `ui.products.open-product` (3 marks) | marks removed, code unchanged | confirmed | P1, P3 |
| `ui.products.*`, `api.products.read-products` (proven by TOOL-5) | reused, not probed | the harden run passed through them | run 01-harden |

## Mechanics changed (non-locator)
- `rowOf` in the spec (a helper, no assertion): it matched a row by `name.includes(...)`, so the product "Pliers" found the row of "Combination Pliers" (both are the first two products in stock) and SCN-005 read the wrong row's quantity. It now takes the exact name first and falls back to the substring. Re-run of SCN-005 ×3: passed (02-harden).
- Contract gaps G1–G5 resolved (discovered-in-aut). The contract's endpoint list was left as reviewed.

## Observed deviations (assertions intentionally left unchanged)
| Test | Requirement says | AUT shows | Evidence |
| --- | --- | --- | --- |
| SCN-016 (AC-7, assumes G6) | deleting a cart that was already deleted answers 204 | 404 `{message: "Cart doesnt exists"}` | P2 step 9, run 01-harden |
| SCN-008.2 (AC-8) | removing a product from a cart that does not exist: 404 "Cart not found" | 404 "Cart doesnt exists" | run 01-harden |
| SCN-008.3 (AC-8) | reading a cart that does not exist: 404 "Cart not found" | 404 "Requested item not found" | P2 step 10, run 01-harden |
| SCN-008.4 (AC-8) | deleting a cart that never existed: 404 "Cart not found" | 404 "Cart doesnt exists" | P6, run 01-harden |

## Stability
- 01-harden, `--repeat-each 3 --workers 2`: 51 passed, 15 failed (the 5 tests above ×3: 4 deviations, 1 script defect in `rowOf`), 0 flaky.
- 02-harden, SCN-005 after the repair, same flags: 3 passed.
- Test data: every cart the runs made was deleted (the 9 "kept by design" are carts the tests had already deleted); the carts of walks P3 and P4 were deleted by hand.
- `heldout integrity TOOL-3`: PRESERVED (40 REQ assertions → 40).

**Guesses confirmed unchanged** (`heldout confirm`):
- journeys/fixtures/carts.ts: 19 guess(es) confirmed as drafted — P2 (cart API: read, delete, lines, errors), P3 (product page add to cart, cart icon), P4 (cart page rows and total), P5 (made-up cart id reads as no cart)
- journeys/fixtures/products.ts: 3 guess(es) confirmed as drafted — P1 (in_stock on GET /products), P3 (product page route and product-name anchor)
