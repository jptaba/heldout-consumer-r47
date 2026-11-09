/**
 * Held-out acceptance tests for TOOL-5 — "Shop by brand".
 * Written from the requirement contract (the requirement only; never from the AUT's code). The steps call the
 * journeys in journeys/fixtures/ (npm run heldout -- journeys TOOL-5); every expectation stays here.
 */
import { test, expect, expectResponse, checkShape, type ApiResponse } from '../../../../heldout-support/fixtures';
import { allBrandNames, brandIdOf, brandNameOf, findBrand, readBrands, unknownBrandId } from '../../../../journeys/fixtures/brands';
import {
  brandsOfShownProducts, filterOptions, lastPageOf, openShop, productBrandId, productNameOf, readProducts,
  shownProductNames, shownProductNamesAllPages, tickFilter,
} from '../../../../journeys/fixtures/products';

// ASSUMPTION: G5 — "no match" (L25) applies to GET /brands/search: a search text no brand name contains answers an empty list with 200. Nothing is expected of GET /products?by_brand for a brand without products or an unknown brand id (not asserted)
// OPEN-QUESTION: G3 — the success status of GET /products?by_brand=<brand id>, GET /brands and GET /brands/{id}: no source states one (L25's "still 200" is said of the brand search). The tests check a success (2xx) only
// OPEN-QUESTION: G4 — which brands "all brands" (L22) and "listing the brands" (L20) means: no source lists the brands, and none says whether the filter must list the same brands GET /brands answers. Only MightyCraft Hardware and ForgeFlex Tools are named (L24). The tests check that brands are listed, and that GET /brands includes the two named ones
// ASSUMPTION: the exact 200 of a brand search is asserted in SCN-006 only (no match, where the story states it); the other search tests check a success (2xx) and which brands are found
// ASSUMPTION: the 404 of an unknown brand id is asserted in SCN-009 only; SCN-004 checks the answer for an existing brand
// G7 (mechanics, open): every call is sent without a sign-in; the hardener finds out whether the catalogue needs one

// @req-constants-start — expected outcomes copied verbatim from TOOL-5 (never edit during hardening)
const REQ = {
  STATUS: { OK: 200, NOT_FOUND: 404 },
  FILTER_HEADING: 'By brand',
  NAMED_BRANDS: ['MightyCraft Hardware', 'ForgeFlex Tools'],
  // story.md#L24: the examples, then cases of the rule's own words ("anywhere in the name, ignoring case")
  SEARCH_CASES: [
    { q: 'craft', finds: 'MightyCraft Hardware', why: 'the example: lower case, inside the name' },
    { q: 'FORGE', finds: 'ForgeFlex Tools', why: 'the example: upper case, at the start of the name' },
    { q: 'hardware', finds: 'MightyCraft Hardware', why: 'at the end of the name' },
    { q: 'fLeX', finds: 'ForgeFlex Tools', why: 'mixed case, inside a word' },
    { q: 'mightycraft hardware', finds: 'MightyCraft Hardware', why: 'the whole name, lower case' },
  ],
} as const;
// @req-constants-end

// Endpoints exactly as declared in the requirement.
const EP = {
  /** GET /products */ products: '/products',
  /** GET /brands */ brands: '/brands',
  /** GET /brands/{id} */ brandsById: (id: string | number) => `/brands/${id}`,
  /** GET /brands/search */ brandsSearch: '/brands/search',
};

const contains = (name: string, text: string) => name.toLowerCase().includes(text.toLowerCase());

