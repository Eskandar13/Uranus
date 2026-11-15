import type {
  Category,
  CategoryPatch,
  ImageFolder,
  ItemPatch,
  MemberInfo,
  MemberRole,
  MenuItem,
  NewCategoryInput,
  NewItemInput,
  NewRestaurantInput,
  PublicMenu,
  Restaurant,
  RestaurantPatch,
} from "./types";

/**
 * The one data-access interface. Two implementations:
 *   - lib/data/local     JSON file store (.data/db.json), used when Supabase env vars are missing
 *   - lib/data/supabase  Supabase Postgres + Storage (production)
 *
 * Authorization: callers (server actions) MUST check access with lib/auth before calling
 * any write. In Supabase mode Row-Level Security enforces it a second time.
 *
 * Errors: methods throw `RepositoryError` (below) for expected failures
 * (e.g. slug taken, not found) so server actions can show a friendly message.
 */
export interface MenuRepository {
  /* ---------- public reads (no auth; only active restaurants / visible content) ---------- */
  getRestaurantBySlug(slug: string): Promise<Restaurant | null>;
  getRestaurantByDomain(domain: string): Promise<Restaurant | null>;
  /** Visible categories + their items. null if the restaurant is missing or inactive. */
  getPublicMenu(slug: string): Promise<PublicMenu | null>;
  listActiveRestaurantSlugs(): Promise<string[]>;

  /* ---------- owner / admin reads (include hidden + inactive) ---------- */
  getRestaurantById(id: string): Promise<Restaurant | null>;
  listRestaurants(): Promise<Restaurant[]>;
  listCategories(restaurantId: string): Promise<Category[]>;
  listItems(restaurantId: string, opts?: { categoryId?: string }): Promise<MenuItem[]>;
  getItem(id: string): Promise<MenuItem | null>;
  getCategory(id: string): Promise<Category | null>;

  /* ---------- restaurants ---------- */
  createRestaurant(input: NewRestaurantInput): Promise<Restaurant>;
  updateRestaurant(id: string, patch: RestaurantPatch): Promise<Restaurant>;
  deleteRestaurant(id: string): Promise<void>;
  /** Copies settings, categories and items into a new restaurant. */
  duplicateRestaurant(sourceId: string, input: { slug: string; name: Restaurant["name"] }): Promise<Restaurant>;
  isSlugAvailable(slug: string): Promise<boolean>;

  /* ---------- categories ---------- */
  createCategory(restaurantId: string, input: NewCategoryInput): Promise<Category>;
  updateCategory(id: string, patch: CategoryPatch): Promise<Category>;
  /** Deletes the category AND its items. */
  deleteCategory(id: string): Promise<void>;
  reorderCategories(restaurantId: string, orderedIds: string[]): Promise<void>;

  /* ---------- items ---------- */
  createItem(restaurantId: string, input: NewItemInput): Promise<MenuItem>;
  updateItem(id: string, patch: ItemPatch): Promise<MenuItem>;
  deleteItem(id: string): Promise<void>;
  duplicateItem(id: string): Promise<MenuItem>;
  reorderItems(categoryId: string, orderedIds: string[]): Promise<void>;

  /* ---------- images ---------- */
  /** Stores an already-compressed image; returns its public URL. */
  uploadImage(restaurantId: string, folder: ImageFolder, file: Blob, contentType: string): Promise<{ url: string }>;
  /** Best-effort delete of an image previously returned by uploadImage (ignores foreign URLs). */
  deleteImage(url: string): Promise<void>;

  /* ---------- members ---------- */
  listMembers(restaurantId: string): Promise<MemberInfo[]>;
  /** Admin list helper: item count + member emails for EVERY restaurant in one batch (keyed by id). */
  listRestaurantSummaries(): Promise<Record<string, RestaurantSummary>>;
  addMember(restaurantId: string, userId: string, role: MemberRole): Promise<void>;
  removeMember(restaurantId: string, userId: string): Promise<void>;
}

export interface RestaurantSummary {
  itemCount: number;
  memberEmails: string[];
}

export type RepositoryErrorCode =
  | "not_found"
  | "slug_taken"
  | "domain_taken"
  | "forbidden"
  | "read_only"
  | "invalid"
  | "storage_failed"
  | "unknown";

export class RepositoryError extends Error {
  constructor(
    public code: RepositoryErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RepositoryError";
  }
}

/**
 * Which credentials the repository uses (Supabase mode only; local mode ignores it):
 *  - "public":  anon key, NO cookies. Safe inside `'use cache'` functions. Read-only public data.
 *  - "session": the signed-in user's cookies (RLS applies). Use in dashboard pages + server actions.
 *  - "service": service-role key, bypasses RLS. ONLY for platform-admin server actions after
 *               requirePlatformAdmin() passed (creating restaurants, inviting owners).
 */
export type RepositoryScope = "public" | "session" | "service";
