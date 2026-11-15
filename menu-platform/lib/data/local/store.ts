import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { RepositoryError } from "../repository";
import { seed } from "../seed";
import type { SeedData } from "../seed/types";
import { DATA_DIR, DB_FILE } from "./paths";

/**
 * Local-mode "database": one JSON file (.data/db.json) with the SeedData shape
 * { restaurants, categories, items, users, memberships, platformAdminIds }.
 *
 *  - Until the first write the file does not exist and reads return a deep copy of the seed.
 *  - Reads are cached in memory, keyed by the file's mtime + size (external edits are picked up).
 *  - Writes go through one promise queue (no lost updates), are atomic (tmp file + rename) and
 *    create .data/ on first write.
 *  - On read-only hosts (Netlify, AWS Lambda, EROFS/EACCES/EPERM) writes throw
 *    RepositoryError("read_only"); reads keep working from the seed.
 */
export type LocalDb = SeedData;

interface StoreState {
  /** Key of the cached snapshot: "seed" or "<mtimeMs>:<size>". */
  key: string | null;
  db: LocalDb | null;
  queue: Promise<unknown>;
}

// Kept on globalThis so every module instance (RSC, actions, route handlers, HMR reloads)
// shares one cache and one write queue.
const globalStore = globalThis as typeof globalThis & { __menuLocalStore?: StoreState };
const state: StoreState = (globalStore.__menuLocalStore ??= { key: null, db: null, queue: Promise.resolve() });

const READ_ONLY_CODES = new Set(["EROFS", "EACCES", "EPERM"]);

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

/** True on hosts whose filesystem is read-only at runtime. */
export function isReadOnlyHost(): boolean {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Throws RepositoryError("read_only") on read-only hosts. */
export function assertWritable(): void {
  if (isReadOnlyHost()) {
    throw new RepositoryError("read_only", "This deployment cannot save changes (read-only filesystem). Connect Supabase to save.");
  }
}

/** Maps filesystem errors to RepositoryError (read_only for permission/read-only failures). */
export function toRepositoryError(err: unknown, fallback: "unknown" | "storage_failed" = "unknown"): RepositoryError {
  if (err instanceof RepositoryError) return err;
  const code = errorCode(err);
  if (code && READ_ONLY_CODES.has(code)) {
    return new RepositoryError("read_only", "The local data folder is read-only. Connect Supabase to save.");
  }
  return new RepositoryError(fallback, err instanceof Error ? err.message : String(err));
}

function normalize(db: Partial<LocalDb>): LocalDb {
  return {
    restaurants: Array.isArray(db.restaurants) ? db.restaurants : [],
    categories: Array.isArray(db.categories) ? db.categories : [],
    items: Array.isArray(db.items) ? db.items : [],
    users: Array.isArray(db.users) ? db.users : [],
    memberships: Array.isArray(db.memberships) ? db.memberships : [],
    platformAdminIds: Array.isArray(db.platformAdminIds) ? db.platformAdminIds : [],
  };
}

async function statDb(): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const s = await fs.stat(DB_FILE);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch (err) {
    if (errorCode(err) === "ENOENT" || errorCode(err) === "ENOTDIR") return null;
    throw err;
  }
}

/**
 * Current database snapshot. The returned object is SHARED and cached: treat it as read-only
 * (clone before handing parts to callers that might mutate them). Use updateDb() to change data.
 */
export async function readDb(): Promise<LocalDb> {
  const s = await statDb();
  if (!s) {
    if (state.key !== "seed" || !state.db) {
      state.db = normalize(structuredClone(seed));
      state.key = "seed";
    }
    return state.db;
  }
  const key = `${s.mtimeMs}:${s.size}`;
  if (state.key === key && state.db) return state.db;
  const raw = await fs.readFile(DB_FILE, "utf8");
  let parsed: Partial<LocalDb>;
  try {
    parsed = JSON.parse(raw) as Partial<LocalDb>;
  } catch {
    throw new RepositoryError(
      "unknown",
      `${DB_FILE} is not valid JSON. Fix or delete it (deleting resets local data to the demo seed).`,
    );
  }
  state.db = normalize(parsed);
  state.key = key;
  return state.db;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Write tmp file then rename over db.json. Retries briefly on Windows file locks. */
async function writeAtomic(db: LocalDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `db.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await fs.rename(tmp, DB_FILE);
      return;
    } catch (err) {
      lastErr = err;
      const code = errorCode(err);
      // Antivirus / editors on Windows can hold the target briefly.
      if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
        await sleep(40 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  await fs.rm(tmp, { force: true }).catch(() => {});
  throw lastErr;
}

/**
 * Applies `mutator` to a private copy of the database and saves it atomically. Calls are
 * serialized, so concurrent updates never overwrite each other. If the mutator throws, nothing is
 * written and the error is rethrown. Returns the mutator's result.
 *
 * Throws RepositoryError("read_only") on read-only hosts.
 */
export function updateDb<T>(mutator: (db: LocalDb) => T | Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    assertWritable();
    const draft = structuredClone(await readDb());
    const result = await mutator(draft);
    try {
      await writeAtomic(draft);
    } catch (err) {
      throw toRepositoryError(err);
    }
    const s = await statDb();
    state.db = draft;
    state.key = s ? `${s.mtimeMs}:${s.size}` : null;
    return result;
  });
  // Keep the queue alive after failures.
  state.queue = run.catch(() => undefined);
  return run;
}
