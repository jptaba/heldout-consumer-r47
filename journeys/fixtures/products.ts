/**
 * Products: the shop page with its product list and filters, and the catalogue API's product answers (HOW only; no
 * expected value).
 */
import { expect, gotoPage, type Api, type Locator, type Page, type Seed } from '../../heldout-support/fixtures';

type Product = Record<string, unknown>;

/** The product cards of the shop page's current list page. */
const cards = (page: Page): Locator => page.locator('[data-test^="product-"]').filter({ has: page.getByTestId('product-name') });

/**
 * The checkbox group of a filter: the element right after the heading the shop page shows above it. The heading is a
 * sibling of its group, not its parent, and the page writes it with a trailing colon.
 */
const filterGroup = (page: Page, heading: string): Locator => {
  const name = new RegExp('^' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':?$');
  return page.getByRole('heading', { name }).locator('xpath=following-sibling::*[1]');
};

/** Open the shop page and wait until it lists products. */
export async function openShop(page: Page): Promise<void> {
  await gotoPage(page, '/');
  await expect(cards(page).first(), 'the shop page lists products (precondition)').toBeVisible({ timeout: 15_000 });
}

/** The labels of the checkboxes of the shop page's filter under the given heading. */
export async function filterOptions(page: Page, heading: string): Promise<string[]> {
  const boxes = filterGroup(page, heading).locator('label');
  return (await boxes.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

/** The ids of the products the cards of the current list page link to (a card's link ends with its product's id). */
async function shownProductIds(page: Page): Promise<string[]> {
  const links = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? e.querySelector('a')?.getAttribute('href') ?? ''));
  return links.map((href) => href.split('/').filter(Boolean).pop() ?? '');
}

/**
 * Do what makes the shop page load another product list, and wait until its cards are the products that list's answer
 * holds. The page answers before it re-renders the cards, and two lists can begin with the same product, so neither
 * the answer nor a change of the first card says the new list is shown.
 */
async function reloadList(page: Page, action: () => Promise<void>, what: string): Promise<void> {
  // The page loads its list with a QUERY request, which the browser preflights: the answer is the non-OPTIONS call.
  const answered = page.waitForResponse((r) => r.request().method() !== 'OPTIONS' && /\/products$/.test(new URL(r.url()).pathname), { timeout: 15_000 });
  await action();
  const res = await answered;
  const ids = (readProducts(await res.json().catch(() => undefined)) ?? []).map((p) => String(p.id ?? ''));
  await expect.poll(async () => (await shownProductIds(page)).sort(), { message: `${what} (precondition)`, timeout: 10_000 }).toEqual([...ids].sort());
}

/** Tick one option of the shop page's filter under the given heading, and wait until the product list shows its products. */
export async function tickFilter(page: Page, heading: string, option: string): Promise<void> {
  const box = filterGroup(page, heading).getByRole('checkbox', { name: option, exact: true });
  await reloadList(page, () => box.check(), `the list filtered by "${option}" is shown`);
}

/** The names of the products the shop page's current list page shows. */
export async function shownProductNames(page: Page): Promise<string[]> {
  return (await cards(page).getByTestId('product-name').allInnerTexts()).map((t) => t.trim());
}

/** The names of the products the shop page shows over all its list pages, going through its pagination. */
export async function shownProductNamesAllPages(page: Page): Promise<string[]> {
  const names = await shownProductNames(page);
  for (let i = 0; i < 50; i++) {
    const next = page.getByRole('button', { name: 'Next', exact: true });
    // On the last page the button stays clickable: only its list item is marked disabled.
    if (!(await next.isVisible()) || /\bdisabled\b/.test((await next.locator('xpath=..').getAttribute('class')) ?? '')) break;
    await reloadList(page, () => next.click(), 'the next list page is shown');
    names.push(...(await shownProductNames(page)));
  }
  return names;
}

/**
 * The brand name of each product the shop page's current list page shows, read from each product's record
 * (GET /products/{id}, a lookup) since a card may not show its brand.
 */
export async function brandsOfShownProducts(page: Page, api: Api): Promise<string[]> {
  const brands: string[] = [];
  for (const id of await shownProductIds(page)) {
    const res = await api.get(`/products/${id}`);
    expect(res.ok, `read the product ${id} (precondition)`).toBe(true);
    brands.push(productBrandName(res.body as Product));
  }
  return brands;
}

/** The products of a GET /products answer as a list; undefined when the answer holds no list. */
export function readProducts(body: unknown): Product[] | undefined {
  if (Array.isArray(body)) return body as Product[];
  const v = body && typeof body === 'object' ? (body as Record<string, unknown>).data : undefined;
  return Array.isArray(v) ? (v as Product[]) : undefined;
}

/** The last page number of a paginated GET /products answer (1 when the answer is not paginated). */
export function lastPageOf(body: unknown): number {
  const v = body && typeof body === 'object' ? (body as Record<string, unknown>).last_page : undefined;
  return typeof v === 'number' && v > 0 ? v : 1;
}

/** The id of the brand a product record of the API's answers belongs to, as text. */
export function productBrandId(product: Product): string {
  const brand = product.brand as Record<string, unknown> | undefined;
  return String(brand?.id ?? '');
}

/** The name of the brand a product record of the API's answers belongs to. */
export function productBrandName(product: Product): string {
  const brand = product.brand as Record<string, unknown> | undefined;
  return String(brand?.name ?? '');
}

/** The name of a product record of the API's answers. */
export function productNameOf(product: Product): string {
  return String(product.name ?? '');
}

/** Whether a product record of the API's answers says it is in stock. */
const inStock = (product: Product): boolean =>
  product.in_stock === true || (product.in_stock === undefined && product.is_rental !== true && product.stock !== 0);

/**
 * Products of the catalogue that are in stock, as their ids and names (a lookup of GET /products, made once per
 * worker; no cleanup). At least `count` of them, or the step fails.
 */
export async function productsInStock(api: Api, seed: Seed, count = 1): Promise<{ id: string; name: string }[]> {
  const found = await seed.once('products-in-stock', 'look up products in stock (GET /products)', async () => {
    const res = await api.get('/products');
    expect(res.ok, 'list the products (precondition)').toBe(true);
    return (readProducts(res.body) ?? []).filter(inStock).map((p) => ({ id: String(p.id ?? ''), name: productNameOf(p) })).filter((p) => p.id);
  });
  expect(found.length, `${count} product(s) in stock (precondition)`).toBeGreaterThanOrEqual(count);
  return found.slice(0, count);
}

/** Open a product's page in the web shop and wait until it shows the product. */
export async function openProduct(page: Page, id: string): Promise<void> {
  await gotoPage(page, `/product/${id}`);
  await expect(page.getByTestId('product-name').first(), 'the product page is ready (precondition)').toBeVisible({ timeout: 15_000 });
}
