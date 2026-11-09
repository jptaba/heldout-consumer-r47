/**
 * Brands: how the catalogue's brands are read through the API (HOW only; no expected value).
 */
import { expect, type Api, type Seed } from '../../heldout-support/fixtures';

type Brand = Record<string, unknown>;

/** The list in an answer: GET /brands and GET /brands/search answer a bare array. */
function listIn(body: unknown): Brand[] | undefined {
  return Array.isArray(body) ? (body as Brand[]) : undefined;
}

/** Read the brands of a GET /brands or GET /brands/search answer as a list; undefined when the answer holds no list. */
export function readBrands(body: unknown): Brand[] | undefined {
  return listIn(body);
}

/** The name of a brand record of the API's answers, as text. */
export function brandNameOf(brand: Brand): string {
  return String(brand.name ?? '');
}

/** The id of a brand record of the API's answers, as text. */
export function brandIdOf(brand: Brand): string {
  return String(brand.id ?? '');
}

/** Look up an existing brand by its name in GET /brands; returns its id and name (a lookup, no cleanup). */
export async function findBrand(api: Api, seed: Seed, name: string): Promise<{ id: string; name: string }> {
  return seed.step(`look up the brand "${name}" (GET /brands)`, async () => {
    const res = await api.get('/brands');
    const found = (listIn(res.body) ?? []).find((b) => brandNameOf(b) === name);
    expect(found, `the brand "${name}" is listed by GET /brands (precondition)`).toBeTruthy();
    return { id: brandIdOf(found!), name: brandNameOf(found!) };
  });
}

/** The names of every brand GET /brands lists (a lookup, no cleanup). */
export async function allBrandNames(api: Api, seed: Seed): Promise<string[]> {
  return seed.step('look up the brands (GET /brands)', async () => {
    const res = await api.get('/brands');
    const list = listIn(res.body);
    expect(list, 'GET /brands answers a list (precondition)').toBeTruthy();
    return list!.map(brandNameOf);
  });
}

/**
 * An id in the form of the application's brand ids that no brand has: checked against GET /brands, since the tests
 * can't create and delete a brand (brand admin is another story).
 */
export async function unknownBrandId(api: Api, seed: Seed): Promise<string> {
  return seed.step('make up a brand id no brand has (GET /brands)', async () => {
    const res = await api.get('/brands');
    const ids = (listIn(res.body) ?? []).map(brandIdOf).filter(Boolean);
    expect(ids.length, 'GET /brands lists brands to take the id form from (precondition)').toBeGreaterThan(0);
    // A brand id is a fixed-length string (a ULID): the same length, all zeros but the last character.
    const candidate = ids[0].replace(/[0-9A-Za-z]/g, '0').replace(/0$/, '1');
    expect(ids, 'the made-up id is not a brand id (precondition)').not.toContain(candidate);
    return candidate;
  });
}
