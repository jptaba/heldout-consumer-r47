/**
 * Held-out acceptance tests for TOOL-3 — "Shopping cart for guests".
 * Written from the requirement contract (the requirement only; never from the AUT's code). The steps call the
 * journeys in journeys/fixtures/ (npm run heldout -- journeys TOOL-3); every expectation stays here.
 * Guests are not signed in and carts are anonymous: no test signs in or sends credentials.
 */
import { test, expect, expectResponse, type Api, type ApiResponse } from '../../../../heldout-support/fixtures';
import { productsInStock, openProduct } from '../../../../journeys/fixtures/products';
import {
  createCart, addToCart, readCartLines, sendReadCart, sendDeleteCart, removeCart, cartLines, errorMessageOf, fieldErrorOf,
  deletedCartId, unknownCartId, addToCartOnPage, fillWebShopCart, cartIconCount, openCartPage, cartPageRows, cartTotal,
  cartTotalValue, type CartLine, type CartRow,
} from '../../../../journeys/fixtures/carts';

// ASSUMPTION: G6 — conflicting criteria for deleting a cart that was already deleted: AC-7 (L27) says it responds 204, AC-8 (L28) says any request for a cart that does not exist responds 404 with the message "Cart not found": The specific criterion is an exception to the general one: deleting a cart that was already deleted responds 204 (AC-7); every other request for a cart that does not exist responds 404 with "Cart not found" (AC-8). Reason: AC-7 names this case explicitly and calls deletion idempotent, which a 404 on the second delete would contradict.
// ASSUMPTION: G7 — what "the total number of items" on the cart icon counts: the sum of the quantities in the cart, or the number of different products: the sum of the quantities of all products in the cart (a quantity chosen on the product page adds that many items)
// ASSUMPTION: G8 — what the cart total on the cart page must equal: the sum of the line totals, or that plus other charges: the cart total is the sum of the line totals of the products listed
// ASSUMPTION: G6 — under the assumed reading, deleting a cart id no cart was ever given is "a request for a cart that does not exist" (AC-8, 404 "Cart not found"); only a cart that was deleted before answers 204 on a second delete (SCN-016). SCN-008.4 sends the delete at a made-up id for that reason.
// ASSUMPTION: what each test asserts, so no rule fails in many places: the 422 status of a rejected quantity is asserted by the SCN-003 rows only; its error for the quantity field by SCN-011, the unchanged cart by SCN-012. The 200 and the cart's contents of an accepted quantity are asserted by SCN-002 (a mid-range quantity) and the SCN-009 rows (1 and 99); the sum of a repeated add by SCN-010. On the cart page, SCN-005 checks the rows, their quantities and that unit prices and a cart total are shown; SCN-014 the line totals; SCN-015 the cart total's sum.

// @req-constants-start — expected outcomes copied verbatim from TOOL-3 (never edit during hardening)
const REQ = {
  STATUS: { OK: 200, CREATED: 201, NO_CONTENT: 204, NOT_FOUND: 404, UNPROCESSABLE: 422 },
  CART_NOT_FOUND: 'Cart not found',
  ADDED_MESSAGE: 'Product added to shopping cart.',
  QUANTITY_FIELD: 'quantity',
  QUANTITY: { MIN: 1, MAX: 99 },
  ACCEPTED_QUANTITIES: [1, 99],
  REJECTED_QUANTITIES: [0, 100],
} as const;
// @req-constants-end

// Endpoints exactly as declared in the requirement.
const EP = {
  /** POST /carts */ carts: '/carts',
  /** POST /carts/{id} */ cartsById: (id: string | number) => `/carts/${id}`,
  /** DELETE /carts/{id}/product/{productId} */ cartsProductByIdAndProductId: (id: string | number, productId: string | number) => `/carts/${id}/product/${productId}`,
};

// Inputs (swappable): the quantities the tests add, inside 1–99.
const QTY = { SOME: 3, REPEATED: 2, FIRST: 2, SECOND: 3, ALREADY: 2 };

