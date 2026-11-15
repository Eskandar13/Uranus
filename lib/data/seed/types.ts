import type { Category, MemberRole, MenuItem, Restaurant } from "../types";

/** Demo account (local mode login; also created in Supabase by scripts/seed-supabase.mjs). */
export interface SeedUser {
  id: string;
  email: string;
  /** Demo-only password. These accounts exist only in local mode / demo projects. */
  password: string;
  /** Unix seconds of the last password change; sessions issued before it are rejected (local mode). */
  passwordChangedAt?: number;
  displayName: string;
}

/** One restaurant's full demo content (one JSON file per restaurant in ./restaurants). */
export interface SeedRestaurantFile {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
}

export interface SeedData {
  restaurants: Restaurant[];
  categories: Category[];
  items: MenuItem[];
  users: SeedUser[];
  memberships: Array<{ userId: string; restaurantId: string; role: MemberRole }>;
  platformAdminIds: string[];
}
