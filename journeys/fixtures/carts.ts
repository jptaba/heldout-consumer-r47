/**
 * Carts: a visitor's cart through the API (create, add, read, remove, delete) and in the web shop (add on a product
 * page, the cart icon, the cart page). HOW only; no expected value.
 */
import { expect, gotoPage, type Api, type ApiResponse, type Locator, type Page, type Seed } from '../../heldout-support/fixtures';
import { openProduct } from './products';

/** One line of a cart as the tests compare it: the product and how many of it. */
export interface CartLine { productId: string; quantity: number }

/** One row of the cart page, read as text and numbers. */
export interface CartRow { name: string; quantity: number; unitPrice: number; lineTotal: number }

/** A money or count text read as a number ("$14.15" → 14.15); NaN when it holds none. */
const numberIn = (text: string): number => {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/** The id in a POST /carts answer, as text. */
const idIn = (body: unknown): string => String((body as { id?: unknown } | undefined)?.id ?? '');

/** Send the request that deletes a cart and return its raw answer. */
export async function sendDeleteCart(api: Api, cartId: string): Promise<ApiResponse> {
  return api.delete(`/carts/${cartId}`);
}

/** Send the request that reads a cart and return its raw answer. */
export async function sendReadCart(api: Api, cartId: string): Promise<ApiResponse> {
  return api.get(`/carts/${cartId}`);
}

/** Remove a cart after a test; an answer that says it is already gone counts as removed. */
export async function removeCart(api: Api, cartId: string): Promise<void> {
  const res = await sendDeleteCart(api, cartId);
  if (!res.ok && res.status !== 404) throw new Error(`removing the cart ${cartId} answered ${res.status}`);
}

/** The lines of a read cart's answer: each product it holds and its quantity (an empty list when it holds none). */
export function cartLines(body: unknown): CartLine[] {
  const b = (body ?? {}) as Record<string, unknown>;
  const items = (b.cart_items ?? b.items ?? []) as Record<string, unknown>[];
  if (!Array.isArray(items)) return [];
  return items.map((i) => ({
    productId: String(i.product_id ?? (i.product as Record<string, unknown> | undefined)?.id ?? ''),
    quantity: Number(i.quantity ?? NaN),
  }));
}

/** The message of an error answer ({ message } or a bare text); undefined when it has none. */
export function errorMessageOf(body: unknown): string | undefined {
  if (typeof body === 'string') return body.trim() || undefined;
  const m = (body as { message?: unknown } | undefined)?.message;
  return typeof m === 'string' ? m : undefined;
}

/** The error a validation answer gives for one field (joined when it lists several); undefined when it names none. */
export function fieldErrorOf(body: unknown, field: string): string | undefined {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors = (b.errors && typeof b.errors === 'object' ? b.errors : b) as Record<string, unknown>;
  const v = errors[field];
  if (Array.isArray(v)) return v.map(String).join(' ') || undefined;
  return typeof v === 'string' && v ? v : undefined;
}

/** Create an empty cart through the API; deleted after the test. Returns its id. */
export async function createCart(api: Api, seed: Seed): Promise<string> {
  return seed.create('a cart (POST /carts)', async () => {
    const res = await api.post('/carts');
    expect(res.ok, 'create a cart (precondition)').toBe(true);
    const id = idIn(res.body);
    expect(id, 'the new cart has an id (precondition)').not.toBe('');
    return id;
  }, (id) => removeCart(api, id));
}

/** Add a product to a cart through the API as a precondition. */
export async function addToCart(api: Api, seed: Seed, cartId: string, productId: string, quantity: number): Promise<void> {
  await seed.step(`add ${quantity} of the product ${productId} to the cart (POST /carts/{id})`, async () => {
    const res = await api.post(`/carts/${cartId}`, { data: { product_id: productId, quantity } });
    expect(res.ok, 'add a product to the cart (precondition)').toBe(true);
  });
}

/** Read a cart's lines through the API as a precondition or a check of the test's own data. */
export async function readCartLines(api: Api, seed: Seed, cartId: string): Promise<CartLine[]> {
  return seed.step('read the cart (G1)', async () => {
    const res = await sendReadCart(api, cartId);
    expect(res.ok, 'read the cart (precondition)').toBe(true);
    return cartLines(res.body);
  });
}

/** The id of a cart that was created and then deleted, so no cart has it any more. */
export async function deletedCartId(api: Api, seed: Seed): Promise<string> {
  return seed.create('a cart that was deleted (POST /carts, then delete it)', async () => {
    const made = await api.post('/carts');
    expect(made.ok, 'create a cart (precondition)').toBe(true);
    const id = idIn(made.body);
    expect(id, 'the new cart has an id (precondition)').not.toBe('');
    const gone = await sendDeleteCart(api, id);
    expect(gone.ok, 'delete the cart (precondition)').toBe(true);
    return id;
  });
}

/**
 * An id in the format of the application's cart ids that no cart was ever given: made from a fresh cart's id (removed
 * after the test) by changing every letter and digit, and checked to read as no cart.
 */
export async function unknownCartId(api: Api, seed: Seed): Promise<string> {
  const real = await createCart(api, seed);
  return seed.step('make up a cart id no cart has', async () => {
    const made = /^\d+$/.test(real)
      ? String(Number(real) + 10_000_000)
      : real.replace(/[0-9]/g, '9').replace(/[a-z]/g, 'z').replace(/[A-Z]/g, 'Z');
    expect(made, 'the made-up id differs from the real one (precondition)').not.toBe(real);
    const res = await sendReadCart(api, made);
    expect(res.ok, 'no cart has the made-up id (precondition)').toBe(false);
    return made;
  });
}

/**
 * On an open product page, choose a quantity and press "Add to cart". Waits for the web shop's call that adds the
 * product, and returns the id of the cart it went to (undefined when no such call was seen).
 */
export async function addToCartOnPage(page: Page, quantity: number): Promise<string | undefined> {
  await page.getByTestId('quantity').fill(String(quantity));
  const added = page.waitForResponse((r) => r.request().method() === 'POST' && /\/carts\/[^/]+$/.test(new URL(r.url()).pathname), { timeout: 15_000 })
    .catch(() => undefined);
  await page.getByTestId('add-to-cart').click();
  const res = await added;
  return res ? new URL(res.url()).pathname.split('/').filter(Boolean).pop() : undefined;
}

/**
 * Put products into the web shop's cart the way a visitor does: open each product's page and add the quantity given.
 * The cart the web shop made is deleted after the test.
 */
export async function fillWebShopCart(page: Page, api: Api, seed: Seed, items: { id: string; quantity: number }[]): Promise<string> {
  return seed.create('products in the web shop\'s cart (on their product pages)', async () => {
    let cartId: string | undefined;
    for (const item of items) {
      await openProduct(page, item.id);
      cartId = (await addToCartOnPage(page, item.quantity)) ?? cartId;
    }
    expect(cartId, 'the web shop added the products to a cart (precondition)').toBeTruthy();
    return cartId!;
  }, (id) => removeCart(api, id));
}

/** The cart icon's count in the navigation. */
export function cartIconCount(page: Page): Locator {
  return page.getByTestId('cart-quantity');
}

/** The rows of the cart page. */
const cartRows = (page: Page): Locator => page.locator('table tbody tr');

/** Open the cart page (checkout step 1) and wait until it lists its products. */
export async function openCartPage(page: Page): Promise<void> {
  await gotoPage(page, '/checkout');
  await expect(cartRows(page).first(), 'the cart page lists products (precondition)').toBeVisible({ timeout: 15_000 });
}

/** The product rows the cart page shows: each one's name, quantity, unit price and line total. */
export async function cartPageRows(page: Page): Promise<CartRow[]> {
  const rows: CartRow[] = [];
  for (const row of await cartRows(page).all()) {
    const name = (await row.getByTestId('product-title').innerText()).trim();
    const qty = row.getByTestId('product-quantity');
    const quantity = numberIn((await qty.inputValue().catch(() => qty.innerText())) || '');
    const unitPrice = numberIn(await row.getByTestId('product-price').innerText());
    const lineTotal = numberIn(await row.getByTestId('line-price').innerText());
    rows.push({ name, quantity, unitPrice, lineTotal });
  }
  return rows;
}

/** The cart page's cart total. */
export function cartTotal(page: Page): Locator {
  return page.getByTestId('cart-total');
}

/** The cart page's cart total read as a number (NaN when it shows none). */
export async function cartTotalValue(page: Page): Promise<number> {
  return numberIn(await cartTotal(page).innerText());
}
