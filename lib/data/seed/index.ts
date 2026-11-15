import type { SeedData, SeedRestaurantFile, SeedUser } from "./types";
import cafe from "./restaurants/demo-cafe.json";
import bistro from "./restaurants/demo-bistro.json";
import burger from "./restaurants/demo-burger.json";
import usersFile from "./users.json";

/**
 * Demo content: three fictional Damascus restaurants (café, bistro, burger joint) with
 * Unsplash photos (images.unsplash.com), blur placeholders and logos in public/demo.
 * USD main currency, SYP secondary (rate ~122 new SYP per USD, Trading Economics, 2026-11-10).
 */
const files = [cafe, bistro, burger] as unknown as SeedRestaurantFile[];

export const seed: SeedData = {
  restaurants: files.map((f) => f.restaurant),
  categories: files.flatMap((f) => f.categories),
  items: files.flatMap((f) => f.items),
  users: usersFile.users as SeedUser[],
  memberships: usersFile.memberships as SeedData["memberships"],
  platformAdminIds: usersFile.platformAdminIds,
};
