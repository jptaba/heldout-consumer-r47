# Held-out Evaluation Verdict — TOOL-5

> **Verdict: ❌ FAIL** — 1 application defect(s) reproduced by the evaluator: the AUT does not satisfy AC-5. Awaiting reviewer confirmation. 2 questions for the story's owner are listed under "Requirement gaps, assumptions and open questions"; no criterion waits on them.

| | |
| --- | --- |
| Story | [TOOL-5](https://jira.example.com/browse/TOOL-5) — Shop by brand |
| Application under test | Practice Software Testing (profile `practice-software-testing`) — UI http://localhost:4200/ · API http://localhost:8091/ |
| Final run | `04-rerun` · 2026-11-09T03:31:33.839Z · 5s |
| Tests | 15 total · 12 passed · 3 failed · 0 flaky · 0 skipped (from 11 scenarios) |
| Held-out integrity | ✅ PRESERVED WITH 1 AUDITED AMENDMENT(S) — 31 requirement assertions; see "Assertion amendments" |
| Hardening | tier 3 (bundled heldout inspect walks and heldout api-probe calls and chains) for every UI and API mechanic. |
| Journeys | 16 journey(s) from journeys/fixtures/ (0 proven by earlier stories, 16 new to the registry) · 10 journey(s) changed after the freeze: api.brands.all-brand-names, api.brands.find-brand, api.brands.read-brands, api.brands.unknown-brand-id, api.products.product-brand-id, … |
| Evaluator | Opus — heldout-evaluator skill |
| Generated | 2026-11-09T03:31:40.618Z |

> This verdict is the evaluator's **recommendation**. Each finding below has requirement traceability, reproduction steps and evidence, so a reviewer can confirm or reject it. Nothing has been raised in Jira; the only Jira activity is this report and a summary comment on the story.

## Findings summary

| ID | Suggested severity | Criteria | Test type | Finding | Tests | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| APP-1 | Major | AC-5 | functional, composition | Brand search matches only at the start of a brand name, not anywhere in it | SCN-005.1, SCN-005.4, SCN-011 | ☐ confirm · ☐ reject · ☐ clarify |

## Findings: suspected application defects (1 root cause(s), 3 failing test(s))

### APP-1 · SCN-005.1, SCN-005.4, SCN-011 · AC-5 — Brand search matches only at the start of a brand name, not anywhere in it

| | |
| --- | --- |
| Suggested severity | Major |
| Requirement AC-5 | Brand search for the mobile app: GET /brands/search?q=<text> finds brands whose name contains the text anywhere in the name, ignoring case (e.g. "craft" finds MightyCraft Hardware, "FORGE" finds ForgeFlex Tools). |
| Requirement source | story.md#L24, story.md#L23, story.md#L21 |
| Test type · layer | functional, composition · api |
| SCN-005.1: expected (requirement) → actual (AUT) | `"MightyCraft Hardware"` → `[]` |
| SCN-005.4: expected (requirement) → actual (AUT) | `"ForgeFlex Tools"` → `[]` |
| SCN-011: expected (requirement) → actual (AUT) | `-` → `undefined` |
| Failing step | Then MightyCraft Hardware is found |
| Evaluator classification | APPLICATION_DEFECT (reproduced live) |

#### How to reproduce

**Manually (the test's steps):**

1. When I GET /brands/search?q=${row.q}
2. Then ${row.finds} is found
3. Then every brand found has "${row.q}" in its name, ignoring case

**Via the API: SCN-005.1** (the exact requests the test sent, in order; secrets replaced by placeholders). Request 1 (⟵) is the one that contradicts the requirement:

1. `GET /brands/search → 200` ⟵

   ```bash
   curl -i -X GET 'http://localhost:8091/brands/search?q=craft'
   ```

Observed response of request 1 (SCN-005.1):

```json
[]
```

The other 2 test(s) of this finding fail the same way; each one's requests are in the run's record, output/practice-software-testing/TOOL-5/5-run/04-rerun.json.

**Automated re-run of the failing test(s):**

```bash
npm run heldout -- run TOOL-5 --label repro --grep "SCN-005\.1:"
npm run heldout -- run TOOL-5 --label repro --grep "SCN-005\.4:"
npm run heldout -- run TOOL-5 --label repro --grep "SCN-011:"
```

#### Evidence

- Step-by-step trace, while the run's raw output is kept: `npx playwright show-trace .heldout/practice-software-testing/TOOL-5/5-run/04-rerun/artifacts/practice-software-testing--4d55f-lower-case-inside-the-name--chromium-retry1/trace.zip`
- Live re-check by the evaluator: P13 P14 P15 P16 P17: replayed live 2026-11-09 with api-probe; q=craft -> 200 [] (P13), q=fLeX -> 200 [] (P16); controls q=MightyCraft -> MightyCraft Hardware (P14), q=FORGE -> ForgeFlex Tools (P15), q=ForgeFlex -> ForgeFlex Tools (P17)

**Evaluator's analysis:** AC-5 requires GET /brands/search?q= to find brands whose name contains the text anywhere in the name, ignoring case, and names 'craft' finding MightyCraft Hardware as its example. Replayed live without credentials (G7): q=craft and q=fLeX (text inside the name) answer 200 with an empty list, while q=MightyCraft, q=ForgeFlex and q=FORGE (text at the start of the name, FORGE in another case) answer the brand. Case is ignored, but only a prefix matches: the requirement's own example fails. SCN-011 fails at its first step on the same q=craft call. The calls, paths and parameter match the declared endpoint, so the mechanics are right. (Confirmed in run 02-eval; identical failure signature in 04-rerun.)

**Reviewer decision:** ☐ Confirm as defect · ☐ Not a defect (explain) · ☐ Requirement needs clarification

## Script defects found and repaired (2)

| Found in run | Test | Symptom | Diagnosis | Fix applied | Final run |
| --- | --- | --- | --- | --- | --- |
| `02-eval` | SCN-001 | [REQ AC-1] only products of "ForgeFlex Tools" are shown | Failed on the first attempt, passed on retry. The failing attempt's trace shows the filtered QUERY /products (by_brand=ForgeFlex) answered 200, yet the test then looked up products of the unfiltered first page (Bolt Cutters, Long Nose Pliers, Slip Joint Pliers: 4 MightyCraft Hardware products): it read the cards before the page replaced them. Replayed live, the settled filtered list holds no Bolt Cutters and only ForgeFlex products (P21). The journey tickFilter waits for a /products response and networkidle, not for the list to change; and the unfiltered and filtered first pages both start with Combination Pliers, so a first-name wait would not tell them apart either. A race in the test's waiting, not the application. | Repair in the journey tickFilter (journeys/fixtures/products.ts): after the filter's QUERY /products answers, wait until the shown cards are the ones that answer lists (e.g. compare the card ids/hrefs with the response's data ids, or wait for the card set to change), not only for any /products response and networkidle. | ✅ passed |
| `02-eval` | SCN-007 | [REQ AC-1] the "By brand" filter for "ForgeFlex Tools" shows the products GET /products?by_brand=01M6J4V54D8SR41SBQZACFZ | The shop page always sends its list request with the default price range between=price,1,100 and is_rental=false besides by_brand (P19, P9). The test compares the page with GET /products?by_brand=<id> without those parameters (40 products, P18), so the 4 ForgeFlex products priced above 100 (Workbench with Drawers 178.2, Random Orbit Sander 100.79, Cordless Drill 20V 125.23, Cordless Drill 18V 119.24) can never be on the page. The same call with the page's parameters answers 36 products, exactly the 40 minus those 4 (P20), which is what the page showed. Every product shown was a ForgeFlex product, so AC-1's 'only that brand's products' holds; the mismatch is the test's comparison, not the application. | Repair in the test (tool-5.spec.ts SCN-007, the API step): compare with GET /products using the same parameters the page sends (between=price,1,100, is_rental=false, by_brand), or read the page's own list request; no expected value changes. | ✅ passed |

## Assertion amendments (audited)

Fixes to how a requirement assertion was *implemented*. What it requires is unchanged. Each was approved with a reason before the official run.

| Assertion | Draft | Amended | Reason |
| --- | --- | --- | --- |
| tool-5.spec.ts: [REQ AC-1 strict] the shop page has a "By brand" filter | `page.getByText(REQ.FILTER_HEADING, { exact: true }) .toBeVisible()` | `page.getByText(new RegExp(`^${REQ.FILTER_HEADING}:?$`)) .toBeVisible()` | Over-strict implementation: an exact text match fails on the heading's trailing colon (By brand:, P6), which is punctuation, not another word. The expected text stays REQ.FILTER_HEADING; only an optional colon after it is accepted. |

## Test results

| Test | Title | Criteria | Type | Result | Classification |
| --- | --- | --- | --- | --- | --- |
| SCN-001 | A visitor ticks a brand in the shop page's "By brand" filter and sees only that brand's products | AC-1 | functional | ✅ passed | - |
| SCN-002 | A client asks GET /products?by_brand for a brand and gets only that brand's products | AC-2 | functional | ✅ passed | - |
| SCN-003 | A client asks GET /brands and gets the brands, the named ones among them | AC-3 | functional | ✅ passed | - |
| SCN-004 | A client asks GET /brands/{id} for an existing brand and gets that brand | AC-4 | functional | ✅ passed | - |
| SCN-005.1 | A brand search for "craft" finds MightyCraft Hardware (the example: lower case, inside the name) | AC-5 | functional | ❌ failed | APPLICATION_DEFECT · APP-1 |
| SCN-005.2 | A brand search for "FORGE" finds ForgeFlex Tools (the example: upper case, at the start of the name) | AC-5 | functional | ✅ passed | - |
| SCN-005.3 | A brand search for "hardware" finds MightyCraft Hardware (at the end of the name) | AC-5 | functional | ✅ passed | - |
| SCN-005.4 | A brand search for "fLeX" finds ForgeFlex Tools (mixed case, inside a word) | AC-5 | functional | ❌ failed | APPLICATION_DEFECT · APP-1 |
| SCN-005.5 | A brand search for "mightycraft hardware" finds MightyCraft Hardware (the whole name, lower case) | AC-5 | functional | ✅ passed | - |
| SCN-006 | A brand search no brand name matches answers an empty list with 200 | AC-6 | functional | ✅ passed | - |
| SCN-007 | The shop page's brand filter shows the same products GET /products?by_brand answers | AC-1, AC-2 | integration | ✅ passed | - |
| SCN-008 | Every brand GET /brands answers has its id, name and slug | AC-3 | contract | ✅ passed | - |
| SCN-009 | A client asks GET /brands/{id} for an unknown id and gets 404 | AC-4 | negative | ✅ passed | - |
| SCN-010 | Every brand GET /brands answers is found by a brand search for its name in upper case | AC-3, AC-5 | composition | ✅ passed | - |
| SCN-011 | A brand found by search is the brand GET /brands/{id} answers, and GET /products?by_brand lists only its products | AC-5 | composition | ❌ failed | APPLICATION_DEFECT · APP-1 |

## Requirement coverage

| Criterion | Requirement | Tests | Result |
| --- | --- | --- | --- |
| AC-1 | The shop page has a "By brand" filter listing the brands; ticking one shows only that brand's products. | SCN-001, SCN-007 | ✅ met |
| AC-2 | The catalogue API supports the same: GET /products?by_brand=<brand id> returns only products of that brand. | SCN-002, SCN-007 | ✅ met |
| AC-3 | GET /brands returns all brands, each with its id, name and slug. | SCN-003, SCN-008, SCN-010 | ✅ met |
| AC-4 | GET /brands/{id} returns that brand. An unknown id returns 404. | SCN-004, SCN-009 | ✅ met |
| AC-5 | Brand search for the mobile app: GET /brands/search?q=<text> finds brands whose name contains the text anywhere in the name, ignoring case (e.g. "craft" finds MightyCraft Hardware, "FORGE" finds ForgeFlex Tools). | SCN-005, SCN-010, SCN-011 (7 tests) | ❌ not met |
| AC-6 | A brand search with no match returns an empty list, still with 200. | SCN-006 | ✅ met |

## Traceability matrix

Each row links an acceptance criterion to the requirement source it came from, the scenario that proves it, that scenario's test type and layer, the executed tests, the result and any defect. Every test carries `@AC-n` and `@type:<t>` tags (enforced by the preflight lint).

| Criterion | Source | Scenario | Type | Layer | Tests passed | Result | Defects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **AC-1** | story.md#L20 | SCN-001 A visitor ticks a brand in the shop page's "By brand" filter and sees only that brand's products | functional | ui | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L20, story.md#L21 | SCN-007 The shop page's brand filter shows the same products GET /products?by_brand answers | integration | ui | 1/1 | ✅ meets requirement | - |
| **AC-2** | story.md#L21 | SCN-002 A client asks GET /products?by_brand for a brand and gets only that brand's products | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L20, story.md#L21 | SCN-007 The shop page's brand filter shows the same products GET /products?by_brand answers | integration | ui | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L24, story.md#L23, story.md#L21 | SCN-011 A brand found by search is the brand GET /brands/{id} answers, and GET /products?by_brand lists only its products | composition | api | 0/1 | ❌ fails requirement | APP-1 |
| **AC-3** | story.md#L22 | SCN-003 A client asks GET /brands and gets the brands, the named ones among them | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L22 | SCN-008 Every brand GET /brands answers has its id, name and slug | contract | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L22, story.md#L24 | SCN-010 Every brand GET /brands answers is found by a brand search for its name in upper case | composition | api | 1/1 | ✅ meets requirement | - |
| **AC-4** | story.md#L23 | SCN-004 A client asks GET /brands/{id} for an existing brand and gets that brand | functional | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L23 | SCN-009 A client asks GET /brands/{id} for an unknown id and gets 404 | negative | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L24, story.md#L23, story.md#L21 | SCN-011 A brand found by search is the brand GET /brands/{id} answers, and GET /products?by_brand lists only its products | composition | api | 0/1 | ❌ fails requirement | APP-1 |
| **AC-5** | story.md#L24 | SCN-005 A brand search for … finds … | functional | api | 3/5 | ❌ fails requirement | APP-1 |
| ↳ | story.md#L22, story.md#L24 | SCN-010 Every brand GET /brands answers is found by a brand search for its name in upper case | composition | api | 1/1 | ✅ meets requirement | - |
| ↳ | story.md#L24, story.md#L23, story.md#L21 | SCN-011 A brand found by search is the brand GET /brands/{id} answers, and GET /products?by_brand lists only its products | composition | api | 0/1 | ❌ fails requirement | APP-1 |
| **AC-6** | story.md#L25 | SCN-006 A brand search no brand name matches answers an empty list with 200 | functional | api | 1/1 | ✅ meets requirement | - |

## Coverage by test type

| Test type | Scenarios | Tests | Passed | Failed | Flaky | Defects |
| --- | --- | --- | --- | --- | --- | --- |
| contract | 1 | 1 | 1 | 0 | 0 | - |
| composition | 2 | 2 | 1 | 1 | 0 | APP-1 |
| integration | 1 | 1 | 1 | 0 | 0 | - |
| negative | 1 | 1 | 1 | 0 | 0 | - |
| functional | 6 | 10 | 8 | 2 | 0 | APP-1 |

## Requirement gaps, assumptions and open questions

**Elements the story did not state, and how they were filled** ([contract.json](../2-contract/contract.json)):

| Gap | Missing element | Kind | Affects | Resolution |
| --- | --- | --- | --- | --- |
| G1 | the shop page's route, how the "By brand" filter and its brand entries are found and ticked, and how a shown product's brand is told | how to exercise | AC-1 | discovered from the AUT (mechanics only): The shop page is the home page (/). Its filters column shows a level-4 heading "By brand:" (with a trailing colon) followed by a checkbox group "Brands" with one checkbox per brand, labelled with the brand's name (getByRole('checkbox', { name, exact: true })). Ticking one reloads the list (a QUERY /products call with by_brand=<brand id>). A product card (a[data-test=product-<id>], href /product/<id>) shows no brand: a shown product's brand is read from GET /products/{id}, field brand.name. |
| G2 | where a product's brand is in the GET /products answer (field name, list shape) so that "only products of that brand" can be checked | how to exercise | AC-2 | discovered from the AUT (mechanics only): GET /products answers a paginated object {current_page, data: [...], from, last_page, per_page, to, total}; each product in data has its brand nested as brand: {id, name}. Further pages with ?page=N. |
| G3 | the success status of GET /products?by_brand=<brand id>, GET /brands and GET /brands/{id}: no source states one (L25's "still 200" is said of the brand search) | expected behaviour | AC-2, AC-3, AC-4 | ❓ open |
| G4 | which brands "all brands" (L22) and "listing the brands" (L20) means: no source lists the brands, and none says whether the filter must list the same brands GET /brands answers. Only MightyCraft Hardware and ForgeFlex Tools are named (L24) | expected behaviour | AC-1, AC-3 | ❓ open |
| G5 | what "no match" (L25) applies to: the bullet follows the brand search (L24), so it is read as a brand search no brand name matches. Whether GET /products?by_brand with a brand that has no products, or with an unknown brand id, also answers an empty list with 200 is not stated | expected behaviour | AC-6, AC-2 | assumed: L25 applies to GET /brands/search: a search text no brand name contains answers an empty list with 200. Nothing is expected of GET /products?by_brand for a brand without products or an unknown brand id |
| G6 | what a brand id looks like, to send an id no brand has (AC-4's unknown id) | how to exercise | AC-4 | discovered from the AUT (mechanics only): A brand id is a 26-character ULID string; an id of the same length, all zeros but a final 1, belongs to no brand. |
| G7 | whether the brand and product endpoints need a sign-in, and how a call proves it | how to exercise | AC-2, AC-3, AC-4, AC-5, AC-6 | discovered from the AUT (mechanics only): No sign-in: GET /brands, GET /brands/{id}, GET /brands/search?q= and GET /products?by_brand= answer without any credentials (no Authorization header, no cookie). |

**For the owner's information** (questions the criteria can be judged without: gaps the review marked not required, and what the tests found the criteria leave unsaid; they don't affect the verdict):

- ℹ️ G3 — the success status of GET /products?by_brand=<brand id>, GET /brands and GET /brands/{id}: no source states one (L25's "still 200" is said of the brand search). The tests check a success (2xx) only
- ℹ️ G4 — which brands "all brands" (L22) and "listing the brands" (L20) means: no source lists the brands, and none says whether the filter must list the same brands GET /brands answers. Only MightyCraft Hardware and ForgeFlex Tools are named (L24). The tests check that brands are listed, and that GET /brands includes the two named ones

**Assumptions the evaluation made:**

- G5 — "no match" (L25) applies to GET /brands/search: a search text no brand name contains answers an empty list with 200. Nothing is expected of GET /products?by_brand for a brand without products or an unknown brand id (not asserted)
- the exact 200 of a brand search is asserted in SCN-006 only (no match, where the story states it); the other search tests check a success (2xx) and which brands are found
- the 404 of an unknown brand id is asserted in SCN-009 only; SCN-004 checks the answer for an existing brand G7 (mechanics, open): every call is sent without a sign-in; the hardener finds out whether the catalogue needs one

## How this verdict was produced

1. The requirement (the story's title, description and acceptance criteria, the images they show and the Confluence pages they link) was fetched from Jira and turned into a requirement contract ([contract.json](../2-contract/contract.json)): every criterion quoted from its source, the endpoints, error cases and gaps, checked by an independent reviewer.
2. Playwright TypeScript tests (UI and API) were written from the contract **only**, with no access to the AUT source or developer tests. Each test is tagged with the criteria it proves, its test type and the requirement source it comes from; expected values were copied verbatim from the requirement. Their steps call the shared actions of the application (how to reach pages and call endpoints, never what the application answers).
3. The draft was frozen, then hardened against the live AUT: locators, waits, navigation and API plumbing only, in the tests and in the journeys they call. Expected outcomes were never aligned with AUT behaviour (integrity check above).
4. Preflight gates (traceability lint and an AUT healthcheck) passed before the run. Every failure was triaged automatically, then re-investigated live before being classified as an application defect.
5. Script defects were repaired (mechanics only) and the full suite re-run. This verdict reflects the final run.

| Run | Passed | Failed | Flaky |
| --- | --- | --- | --- |
| `01-harden` (hardening dry-run) | 30 | 15 | 0 |
| `02-eval` (superseded by a later run) | 10 | 4 | 1 |
| `03-harden-repair` (hardening dry-run) | 6 | 0 | 0 |
| `04-rerun` (final) | 12 | 3 | 0 |

## Artifacts

- Requirement: [story.md](../1-requirement/story.md) · contract: [contract.json](../2-contract/contract.json) · review: [review.json](../2-contract/review.json)
- Tests: the frozen draft [output/practice-software-testing/TOOL-5/3-tests/](../3-tests/) ([freeze.json](../3-tests/freeze.json)) · as hardened and run [output/practice-software-testing/TOOL-5/4-hardening/](../4-hardening/) · hardening: [hardening.md](../4-hardening/hardening.md)
- Journeys: journeys/fixtures/ · registry: journeys/registry.yml
- Final run: [04-rerun.json](../5-run/04-rerun.json) (its tests and the evidence of its failures; every run's result is in the history) · triage: [decisions.json](../6-triage/decisions.json)
- History of the evaluation: [history.jsonl](../history.jsonl)
