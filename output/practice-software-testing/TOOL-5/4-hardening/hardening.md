# Hardening log — TOOL-5
**Tiers used:** tier 3 (bundled `heldout inspect` walks and `heldout api-probe` calls and chains) for every UI and API mechanic. The session's folder is not the project, so the native Playwright MCP browser (tier 2) could not serve it and no IDE browser tool (tier 1) was available; `heldout mcp-probe` was not needed, as `inspect` answered every question.
**AUT profile:** practice-software-testing — http://localhost:4200/ · http://localhost:8091/ · **Date:** 2026-11-09

## UI locators
| Test(s) | Element | Draft locator | Hardened locator | Verified (probe) | Evidence |
| --- | --- | --- | --- | --- | --- |
| SCN-001, SCN-007 (via `filterOptions`, `tickFilter`) | the "By brand" filter's checkbox group | `locator('fieldset, [role="group"], div').filter({ has: getByText(heading, { exact: true }) }).filter({ has: getByRole('checkbox') }).last()` | `getByRole('heading', { name: /^By brand:?$/ }).locator('xpath=following-sibling::*[1]')` | 1 heading; 2 checkboxes and 2 labels in its group | P7, P8 |
| SCN-001, SCN-007 (via `tickFilter`) | a brand's checkbox | `getByRole('checkbox', { name: option })` | `getByRole('checkbox', { name: option, exact: true })` | 1 each for ForgeFlex Tools and MightyCraft Hardware; ticking sent `by_brand` | P6, P8 |
| SCN-007 (via `shownProductNamesAllPages`) | the pagination's next button | `getByRole('button', { name: /next|»/i }).or(getByRole('link', …)).first()`, stop on `isEnabled()` / `aria-disabled` | `getByRole('button', { name: 'Next', exact: true })`, stop when its parent `li` has the class `disabled` | 1 match; on the last filtered page the `li` is `page-item disabled` | P7, P9 |
| all UI tests | product cards, product names | `locator('[data-test^="product-"]').filter({ has: getByTestId('product-name') })`, `getByTestId('product-name')` | unchanged | 9 cards per page | P6, P8 |

## API mechanics
| Item | Verified | Evidence |
| --- | --- | --- |
| GET /brands | 200, bare array of {id, name, slug}; ids are 26-character ULIDs; no sign-in | P1 |
| GET /products?by_brand=<id> | 200, paginated {current_page, data, from, last_page, per_page, to, total}, brand nested as brand {id, name}; `page` parameter pages it (5 pages) | P2, P3 |
| GET /brands/{id} | 200 {id, name, slug}; an unknown id answered 404 | P4, P5 |
| GET /brands/search?q= | 200, bare array of brands | P4, P12 |
| GET /products/{id} | 200, brand nested as brand {id, name} | P10 |
| Sign-in (G7) | none needed by any of the four endpoints | P1, P3, P4 |

Gaps resolved as discovered-in-aut: G1 (P6, P8, P9, P10), G2 (P2, P3), G6 (P1, P5), G7 (P1, P3, P4). Oracle and open-question gaps (G3, G4, G5) untouched.