const lineOf = (lines: CartLine[], productId: string) => lines.find((l) => l.productId === productId);
// The exact name first: a product's name can be part of another's ("Pliers" in "Combination Pliers").
const rowOf = (rows: CartRow[], name: string) => rows.find((r) => r.name === name) ?? rows.find((r) => r.name.includes(name));

test.describe('TOOL-3 Shopping cart for guests', () => {
  // from story.md#L21
  test('SCN-001: A guest creates a cart and gets its id, and the cart is empty', { tag: ['@AC-1', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let res!: ApiResponse; let id = '';
    await journey.step('Given I am a guest who is not signed in', async () => { /* no credentials are sent */ });
    await journey.step('When I POST /carts', async () => {
      res = await api.post(EP.carts);
      id = String((res.body as { id?: unknown } | undefined)?.id ?? '');
      if (id) seed.track('the cart under test', id, (c) => removeCart(api, c));
    });
    await journey.step('Then the answer is 201 with the new cart\'s id', async () => {
      expectResponse(res, { status: REQ.STATUS.CREATED }, '[REQ AC-1] POST /carts');
      expect(id, '[REQ AC-1] POST /carts answers the new cart\'s id').not.toBe('');
    });
    await journey.step('Then the new cart holds no products', async () => {
      expect(await readCartLines(api, seed, id), '[REQ AC-1] the cart POST /carts created is empty').toEqual([]);
    });
  });

  // from story.md#L22
  test('SCN-002: A guest adds a product to a cart', { tag: ['@AC-2', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
    await journey.step('Given a guest\'s empty cart and a product in stock', async () => {
      cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
    });
    await journey.step(`When I POST /carts/{id} with the product and quantity ${QTY.SOME}`, async () => {
      res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: QTY.SOME } });
    });
    await journey.step('Then the answer is 200', async () => {
      expectResponse(res, { status: REQ.STATUS.OK }, '[REQ AC-2] POST /carts/{id}');
    });
    await journey.step('Then the cart holds the product with the quantity added', async () => {
      const line = lineOf(await readCartLines(api, seed, cart), product.id);
      expect(line?.quantity, '[REQ AC-2] after POST /carts/{id} the cart holds the product with its quantity').toBe(QTY.SOME);
    });
  });

  // A table of cases: the quantities just outside 1–99.
  // from story.md#L23
  REQ.REJECTED_QUANTITIES.forEach((quantity, i) => {
    test(`SCN-003.${i + 1}: A quantity of ${quantity} is rejected with 422`, { tag: ['@AC-3', '@type:boundary', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
      let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
      await journey.step('Given a guest\'s cart and a product in stock', async () => {
        cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
      });
      await journey.step(`When I POST /carts/{id} with the product and quantity ${quantity}`, async () => {
        res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity } });
      });
      await journey.step('Then the answer is 422', async () => {
        expectResponse(res, { status: REQ.STATUS.UNPROCESSABLE }, '[REQ AC-3] POST /carts/{id} with a quantity outside 1–99');
      });
    });
  });

  // from story.md#L24
  test('SCN-004: A guest adds a product on its page and is told it was added', { tag: ['@AC-4', '@type:functional', '@layer:ui', '@P1'] }, async ({ page, api, journey, seed }) => {
    await journey.step('Given I am a guest on the page of a product in stock', async () => {
      const [product] = await productsInStock(api, seed);
      await openProduct(page, product.id);
    });
    await journey.step(`When I choose quantity ${QTY.SOME} and press "Add to cart"`, async () => {
      const cart = await addToCartOnPage(page, QTY.SOME);
      if (cart) seed.track('the web shop\'s cart', cart, (c) => removeCart(api, c));
    });
    await journey.step(`Then I see "${REQ.ADDED_MESSAGE}"`, async () => {
      await expect(page.getByText(REQ.ADDED_MESSAGE), '[REQ AC-4] the confirmation is shown').toBeVisible();
    });
  });

  // from story.md#L25
  test('SCN-005: The cart page lists each product with its quantity and unit price, and a cart total', { tag: ['@AC-5', '@type:functional', '@layer:ui', '@P1'] }, async ({ page, api, journey, seed }) => {
    let products!: { id: string; name: string }[]; let rows!: CartRow[];
    await journey.step('Given I added two products in stock to the cart on their pages', async () => {
      products = await productsInStock(api, seed, 2);
      await fillWebShopCart(page, api, seed, [{ id: products[0].id, quantity: QTY.FIRST }, { id: products[1].id, quantity: QTY.SECOND }]);
    });
    await journey.step('When I open the cart page', async () => { await openCartPage(page); rows = await cartPageRows(page); });
    await journey.step('Then each product is listed with the quantity I added', async () => {
      const first = rowOf(rows, products[0].name); const second = rowOf(rows, products[1].name);
      expect.soft(first, '[REQ AC-5] the cart page lists the first product').toBeDefined();
      expect.soft(second, '[REQ AC-5] the cart page lists the second product').toBeDefined();
      expect.soft(first?.quantity, '[REQ AC-5] the cart page shows the first product\'s quantity').toBe(QTY.FIRST);
      expect.soft(second?.quantity, '[REQ AC-5] the cart page shows the second product\'s quantity').toBe(QTY.SECOND);
    });
    await journey.step('Then each product shows a unit price', async () => {
      for (const row of rows) expect.soft(Number.isFinite(row.unitPrice), `[REQ AC-5] the cart page shows a unit price for "${row.name}"`).toBe(true);
    });
    await journey.step('Then the page shows the cart total', async () => {
      await expect(cartTotal(page), '[REQ AC-5] the cart page shows the cart total').toBeVisible();
      expect(Number.isFinite(await cartTotalValue(page)), '[REQ AC-5] the cart total is an amount').toBe(true);
    });
  });

  // from story.md#L26
  test('SCN-006: A guest removes a product from a cart', { tag: ['@AC-6', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
    await journey.step('Given a guest\'s cart that holds a product', async () => {
      cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
      await addToCart(api, seed, cart, product.id, QTY.ALREADY);
    });
    await journey.step('When I DELETE /carts/{id}/product/{productId}', async () => {
      res = await api.delete(EP.cartsProductByIdAndProductId(cart, product.id));
    });
    await journey.step('Then the answer is 204', async () => {
      expectResponse(res, { status: REQ.STATUS.NO_CONTENT }, '[REQ AC-6] DELETE /carts/{id}/product/{productId}');
    });
    await journey.step('Then the cart no longer lists the product', async () => {
      expect(lineOf(await readCartLines(api, seed, cart), product.id), '[REQ AC-6] after DELETE /carts/{id}/product/{productId} the cart no longer lists it').toBeUndefined();
    });
  });

  // from story.md#L27
  test('SCN-007: A guest deletes a cart', { tag: ['@AC-7', '@type:functional', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let res!: ApiResponse;
    await journey.step('Given a guest\'s cart', async () => { cart = await createCart(api, seed); });
    await journey.step('When I delete the cart', async () => { res = await sendDeleteCart(api, cart); });
    await journey.step('Then the answer is 204', async () => {
      expectResponse(res, { status: REQ.STATUS.NO_CONTENT }, '[REQ AC-7] deleting a cart');
    });
  });

  // A table of cases: every kind of request for a cart that does not exist.
  const MISSING = [
    { what: 'adding a product to', cart: 'deleted', send: (api: Api, id: string, productId: string) => api.post(EP.cartsById(id), { data: { product_id: productId, quantity: REQ.QUANTITY.MIN } }) },
    { what: 'removing a product from', cart: 'deleted', send: (api: Api, id: string, productId: string) => api.delete(EP.cartsProductByIdAndProductId(id, productId)) },
    { what: 'reading', cart: 'deleted', send: (api: Api, id: string) => sendReadCart(api, id) },
    { what: 'deleting', cart: 'never created', send: (api: Api, id: string) => sendDeleteCart(api, id) },
  ] as const;
  // from story.md#L28
  MISSING.forEach((row, i) => {
    test(`SCN-008.${i + 1}: ${row.what} a cart that does not exist (${row.cart}) answers 404 "Cart not found"`, { tag: ['@AC-8', '@type:negative', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
      let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
      await journey.step(`Given a cart id that no cart has (${row.cart}) and a product in stock`, async () => {
        cart = row.cart === 'deleted' ? await deletedCartId(api, seed) : await unknownCartId(api, seed);
        [product] = await productsInStock(api, seed);
      });
      await journey.step(`When I send the request for ${row.what} that cart`, async () => { res = await row.send(api, cart, product.id); });
      await journey.step('Then the answer is 404 with the message "Cart not found"', async () => {
        expectResponse(res, { status: REQ.STATUS.NOT_FOUND }, '[REQ AC-8] a request for a cart that does not exist');
        expect.soft(errorMessageOf(res.body), '[REQ AC-8] a request for a cart that does not exist says "Cart not found"').toBe(REQ.CART_NOT_FOUND);
      });
    });
  });

  // A table of cases: the limits of 1–99, accepted.
  // from story.md#L22
  REQ.ACCEPTED_QUANTITIES.forEach((quantity, i) => {
    test(`SCN-009.${i + 1}: A quantity of ${quantity} is accepted`, { tag: ['@AC-2', '@type:boundary', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
      let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
      await journey.step('Given a guest\'s empty cart and a product in stock', async () => {
        cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
      });
      await journey.step(`When I POST /carts/{id} with the product and quantity ${quantity}`, async () => {
        res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity } });
      });
      await journey.step('Then the answer is 200', async () => {
        expectResponse(res, { status: REQ.STATUS.OK }, '[REQ AC-2] POST /carts/{id} with a quantity of 1 or 99');
      });
      await journey.step(`Then the cart holds the product with quantity ${quantity}`, async () => {
        expect(lineOf(await readCartLines(api, seed, cart), product.id)?.quantity, '[REQ AC-2] after POST /carts/{id} the cart holds the product with the quantity at the limit').toBe(quantity);
      });
    });
  });

  // from story.md#L22
  test('SCN-010: Adding a product already in the cart again increases its quantity by the amount added', { tag: ['@AC-2', '@type:idempotency', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string }; const answers: number[] = [];
    await journey.step('Given a guest\'s empty cart and a product in stock', async () => {
      cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
    });
    await journey.step(`When I POST /carts/{id} with the product and quantity ${QTY.REPEATED}`, async () => {
      answers.push((await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: QTY.REPEATED } })).status);
    });
    await journey.step(`When I send the same POST /carts/{id} again`, async () => {
      answers.push((await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: QTY.REPEATED } })).status);
    });
    await journey.step('Then both answers are 200', async () => {
      expect.soft(answers, '[REQ AC-2] POST /carts/{id} sent twice answers 200 both times').toEqual([REQ.STATUS.OK, REQ.STATUS.OK]);
    });
    await journey.step('Then the cart holds the product once, with both amounts added up', async () => {
      const lines = (await readCartLines(api, seed, cart)).filter((l) => l.productId === product.id);
      expect.soft(lines.length, '[REQ AC-2] after the second POST /carts/{id} the product is in the cart once').toBe(1);
      expect(lines[0]?.quantity, '[REQ AC-2] after the second POST /carts/{id} its quantity increased by the amount added').toBe(QTY.REPEATED + QTY.REPEATED);
    });
  });

  // from story.md#L23
  test('SCN-011: A rejected quantity comes with an error for the quantity field', { tag: ['@AC-3', '@type:negative', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string }; let res!: ApiResponse;
    await journey.step('Given a guest\'s cart and a product in stock', async () => {
      cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
    });
    await journey.step(`When I POST /carts/{id} with the product and quantity ${REQ.QUANTITY.MAX + 1}`, async () => {
      res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: REQ.QUANTITY.MAX + 1 } });
    });
    await journey.step('Then the request is refused with an error for the quantity field', async () => {
      expectResponse(res, { status: '4xx' }, '[REQ AC-3] POST /carts/{id} with a quantity outside 1–99 is refused');
      expect(fieldErrorOf(res.body, REQ.QUANTITY_FIELD), '[REQ AC-3] POST /carts/{id} answers an error for the quantity field').toBeTruthy();
    });
  });

  // from story.md#L23
  test('SCN-012: A rejected quantity leaves the cart unchanged', { tag: ['@AC-3', '@type:negative', '@layer:api', '@P1'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string }; let before!: CartLine[];
    await journey.step(`Given a guest's cart that holds ${QTY.ALREADY} of a product`, async () => {
      cart = await createCart(api, seed); [product] = await productsInStock(api, seed);
      await addToCart(api, seed, cart, product.id, QTY.ALREADY);
      before = await readCartLines(api, seed, cart);
    });
    await journey.step(`When I POST /carts/{id} with the same product and quantity ${REQ.QUANTITY.MIN - 1}`, async () => {
      await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: REQ.QUANTITY.MIN - 1 } });
    });
    await journey.step('Then the cart holds what it held before', async () => {
      expect(await readCartLines(api, seed, cart), '[REQ AC-3] after a rejected POST /carts/{id} the cart is unchanged').toEqual(before);
    });
  });

  // from story.md#L24
  test('SCN-013: The cart icon shows the total number of items in the cart', { tag: ['@AC-4', '@type:functional', '@layer:ui', '@P1', '@assumes:G7'] }, async ({ page, api, journey, seed }) => {
    let products!: { id: string; name: string }[];
    await journey.step(`Given I added ${QTY.FIRST} of a product to the cart on its page`, async () => {
      products = await productsInStock(api, seed, 2);
      await fillWebShopCart(page, api, seed, [{ id: products[0].id, quantity: QTY.FIRST }]);
    });
    await journey.step('Given I am on the page of another product in stock', async () => { await openProduct(page, products[1].id); });
    await journey.step(`When I choose quantity ${QTY.SECOND} and press "Add to cart"`, async () => { await addToCartOnPage(page, QTY.SECOND); });
    await journey.step(`Then the cart icon shows ${QTY.FIRST + QTY.SECOND}`, async () => {
      await expect(cartIconCount(page), '[REQ AC-4] the cart icon shows the total number of items').toHaveText(String(QTY.FIRST + QTY.SECOND));
    });
  });

  // from story.md#L25
  test('SCN-014: Each line total on the cart page is price × quantity', { tag: ['@AC-5', '@type:functional', '@layer:ui', '@P1'] }, async ({ page, api, journey, seed }) => {
    let rows!: CartRow[];
    await journey.step('Given I added two products in stock to the cart on their pages', async () => {
      const products = await productsInStock(api, seed, 2);
      await fillWebShopCart(page, api, seed, [{ id: products[0].id, quantity: QTY.FIRST }, { id: products[1].id, quantity: QTY.SECOND }]);
    });
    await journey.step('When I open the cart page', async () => { await openCartPage(page); rows = await cartPageRows(page); });
    await journey.step('Then each line total is the unit price times the quantity', async () => {
      expect(rows.length, 'the cart page shows rows (precondition)').toBeGreaterThan(0);
      for (const row of rows) expect.soft(row.lineTotal, `[REQ AC-5] the line total of "${row.name}" is price × quantity`).toBeCloseTo(row.unitPrice * row.quantity, 2);
    });
  });

  // from story.md#L25
  test('SCN-015: The cart total on the cart page is the sum of the line totals', { tag: ['@AC-5', '@type:functional', '@layer:ui', '@P1', '@assumes:G8'] }, async ({ page, api, journey, seed }) => {
    let rows!: CartRow[];
    await journey.step('Given I added two products in stock to the cart on their pages', async () => {
      const products = await productsInStock(api, seed, 2);
      await fillWebShopCart(page, api, seed, [{ id: products[0].id, quantity: QTY.FIRST }, { id: products[1].id, quantity: QTY.SECOND }]);
    });
    await journey.step('When I open the cart page', async () => { await openCartPage(page); rows = await cartPageRows(page); });
    await journey.step('Then the cart total is the sum of the line totals', async () => {
      const sum = rows.reduce((s, r) => s + r.lineTotal, 0);
      expect(await cartTotalValue(page), '[REQ AC-5] the cart total is the sum of the line totals').toBeCloseTo(sum, 2);
    });
  });

  // from story.md#L27
  test('SCN-016: Deleting a cart that was already deleted also answers 204', { tag: ['@AC-7', '@type:idempotency', '@layer:api', '@P1', '@assumes:G6'] }, async ({ api, journey, seed }) => {
    let cart = ''; let first!: ApiResponse; let again!: ApiResponse;
    await journey.step('Given a guest\'s cart', async () => { cart = await createCart(api, seed); });
    await journey.step('When I delete the cart', async () => { first = await sendDeleteCart(api, cart); });
    await journey.step('When I delete the same cart again', async () => { again = await sendDeleteCart(api, cart); });
    await journey.step('Then the second delete answers 204 too', async () => {
      expect(first.ok, 'the first delete went through (precondition)').toBe(true);
      expectResponse(again, { status: REQ.STATUS.NO_CONTENT }, '[REQ AC-7] deleting a cart that was already deleted');
    });
  });

  // from story.md#L21, story.md#L22, story.md#L26, story.md#L27, story.md#L28
  test('SCN-017: A guest\'s cart from creation to deletion', { tag: ['@AC-1', '@AC-2', '@AC-6', '@AC-7', '@AC-8', '@type:composition', '@layer:api', '@P2'] }, async ({ api, journey, seed }) => {
    let cart = ''; let product!: { id: string; name: string };
    await journey.step('Given a product in stock', async () => { [product] = await productsInStock(api, seed); });
    await journey.step('When I POST /carts', async () => {
      const res = await api.post(EP.carts);
      expectResponse(res, { status: REQ.STATUS.CREATED }, '[REQ AC-1] POST /carts');
      cart = String((res.body as { id?: unknown } | undefined)?.id ?? '');
      expect(cart, '[REQ AC-1] POST /carts answers the new cart\'s id').not.toBe('');
      seed.track('the cart under test', cart, (c) => removeCart(api, c));
    });
    await journey.step(`When I add ${QTY.SOME} of the product to that cart`, async () => {
      const res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: QTY.SOME } });
      expectResponse(res, { status: REQ.STATUS.OK }, '[REQ AC-2] POST /carts/{id} on the cart POST /carts created');
      const read = await sendReadCart(api, cart);
      expect(lineOf(cartLines(read.body), product.id)?.quantity, '[REQ AC-2] the cart holds the product added to it').toBe(QTY.SOME);
    });
    await journey.step('When I remove the product from that cart', async () => {
      const res = await api.delete(EP.cartsProductByIdAndProductId(cart, product.id));
      expectResponse(res, { status: REQ.STATUS.NO_CONTENT }, '[REQ AC-6] DELETE /carts/{id}/product/{productId} of the product added');
      const read = await sendReadCart(api, cart);
      expect(lineOf(cartLines(read.body), product.id), '[REQ AC-6] the cart no longer lists the removed product').toBeUndefined();
    });
    await journey.step('When I delete that cart', async () => {
      expectResponse(await sendDeleteCart(api, cart), { status: REQ.STATUS.NO_CONTENT }, '[REQ AC-7] deleting the cart');
    });
    await journey.step('Then adding a product to the deleted cart answers 404 "Cart not found"', async () => {
      const res = await api.post(EP.cartsById(cart), { data: { product_id: product.id, quantity: QTY.SOME } });
      expectResponse(res, { status: REQ.STATUS.NOT_FOUND }, '[REQ AC-8] POST /carts/{id} on the deleted cart');
      expect.soft(errorMessageOf(res.body), '[REQ AC-8] POST /carts/{id} on the deleted cart says "Cart not found"').toBe(REQ.CART_NOT_FOUND);
    });
  });
});
