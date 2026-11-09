# Held-out Evaluation Verdict — TOOL-3

> **Verdict: ❌ FAIL** — 2 application defect(s) reproduced by the evaluator: the AUT does not satisfy AC-7, AC-8. Awaiting reviewer confirmation.

| | |
| --- | --- |
| Story | [TOOL-3](https://jira.example.com/browse/TOOL-3) — Shopping cart for guests |
| Application under test | Practice Software Testing (profile `practice-software-testing`) — UI http://localhost:4200/ · API http://localhost:8091/ |
| Final run | `03-eval` · 2026-11-09T12:09:10.993Z · 9s |
| Tests | 22 total · 18 passed · 4 failed · 0 flaky · 0 skipped (from 17 scenarios) |
| Held-out integrity | ✅ PRESERVED — 40 requirement assertions identical to the pre-hardening draft |
| Hardening | tier 3 only (heldout inspect walks P3, P4 and heldout api-probe P1, P2, P5, P6). |
| Journeys | 22 journey(s) from journeys/fixtures/ (1 proven by earlier stories, 21 new to the registry) |
| Evaluator | Opus — heldout-evaluator skill |
| Generated | 2026-11-09T12:11:26.339Z |

> This verdict is the evaluator's **recommendation**. Each finding below has requirement traceability, reproduction steps and evidence, so a reviewer can confirm or reject it. Nothing has been raised in Jira; the only Jira activity is this report and a summary comment on the story.

## Findings summary

| ID | Suggested severity | Criteria | Test type | Finding | Tests | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| APP-1 | Major | AC-7 | idempotency | Deleting an already deleted cart answers 404 'Cart doesnt exists' | SCN-016 | ☐ confirm · ☐ reject · ☐ clarify |
| APP-2 | Minor | AC-8 | negative | Requests for a missing cart answer 404 without the message 'Cart not found' | SCN-008.2, SCN-008.3, SCN-008.4 | ☐ confirm · ☐ reject · ☐ clarify |

## Findings: suspected application defects (2 root cause(s), 4 failing test(s))

### APP-1 · SCN-016 · AC-7 — Deleting an already deleted cart answers 404 'Cart doesnt exists'

| | |
| --- | --- |
| Suggested severity | Major |
| Requirement AC-7 | Deleting a cart responds 204 and is idempotent: deleting a cart that was already deleted also responds 204. |
| Requirement source | story.md#L27 |
| Test type · layer | idempotency · api |
| SCN-016: expected (requirement) → actual (AUT) | `204` → `404` |
| Failing step | Then the second delete answers 204 too |
| Evaluator classification | APPLICATION_DEFECT (reproduced live) |

#### How to reproduce

**Preconditions the test seeded** (tag `hldout7xh3y100`; recreate equivalent data before reproducing):

- a cart (POST /carts): `01m703czzsnxyghpz0c620zr2w` · cleanup: done

**Manually (the test's steps):**

1. Given a guest's cart
2. When I delete the cart
3. When I delete the same cart again
4. Then the second delete answers 204 too

**API pre-steps: SCN-016** (preconditions the test established through the API; run these first, then substitute the ids and tokens they return):

P1. `POST /carts → 201`

   ```bash
   curl -i -X POST 'http://localhost:8091/carts' \
     -H 'Cache-Control: no-cache'
   ```

**Via the API: SCN-016** (the exact requests the test sent, in order; secrets replaced by placeholders). Request 2 (⟵) is the one that contradicts the requirement:

1. `DELETE /carts/01m703czzsnxyghpz0c620zr2w → 204`

   ```bash
   curl -i -X DELETE 'http://localhost:8091/carts/01m703czzsnxyghpz0c620zr2w'
   ```

2. `DELETE /carts/01m703czzsnxyghpz0c620zr2w → 404` ⟵

   ```bash
   curl -i -X DELETE 'http://localhost:8091/carts/01m703czzsnxyghpz0c620zr2w'
   ```

Observed response of request 2 (SCN-016):

```json
{"message":"Cart doesnt exists"}
```

**Automated re-run of the failing test(s):**

```bash
npm run heldout -- run TOOL-3 --label repro --grep "SCN-016:"
```

#### Evidence

- Step-by-step trace, while the run's raw output is kept: `npx playwright show-trace .heldout/practice-software-testing/TOOL-3/5-run/03-eval/artifacts/practice-software-testing--8647b-dy-deleted-also-answers-204-chromium-retry1/trace.zip`
- Live re-check by the evaluator: P7: chain on 2026-11-09 (api-probe, visitor): step 2 DELETE /carts/{id} -> 204; step 6 DELETE /carts/{id} again -> 404 {message: 'Cart doesnt exists'}

**Evaluator's analysis:** AC-7 requires a repeat delete of a deleted cart to answer 204 (idempotent); AC-8 requires any request for a missing cart to answer 404 'Cart not found'; G6 (assumed AC-7 wins) is open. Replayed live: the first DELETE answered 204, the second DELETE of the same cart answered 404 {message: 'Cart doesnt exists'}. That is wrong under either reading of G6: under AC-7 the status should be 204, under AC-8 the message should be 'Cart not found'. Hence --any-reading. Major: the idempotency the requirement names is not met (a client can treat the 404 as done).

**Reviewer decision:** ☐ Confirm as defect · ☐ Not a defect (explain) · ☐ Requirement needs clarification

### APP-2 · SCN-008.2, SCN-008.3, SCN-008.4 · AC-8 — Requests for a missing cart answer 404 without the message 'Cart not found'

| | |
| --- | --- |
| Suggested severity | Minor |
| Requirement AC-8 | Any request for a cart that does not exist responds 404 with the message "Cart not found". |
| Requirement source | story.md#L28 |
| Test type · layer | negative · api |
| SCN-008.2: expected (requirement) → actual (AUT) | `"Cart not found"` → `"Cart doesnt exists"` |
| SCN-008.3: expected (requirement) → actual (AUT) | `"Cart not found"` → `"Requested item not found"` |
| SCN-008.4: expected (requirement) → actual (AUT) | `"Cart not found"` → `"Cart doesnt exists"` |
| Failing step | Then the answer is 404 with the message "Cart not found" |
| Evaluator classification | APPLICATION_DEFECT (reproduced live) |

#### How to reproduce

**Preconditions the test seeded** (tag `hldout7xda540`; recreate equivalent data before reproducing):

- a cart that was deleted (POST /carts, then delete it): `01m703cv57dfq3dp904rzcr2bz` · cleanup: none

**Manually (the test's steps):**

1. Given a cart id that no cart has (${row.cart}) and a product in stock
2. When I send the request for ${row.what} that cart
3. Then the answer is 404 with the message "Cart not found"

**API pre-steps: SCN-008.2** (preconditions the test established through the API; run these first, then substitute the ids and tokens they return):

P1. `POST /carts → 201`

   ```bash
   curl -i -X POST 'http://localhost:8091/carts' \
     -H 'Cache-Control: no-cache'
   ```

P2. `DELETE /carts/01m703cv57dfq3dp904rzcr2bz → 204`

   ```bash
   curl -i -X DELETE 'http://localhost:8091/carts/01m703cv57dfq3dp904rzcr2bz' \
     -H 'Cache-Control: no-cache'
   ```

P3. `GET /products → 200`

   ```bash
   curl -i -X GET 'http://localhost:8091/products' \
     -H 'Cache-Control: no-cache'
   ```

**Via the API: SCN-008.2** (the exact requests the test sent, in order; secrets replaced by placeholders). Request 1 (⟵) is the one that contradicts the requirement:

1. `DELETE /carts/01m703cv57dfq3dp904rzcr2bz/product/01M6J4V5A5A5NAWMENSCT6KC99 → 404` ⟵

   ```bash
   curl -i -X DELETE 'http://localhost:8091/carts/01m703cv57dfq3dp904rzcr2bz/product/01M6J4V5A5A5NAWMENSCT6KC99'
   ```

Observed response of request 1 (SCN-008.2):

```json
{"message":"Cart doesnt exists"}
```

The other 2 test(s) of this finding fail the same way; each one's requests are in the run's record, output/practice-software-testing/TOOL-3/5-run/03-eval.json.

**Automated re-run of the failing test(s):**

```bash
npm run heldout -- run TOOL-3 --label repro --grep "SCN-008\.2:"
npm run heldout -- run TOOL-3 --label repro --grep "SCN-008\.3:"
npm run heldout -- run TOOL-3 --label repro --grep "SCN-008\.4:"
```

#### Evidence

- Step-by-step trace, while the run's raw output is kept: `npx playwright show-trace .heldout/practice-software-testing/TOOL-3/5-run/03-eval/artifacts/practice-software-testing--a63d2-answers-404-Cart-not-found--chromium-retry1/trace.zip`
- Live re-check by the evaluator: P7: chain on 2026-11-09 (api-probe, visitor): step 3 POST /carts/{deleted} -> 404 'Cart not found' (control); step 4 DELETE /carts/{deleted}/product/{id} -> 404 'Cart doesnt exists'; steps 5 and 8 GET /carts/{deleted\|never created} -> 404 'Requested item not found'; step 7 DELETE /carts/{never created} -> 404 'Cart doesnt exists'

**Evaluator's analysis:** AC-8 requires every request for a cart that does not exist to answer 404 with the message 'Cart not found'. Replayed live: the status is 404 everywhere, and adding a product to a deleted cart (the control, SCN-008.1's call) says 'Cart not found' as required, so the test's mechanics and message reading are right. Removing a product from a deleted cart and deleting a never-created cart answer {message: 'Cart doesnt exists'}; reading a deleted or never-created cart answers {message: 'Requested item not found'}. The requirement's wording is not met on three of the four endpoints; status and content are correct, so Minor (wording).

**Reviewer decision:** ☐ Confirm as defect · ☐ Not a defect (explain) · ☐ Requirement needs clarification

## Script defects found and repaired (0)

_None confirmed with triage (other mechanics fixed during hardening are in the hardening log)._

## Test results

| Test | Title | Criteria | Type | Result | Classification |
| --- | --- | --- | --- | --- | --- |
| SCN-001 | A guest creates a cart and gets its id, and the cart is empty | AC-1 | functional | ✅ passed | - |
| SCN-002 | A guest adds a product to a cart | AC-2 | functional | ✅ passed | - |
| SCN-003.1 | A quantity of 0 is rejected with 422 | AC-3 | boundary | ✅ passed | - |
| SCN-003.2 | A quantity of 100 is rejected with 422 | AC-3 | boundary | ✅ passed | - |
| SCN-004 | A guest adds a product on its page and is told it was added | AC-4 | functional | ✅ passed | - |
| SCN-005 | The cart page lists each product with its quantity and unit price, and a cart total | AC-5 | functional | ✅ passed | - |
| SCN-006 | A guest removes a product from a cart | AC-6 | functional | ✅ passed | - |
| SCN-007 | A guest deletes a cart | AC-7 | functional | ✅ passed | - |
| SCN-008.1 | adding a product to a cart that does not exist (deleted) answers 404 "Cart not found" | AC-8 | negative | ✅ passed | - |
| SCN-008.2 | removing a product from a cart that does not exist (deleted) answers 404 "Cart not found" | AC-8 | negative | ❌ failed | APPLICATION_DEFECT · APP-2 |
| SCN-008.3 | reading a cart that does not exist (deleted) answers 404 "Cart not found" | AC-8 | negative | ❌ failed | APPLICATION_DEFECT · APP-2 |
| SCN-008.4 | deleting a cart that does not exist (never created) answers 404 "Cart not found" | AC-8 | negative | ❌ failed | APPLICATION_DEFECT · APP-2 |
| SCN-009.1 | A quantity of 1 is accepted | AC-2 | boundary | ✅ passed | - |
| SCN-009.2 | A quantity of 99 is accepted | AC-2 | boundary | ✅ passed | - |
| SCN-010 | Adding a product already in the cart again increases its quantity by the amount added | AC-2 | idempotency | ✅ passed | - |
| SCN-011 | A rejected quantity comes with an error for the quantity field | AC-3 | negative | ✅ passed | - |
| SCN-012 | A rejected quantity leaves the cart unchanged | AC-3 | negative | ✅ passed | - |
| SCN-013 | The cart icon shows the total number of items in the cart | AC-4 | functional | ✅ passed | - |
| SCN-014 | Each line total on the cart page is price × quantity | AC-5 | functional | ✅ passed | - |
| SCN-015 | The cart total on the cart page is the sum of the line totals | AC-5 | functional | ✅ passed | - |
| SCN-016 | Deleting a cart that was already deleted also answers 204 | AC-7 | idempotency | ❌ failed | APPLICATION_DEFECT · APP-1 |
| SCN-017 | A guest's cart from creation to deletion | AC-1, AC-2, AC-6, AC-7, AC-8 | composition | ✅ passed | - |

## Requirement coverage

| Criterion | Requirement | Tests | Result |
| --- | --- | --- | --- |
| AC-1 | POST /carts creates an empty cart and responds 201 with its id. | SCN-001, SCN-017 | ✅ met |
| AC-2 | POST /carts/{id} with product_id and a quantity from 1 to 99 adds the product (200); adding a product already in the cart increases its quantity by the amount added. | SCN-002, SCN-009.1, SCN-009.2, SCN-010, SCN-017 | ✅ met |
| AC-3 | A quantity outside 1–99 is rejected with 422 and an error for the quantity field; the cart is unchanged. | SCN-003.1, SCN-003.2, SCN-011, SCN-012 | ✅ met |
| AC-4 | On a product page, choosing a quantity and pressing "Add to cart" shows "Product added to shopping cart." and the cart icon in the navigation shows the total number of items. | SCN-004, SCN-013 | ✅ met |
| AC-5 | The cart page (checkout step 1) lists each product with its quantity, unit price and line total (price × quantity), and the cart total. | SCN-005, SCN-014, SCN-015 | ✅ met |
| AC-6 | DELETE /carts/{id}/product/{productId} removes the product (204); the cart no longer lists it. | SCN-006, SCN-017 | ✅ met |
| AC-7 | Deleting a cart responds 204 and is idempotent: deleting a cart that was already deleted also responds 204. | SCN-007, SCN-016, SCN-017 | ❌ not met |
| AC-8 | Any request for a cart that does not exist responds 404 with the message "Cart not found". | SCN-008.1, SCN-008.2, SCN-008.3, SCN-008.4, SCN-017 | ❌ not met |

## Traceability matrix

Each row links an acceptance criterion to the requirement source it came from, the scenario that proves it, that scenario's test type and layer, the executed tests, the result and any defect. Every test carries `@AC-n` and `@type:<t>` tags (enforced by the preflight lint).

| Criterion | Source | Scenario | Type | Layer | Tests passed | Result | Defects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **AC-1** | story.md#L21 | SCN-001 A guest creates a cart and gets its id, and the cart is empty | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28 | SCN-017 A guest's cart from creation to deletion | composition | api | 1/1 | ✅ meets requirement | - |
| **AC-2** | story.md#L22 | SCN-002 A guest adds a product to a cart | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L22 | SCN-009 A quantity of … is accepted | boundary | api | 2/2 | ✅ meets requirement | - |
| ↳ | story.md#L22 | SCN-010 Adding a product already in the cart again increases its quantity by the amount added | idempotency | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28 | SCN-017 A guest's cart from creation to deletion | composition | api | 1/1 | ✅ meets requirement | - |
| **AC-3** | story.md#L23 | SCN-003 A quantity of … is rejected with 422 | boundary | api | 2/2 | ✅ meets requirement | - |
| ↳ | story.md#L23 | SCN-011 A rejected quantity comes with an error for the quantity field | negative | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L23 | SCN-012 A rejected quantity leaves the cart unchanged | negative | api | 1/1 | ✅ meets requirement | - |
| **AC-4** | story.md#L24 | SCN-004 A guest adds a product on its page and is told it was added | functional | ui | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L24 | SCN-013 The cart icon shows the total number of items in the cart | functional | ui | 1/1 | ✅ meets requirement | - |
| **AC-5** | story.md#L25 | SCN-005 The cart page lists each product with its quantity and unit price, and a cart total | functional | ui | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L25 | SCN-014 Each line total on the cart page is price × quantity | functional | ui | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L25 | SCN-015 The cart total on the cart page is the sum of the line totals | functional | ui | 1/1 | ✅ meets requirement | - |
| **AC-6** | story.md#L26 | SCN-006 A guest removes a product from a cart | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28 | SCN-017 A guest's cart from creation to deletion | composition | api | 1/1 | ✅ meets requirement | - |
| **AC-7** | story.md#L27 | SCN-007 A guest deletes a cart | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L27 | SCN-016 Deleting a cart that was already deleted also answers 204 | idempotency | api | 0/1 | ❌ fails requirement | APP-1 |
| ↳ | story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28 | SCN-017 A guest's cart from creation to deletion | composition | api | 1/1 | ✅ meets requirement | - |
| **AC-8** | story.md#L28 | SCN-008 … a cart that does not exist (…) answers 404 "Cart not found" | negative | api | 1/4 | ❌ fails requirement | APP-2 |
| ↳ | story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28 | SCN-017 A guest's cart from creation to deletion | composition | api | 1/1 | ✅ meets requirement | - |

## Coverage by test type

| Test type | Scenarios | Tests | Passed | Failed | Flaky | Defects |
| --- | --- | --- | --- | --- | --- | --- |
| idempotency | 2 | 2 | 1 | 1 | 0 | APP-1 |
| boundary | 2 | 4 | 4 | 0 | 0 | - |
| composition | 1 | 1 | 1 | 0 | 0 | - |
| negative | 3 | 6 | 3 | 3 | 0 | APP-2 |
| functional | 9 | 9 | 9 | 0 | 0 | - |

## Requirement gaps, assumptions and open questions

**Elements the story did not state, and how they were filled** ([contract.json](../2-contract/contract.json)):

| Gap | Missing element | Kind | Affects | Resolution |
| --- | --- | --- | --- | --- |
| G1 | how to read a cart's contents (the story names no endpoint that returns a cart): needed to check that a new cart is empty, that a product was added with its quantity, that a rejected request left the cart unchanged, that a removed product is no longer listed, and to read a cart that does not exist | how to exercise | AC-1, AC-2, AC-3, AC-6, AC-8 | discovered from the AUT (mechanics only): GET /carts/{id}: 200 with {id, additional_discount_percentage, lat, lng, cart_items: [{id, quantity, cart_id, product_id, product {...}}]} (an empty cart_items list for a new cart); a cart that does not exist answers 404 |
| G2 | endpoint for deleting a cart (method and path) | how to exercise | AC-7, AC-8 | discovered from the AUT (mechanics only): DELETE /carts/{id}: 204 with an empty body |
| G3 | the product page: its route, the quantity control, the "Add to cart" button, where the confirmation shows, and the cart icon in the navigation | how to exercise | AC-4 | discovered from the AUT (mechanics only): route /product/{id}, ready when data-test=product-name shows; quantity control data-test=quantity (a number field), button data-test=add-to-cart ('Add to cart'); the confirmation is an alert 'Product added to shopping cart.' (getByRole('alert')); the cart icon's count is data-test=cart-quantity in the navigation. The first add sends POST /carts then POST /carts/{id} {product_id, quantity}; the cart id is kept in sessionStorage cart_id |
| G4 | the cart page (checkout step 1): its route, how the product rows, their quantity, unit price and line total and the cart total are found, and how a test puts products into the web shop's cart before opening it | how to exercise | AC-5 | discovered from the AUT (mechanics only): route /checkout (step 1 lists the cart); one table tbody tr per product, in it data-test=product-title (name), product-quantity (a number input), product-price (unit price), line-price (line total); the cart total is data-test=cart-total. A test fills the web shop's cart by opening each product page and adding there, in one browser session (the cart id is in sessionStorage) |
| G5 | how a test finds a product that is in stock (its product id for the API, its product page for the web shop) | how to exercise | AC-2, AC-3, AC-4, AC-5, AC-6 | discovered from the AUT (mechanics only): GET /products (paginated {data: [...]}) gives each product an id and in_stock (boolean); a product in stock has in_stock true; its product page is /product/{id} |
| G6 | conflicting criteria for deleting a cart that was already deleted: AC-7 (L27) says it responds 204, AC-8 (L28) says any request for a cart that does not exist responds 404 with the message "Cart not found" | expected behaviour | AC-7, AC-8 | assumed: The specific criterion is an exception to the general one: deleting a cart that was already deleted responds 204 (AC-7); every other request for a cart that does not exist responds 404 with "Cart not found" (AC-8). Reason: AC-7 names this case explicitly and calls deletion idempotent, which a 404 on the second delete would contradict. |
| G7 | what "the total number of items" on the cart icon counts: the sum of the quantities in the cart, or the number of different products | expected behaviour | AC-4 | assumed: the sum of the quantities of all products in the cart (a quantity chosen on the product page adds that many items) |
| G8 | what the cart total on the cart page must equal: the sum of the line totals, or that plus other charges | expected behaviour | AC-5 | assumed: the cart total is the sum of the line totals of the products listed |

**Assumptions the evaluation made:**

- G6 — conflicting criteria for deleting a cart that was already deleted: AC-7 (L27) says it responds 204, AC-8 (L28) says any request for a cart that does not exist responds 404 with the message "Cart not found": The specific criterion is an exception to the general one: deleting a cart that was already deleted responds 204 (AC-7); every other request for a cart that does not exist responds 404 with "Cart not found" (AC-8). Reason: AC-7 names this case explicitly and calls deletion idempotent, which a 404 on the second delete would contradict.
- G7 — what "the total number of items" on the cart icon counts: the sum of the quantities in the cart, or the number of different products: the sum of the quantities of all products in the cart (a quantity chosen on the product page adds that many items)
- G8 — what the cart total on the cart page must equal: the sum of the line totals, or that plus other charges: the cart total is the sum of the line totals of the products listed
- G6 — under the assumed reading, deleting a cart id no cart was ever given is "a request for a cart that does not exist" (AC-8, 404 "Cart not found"); only a cart that was deleted before answers 204 on a second delete (SCN-016). SCN-008.4 sends the delete at a made-up id for that reason.
- what each test asserts, so no rule fails in many places: the 422 status of a rejected quantity is asserted by the SCN-003 rows only; its error for the quantity field by SCN-011, the unchanged cart by SCN-012. The 200 and the cart's contents of an accepted quantity are asserted by SCN-002 (a mid-range quantity) and the SCN-009 rows (1 and 99); the sum of a repeated add by SCN-010. On the cart page, SCN-005 checks the rows, their quantities and that unit prices and a cart total are shown; SCN-014 the line totals; SCN-015 the cart total's sum.

## How this verdict was produced

1. The requirement (the story's title, description and acceptance criteria, the images they show and the Confluence pages they link) was fetched from Jira and turned into a requirement contract ([contract.json](../2-contract/contract.json)): every criterion quoted from its source, the endpoints, error cases and gaps, checked by an independent reviewer.
2. Playwright TypeScript tests (UI and API) were written from the contract **only**, with no access to the AUT source or developer tests. Each test is tagged with the criteria it proves, its test type and the requirement source it comes from; expected values were copied verbatim from the requirement. Their steps call the shared actions of the application (how to reach pages and call endpoints, never what the application answers).
3. The draft was frozen, then hardened against the live AUT: locators, waits, navigation and API plumbing only, in the tests and in the journeys they call. Expected outcomes were never aligned with AUT behaviour (integrity check above).
4. Preflight gates (traceability lint and an AUT healthcheck) passed before the run. Every failure was triaged automatically, then re-investigated live before being classified as an application defect.
5. No script defect needed repairing after hardening. This verdict reflects the final run.

| Run | Passed | Failed | Flaky |
| --- | --- | --- | --- |
| `01-harden` (hardening dry-run) | 51 | 15 | 0 |
| `02-harden` (hardening dry-run) | 3 | 0 | 0 |
| `03-eval` (final) | 18 | 4 | 0 |

## Artifacts

- Requirement: [story.md](../1-requirement/story.md) · contract: [contract.json](../2-contract/contract.json) · review: [review.json](../2-contract/review.json)
- Tests: the frozen draft [output/practice-software-testing/TOOL-3/3-tests/](../3-tests/) ([freeze.json](../3-tests/freeze.json)) · as hardened and run [output/practice-software-testing/TOOL-3/4-hardening/](../4-hardening/) · hardening: [hardening.md](../4-hardening/hardening.md)
- Journeys: journeys/fixtures/ · registry: journeys/registry.yml
- Final run: [03-eval.json](../5-run/03-eval.json) (its tests and the evidence of its failures; every run's result is in the history) · triage: [decisions.json](../6-triage/decisions.json)
- History of the evaluation: [history.jsonl](../history.jsonl)