test.describe('TOOL-5 Shop by brand', () => {
  // from story.md#L20
  test('SCN-001: A visitor ticks a brand in the shop page\'s "By brand" filter and sees only that brand\'s products', { tag: ['@AC-1', '@type:functional', '@layer:ui', '@P1'] }, async ({ page, api, journey, data }) => {
    const brand = data.brandWithProducts.name as string;
    let options: string[] = []; let brands: string[] = [];
    await journey.step('Given I am on the shop page', async () => { await openShop(page); });
    await journey.step('Then the shop page has a "By brand" filter', async () => {
      await expect(page.getByText(REQ.FILTER_HEADING, { exact: true }), '[REQ AC-1 strict] the shop page has a "By brand" filter').toBeVisible();
    });
    await journey.step('Then the "By brand" filter lists brands', async () => {
      options = await filterOptions(page, REQ.FILTER_HEADING);
      expect(options.length, '[REQ AC-1] the "By brand" filter lists the brands').toBeGreaterThan(0);
    });
    await journey.step(`When I tick "${brand}" in the "By brand" filter`, async () => {
      expect(options, `the filter offers "${brand}" to tick (precondition)`).toContain(brand);
      await tickFilter(page, REQ.FILTER_HEADING, brand);
    });
    await journey.step(`Then every product shown is a product of "${brand}"`, async () => {
      brands = await brandsOfShownProducts(page, api);
      expect.soft(brands.length, `[REQ AC-1] products of "${brand}" are shown`).toBeGreaterThan(0);
      expect(brands.filter((b) => b !== brand), `[REQ AC-1] only products of "${brand}" are shown`).toEqual([]);
    });
  });

  // from story.md#L21
  test('SCN-002: A client asks GET /products?by_brand for a brand and gets only that brand\'s products', { tag: ['@AC-2', '@type:functional', '@layer:api', '@P1', '@depends:SCN-003'] }, async ({ api, journey, data, seed }) => {
    let brand!: { id: string; name: string }; let res!: ApiResponse;
    await journey.step('Given a brand of the catalogue that has products', async () => { brand = await findBrand(api, seed, data.brandWithProducts.name); });
    await journey.step('When I GET /products?by_brand=<the brand\'s id>', async () => { res = await api.get(EP.products, { params: { by_brand: brand.id } }); });
    await journey.step('Then the answer is a success listing products', async () => {
      expectResponse(res, { status: '2xx' }, '[REQ AC-2] GET /products?by_brand answers');
      expect(readProducts(res.body)?.length ?? 0, '[REQ AC-2] GET /products?by_brand lists the brand\'s products').toBeGreaterThan(0);
    });
    await journey.step('Then every product listed is a product of that brand', async () => {
      const others = (readProducts(res.body) ?? []).filter((p) => productBrandId(p) !== brand.id).map(productNameOf);
      expect(others, `[REQ AC-2] GET /products?by_brand=${brand.id} answers only products of "${brand.name}"`).toEqual([]);
    });
  });

  // from story.md#L22
  test('SCN-003: A client asks GET /brands and gets the brands, the named ones among them', { tag: ['@AC-3', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey }) => {
    let res!: ApiResponse;
    await journey.step('When I GET /brands', async () => { res = await api.get(EP.brands); });
    await journey.step('Then the answer is a success listing brands', async () => {
      expectResponse(res, { status: '2xx' }, '[REQ AC-3] GET /brands answers');
      expect(readBrands(res.body)?.length ?? 0, '[REQ AC-3] GET /brands answers the brands').toBeGreaterThan(0);
    });
    await journey.step('Then MightyCraft Hardware and ForgeFlex Tools are among them', async () => {
      const names = (readBrands(res.body) ?? []).map(brandNameOf);
      for (const name of REQ.NAMED_BRANDS) expect.soft(names, `[REQ AC-3] GET /brands includes "${name}"`).toContain(name);
    });
  });

  // from story.md#L23
  test('SCN-004: A client asks GET /brands/{id} for an existing brand and gets that brand', { tag: ['@AC-4', '@type:functional', '@layer:api', '@P1', '@depends:SCN-003'] }, async ({ api, journey, data, seed }) => {
    let brand!: { id: string; name: string }; let res!: ApiResponse;
    await journey.step('Given an existing brand and its id', async () => { brand = await findBrand(api, seed, data.brandWithProducts.name); });
    await journey.step('When I GET /brands/<its id>', async () => { res = await api.get(EP.brandsById(brand.id)); });
    await journey.step('Then the answer is that brand', async () => {
      expectResponse(res, { status: '2xx' }, `[REQ AC-4] GET /brands/${brand.id} answers`);
      const body = (res.body ?? {}) as Record<string, unknown>;
      expect.soft(brandIdOf(body), `[REQ AC-4] GET /brands/${brand.id} answers the brand with that id`).toBe(brand.id);
      expect.soft(brandNameOf(body), `[REQ AC-4] GET /brands/${brand.id} answers "${brand.name}"`).toBe(brand.name);
    });
  });

  // from story.md#L24
  REQ.SEARCH_CASES.forEach((row, i) => {
    test(`SCN-005.${i + 1}: A brand search for "${row.q}" finds ${row.finds} (${row.why})`, { tag: ['@AC-5', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey }) => {
      let res!: ApiResponse;
      await journey.step(`When I GET /brands/search?q=${row.q}`, async () => { res = await api.get(EP.brandsSearch, { params: { q: row.q } }); });
      await journey.step(`Then ${row.finds} is found`, async () => {
        expectResponse(res, { status: '2xx' }, `[REQ AC-5] GET /brands/search?q=${row.q} answers`);
        expect((readBrands(res.body) ?? []).map(brandNameOf), `[REQ AC-5] GET /brands/search?q=${row.q} finds "${row.finds}"`).toContain(row.finds);
      });
      await journey.step(`Then every brand found has "${row.q}" in its name, ignoring case`, async () => {
        const others = (readBrands(res.body) ?? []).map(brandNameOf).filter((n) => !contains(n, row.q));
        expect(others, `[REQ AC-5] GET /brands/search?q=${row.q} finds only brands whose name contains it`).toEqual([]);
      });
    });
  });

  // from story.md#L25
  test('SCN-006: A brand search no brand name matches answers an empty list with 200', { tag: ['@AC-6', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey, data, seed }) => {
    const text = data.noMatchText as string; let res!: ApiResponse;
    await journey.step(`Given no brand has "${text}" in its name`, async () => {
      const names = await allBrandNames(api, seed);
      expect(names.filter((n) => contains(n, text)), 'no brand name contains the search text (precondition)').toEqual([]);
    });
    await journey.step(`When I GET /brands/search?q=${text}`, async () => { res = await api.get(EP.brandsSearch, { params: { q: text } }); });
    await journey.step('Then the answer is 200', async () => {
      expectResponse(res, { status: REQ.STATUS.OK }, `[REQ AC-6] GET /brands/search?q=${text} still answers 200`);
    });
    await journey.step('Then the answer is an empty list', async () => {
      const list = readBrands(res.body);
      expect(list, `[REQ AC-6] GET /brands/search?q=${text} answers a list`).toBeDefined();
      expect(list ?? [null], `[REQ AC-6] GET /brands/search?q=${text} answers an empty list`).toHaveLength(0);
    });
  });

  // from story.md#L20, story.md#L21
  test('SCN-007: The shop page\'s brand filter shows the same products GET /products?by_brand answers', { tag: ['@AC-1', '@AC-2', '@type:integration', '@layer:ui', '@P2', '@depends:SCN-003'] }, async ({ page, api, journey, data, seed }) => {
    let brand!: { id: string; name: string }; let apiNames: string[] = []; let uiNames: string[] = [];
    await journey.step('Given a brand of the catalogue that has products', async () => { brand = await findBrand(api, seed, data.brandWithProducts.name); });
    await journey.step('When I GET /products?by_brand=<the brand\'s id>, every page of it', async () => {
      const first = await api.get(EP.products, { params: { by_brand: brand.id } });
      expectResponse(first, { status: '2xx' }, '[REQ AC-2] GET /products?by_brand answers');
      apiNames = (readProducts(first.body) ?? []).map(productNameOf);
      for (let p = 2; p <= lastPageOf(first.body); p++) {
        const next = await api.get(EP.products, { params: { by_brand: brand.id, page: p } }); // TODO(harden) the page parameter
        apiNames.push(...(readProducts(next.body) ?? []).map(productNameOf));
      }
    });
    await journey.step(`When I tick "${brand.name}" in the shop page's "By brand" filter`, async () => {
      await openShop(page);
      await tickFilter(page, REQ.FILTER_HEADING, brand.name);
      expect((await shownProductNames(page)).length, 'the filtered list shows products (precondition)').toBeGreaterThan(0);
    });
    await journey.step('Then the shop page shows the products the API answers, over all its pages', async () => {
      uiNames = await shownProductNamesAllPages(page);
      expect([...uiNames].sort(), `[REQ AC-1] the "By brand" filter for "${brand.name}" shows the products GET /products?by_brand=${brand.id} answers`).toEqual([...apiNames].sort());
    });
  });

  // from story.md#L22
  test('SCN-008: Every brand GET /brands answers has its id, name and slug', { tag: ['@AC-3', '@type:contract', '@layer:api', '@P2'] }, async ({ api, journey }) => {
    let res!: ApiResponse;
    await journey.step('When I GET /brands', async () => { res = await api.get(EP.brands); });
    await journey.step('Then each brand has an id, a name and a slug', async () => {
      const list = readBrands(res.body);
      expect(list?.length ?? 0, 'GET /brands lists brands (precondition)').toBeGreaterThan(0);
      const present = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) || 'missing or empty';
      const violations = list!.flatMap((b, i) => checkShape(b, { id: present, name: present, slug: present }, `brand ${i + 1} (${brandNameOf(b)})`));
      expect(violations, '[REQ AC-3] GET /brands answers each brand with its id, name and slug').toEqual([]);
    });
  });

  // from story.md#L23
  test('SCN-009: A client asks GET /brands/{id} for an unknown id and gets 404', { tag: ['@AC-4', '@type:negative', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let id = ''; let res!: ApiResponse;
    await journey.step('Given an id no brand has', async () => { id = await unknownBrandId(api, seed); });
    await journey.step('When I GET /brands/<that id>', async () => { res = await api.get(EP.brandsById(id)); });
    await journey.step('Then the answer is 404', async () => {
      expectResponse(res, { status: REQ.STATUS.NOT_FOUND }, `[REQ AC-4] GET /brands/${id} with an unknown id answers 404`);
    });
  });

  // from story.md#L22, story.md#L24
  test('SCN-010: Every brand GET /brands answers is found by a brand search for its name in upper case', { tag: ['@AC-3', '@AC-5', '@type:composition', '@layer:api', '@P2'] }, async ({ api, journey }) => {
    let names: string[] = []; const found = new Map<string, string[]>();
    await journey.step('Given the brands GET /brands answers', async () => {
      const res = await api.get(EP.brands);
      expectResponse(res, { status: '2xx' }, '[REQ AC-3] GET /brands answers');
      names = (readBrands(res.body) ?? []).map(brandNameOf).filter(Boolean);
      expect(names.length, '[REQ AC-3] GET /brands answers the brands').toBeGreaterThan(0);
    });
    await journey.step('When I search each brand\'s name in upper case', async () => {
      for (const name of names) {
        const res = await api.get(EP.brandsSearch, { params: { q: name.toUpperCase() } });
        found.set(name, (readBrands(res.body) ?? []).map(brandNameOf));
      }
    });
    await journey.step('Then each search finds its brand', async () => {
      for (const name of names) expect.soft(found.get(name), `[REQ AC-5] GET /brands/search?q=${name.toUpperCase()} finds "${name}"`).toContain(name);
    });
  });

  // from story.md#L24, story.md#L23, story.md#L21
  test('SCN-011: A brand found by search is the brand GET /brands/{id} answers, and GET /products?by_brand lists only its products', { tag: ['@AC-5', '@AC-4', '@AC-2', '@type:composition', '@layer:api', '@P2'] }, async ({ api, journey }) => {
    const { q, finds } = REQ.SEARCH_CASES[0]; let id = '';
    await journey.step(`When I search brands for "${q}"`, async () => {
      const res = await api.get(EP.brandsSearch, { params: { q } });
      const found = (readBrands(res.body) ?? []).find((b) => brandNameOf(b) === finds);
      expect(found, `[REQ AC-5] GET /brands/search?q=${q} finds "${finds}"`).toBeTruthy();
      id = brandIdOf(found!);
    });
    await journey.step(`Then GET /brands/<its id> answers ${finds}`, async () => {
      const res = await api.get(EP.brandsById(id));
      expectResponse(res, { status: '2xx' }, `[REQ AC-4] GET /brands/${id} answers`);
      expect(brandNameOf((res.body ?? {}) as Record<string, unknown>), `[REQ AC-4] GET /brands/${id} answers "${finds}"`).toBe(finds);
    });
    await journey.step(`Then GET /products?by_brand=<its id> lists only products of ${finds}`, async () => {
      const res = await api.get(EP.products, { params: { by_brand: id } });
      expectResponse(res, { status: '2xx' }, `[REQ AC-2] GET /products?by_brand=${id} answers`);
      const others = (readProducts(res.body) ?? []).filter((p) => productBrandId(p) !== id).map(productNameOf);
      expect(others, `[REQ AC-2] GET /products?by_brand=${id} answers only products of "${finds}"`).toEqual([]);
    });
  });
});