## Journeys (reused, fixed, added)
| Journey | Change | Why | Evidence |
| --- | --- | --- | --- |
| ui.products.filter-options, ui.products.tick-filter (shared `filterGroup`) | the group is now the heading's next sibling, the heading matched with an optional trailing colon | the heading is a sibling of its group, not its parent (the draft's `.last()` div was the whole filters column, categories included), and the page writes "By brand:" | P7, P8 |
| ui.products.tick-filter | waits for the /products response whatever its method; checkbox name matched exactly | the page reloads its list with a QUERY request, not a GET | P8 |
| ui.products.shown-product-names-all-pages | next button by its aria-label; last page told by the parent `li`'s `disabled` class | the anchor button stays enabled on the last page | P9 |
| api.products.product-brand-id, api.products.product-brand-name | read brand.id / brand.name only (the `brand_id` / `brand_name` branches removed) | the answers nest the brand | P2, P10 |
| api.brands.read-brands, find-brand, all-brand-names (shared `listIn`) | bare array only (the wrapper-key loop removed) | GET /brands and the search answer bare arrays | P1, P4 |
| api.brands.unknown-brand-id | ULID form only (the numeric branch removed) | ids are ULIDs; the all-zero id ending in 1 answers 404 | P1, P5 |
| the other products and brands journeys | reused, marks confirmed | see the list below | as listed |
| ui.products.tick-filter, ui.products.shown-product-names-all-pages (shared `reloadList`, `shownProductIds`); ui.products.brands-of-shown-products reads its ids through `shownProductIds` | repair after triage (02-eval): wait for the list call's answer (the non-OPTIONS /products call, since QUERY is preflighted), then poll until the cards' product ids are the ids in that answer's data; replaces the networkidle wait and the first-name-change wait | SCN-001 flaked: the page answers before it re-renders, so the test read the unfiltered cards; the unfiltered and filtered first pages both begin with Combination Pliers, so a first-name wait can't tell them apart either | triage 02-eval P21, P22; run 03-harden-repair |

No journey added or replaced.

## Mechanics changed (non-locator)
- The one mark in the spec (the `page` parameter of SCN-007) was confirmed unchanged (P3).
- Repair after triage (02-eval), SCN-007's API step: GET /products now carries the parameters the shop page sends beside `by_brand` (`between=price,1,100`, `is_rental=false`), so it asks for the list the page shows. No expected value changed. Evidence: triage P19, P20, P22; run 03-harden-repair.

## Observed deviations (assertions intentionally left unchanged)
| Test | Requirement says | AUT shows | Evidence |
| --- | --- | --- | --- |
| SCN-005.1, SCN-005.4, SCN-011 | AC-5: the search finds the brands whose name contains the text, ignoring case ("craft" finds MightyCraft Hardware) | the search finds a name by its start only: `forge` and `MIGHTYCRAFT HARDWARE` find their brand, `craft` and `fLeX` answer `[]` | P4, P12, run 01-harden |
| SCN-001 | AC-1 strict: a "By brand" filter, located with `getByText('By brand', { exact: true })` | the heading reads "By brand:" (a trailing colon); the frozen strict locator finds 0 elements, so the test stops there. Not a deviation of the requirement's words (a trailing colon is punctuation), but an assertion implementation for the main agent to decide on: the locator is frozen by `strict` | P6, run 01-harden |

## Stability
`run TOOL-5 --label harden --repeat-each 3 --workers 2` (01-harden): 30 passed, 15 failed, 0 flaky. The five failing tests failed all three times, each on a `[REQ …]` assertion matching a row above (triage: APPLICATION_DEFECT, pending the triager's check). Every other test passed 3 of 3. SCN-001's later steps (`filterOptions`, `brandsOfShownProducts`) were not reached in the run; their mechanics are proven by P7, P8 and P10, and SCN-007 ran `tickFilter` and `shownProductNamesAllPages` through to its comparison.

After the triage repairs (02-eval: SCN-001, SCN-007): `run TOOL-5 --label harden-repair --grep "SCN-00[17]" --repeat-each 3 --workers 2` (03-harden-repair): 6 passed, 0 failed, 0 flaky. No other test calls the changed journeys.

**Guesses confirmed unchanged** (`heldout confirm`):
- journeys/fixtures/brands.ts: 2 guess(es) confirmed as drafted — P1 (GET /brands: a bare array of {id, name, slug}, ULID ids), P4 (GET /brands/{id}; search answers a bare array), P5 (an all-zero id ending in 1 answers 404)
- journeys/fixtures/products.ts: 11 guess(es) confirmed as drafted — P2/P3 (GET /products: data list, last_page, brand nested as {id, name}, name), P6 (shop at /, product cards), P8/P9 (card href /product/{id}, filter tick, labels), P10 (GET /products/{id} with brand.name)
- output/practice-software-testing/TOOL-5/4-hardening/tool-5.spec.ts: 1 guess(es) confirmed as drafted — P3 (GET /products?by_brand pages with the page parameter, page=1..5)
