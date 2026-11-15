/**
 * Cache tags for `'use cache'` + cacheTag() on public reads, and updateTag() in server actions.
 *
 * Tags are per tenant, so a write to one restaurant never expires another restaurant's menu:
 * - A cached menu read is tagged with the tag of its own lookup key (`menuTag(slug)` or
 *   `domainTag(domain)`), so a cached "not found" is expired when a restaurant later takes that
 *   slug or domain, plus every tag in `menuTagsFor(restaurant)` when a restaurant was found.
 * - After ANY write that changes what guests see, call `updateTag` for every tag returned by
 *   `menuTagsFor(restaurant)` (old and new versions when the slug or custom domain changes).
 * - `RESTAURANT_LIST_TAG` is only on the list of public slugs. Update it only when the set of
 *   active restaurants or their slugs changes (create, delete, duplicate, slug, active flag).
 *   It is deliberately NOT part of `menuTagsFor`.
 */
export const menuTag = (slug: string) => `menu:${slug}`;
export const restaurantTag = (id: string) => `restaurant:${id}`;
export const domainTag = (domain: string) => `domain:${domain.toLowerCase()}`;
export const RESTAURANT_LIST_TAG = "restaurants";

/**
 * Tags of a custom domain and its www / non-www twin. Domain lookups fall back to the twin
 * ("www.client.com" serves the restaurant whose domain is "client.com" and vice versa), so a
 * change to either one must expire cached reads made under both keys.
 */
export function domainTagsFor(domain: string): string[] {
  const d = domain.toLowerCase();
  const twin = d.startsWith("www.") ? d.slice(4) : `www.${d}`;
  return twin ? [domainTag(d), domainTag(twin)] : [domainTag(d)];
}

export function menuTagsFor(r: { id: string; slug: string; customDomain?: string | null }): string[] {
  const tags = [menuTag(r.slug), restaurantTag(r.id)];
  if (r.customDomain) tags.push(...domainTagsFor(r.customDomain));
  return tags;
}
