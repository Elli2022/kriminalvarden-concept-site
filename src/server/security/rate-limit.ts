import "server-only";

import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { RequestSecurityError } from "./http";

interface RateLimitRecord {
  blockedUntil: number | null;
  count: number;
  windowStartedAt: number;
}

interface RateLimitOptions {
  blockSeconds: number;
  errorMessage: string;
  key: string;
  limit: number;
  scope: string;
  windowSeconds: number;
}

const STORE_NAME = "planner-security";

const globalForRateLimit = globalThis as unknown as {
  plannerRateLimitStore?: Map<string, RateLimitRecord>;
};

function getMemoryStore() {
  globalForRateLimit.plannerRateLimitStore ??= new Map();
  return globalForRateLimit.plannerRateLimitStore;
}

function getHashedKey(scope: string, key: string) {
  const digest = createHash("sha256").update(key).digest("hex");
  return `rate-limits/${scope}/${digest}`;
}

function isNetlifyBlobsAvailable() {
  return process.env.SITE_ID != null && process.env.URL != null;
}

function createNextRecord(
  current: RateLimitRecord | null,
  options: RateLimitOptions,
) {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const blockMs = options.blockSeconds * 1000;

  const baseRecord =
    current &&
    now - current.windowStartedAt < windowMs &&
    (!current.blockedUntil || current.blockedUntil > now)
      ? current
      : {
          blockedUntil: null,
          count: 0,
          windowStartedAt: now,
        };

  if (baseRecord.blockedUntil && baseRecord.blockedUntil > now) {
    throw new RequestSecurityError(
      options.errorMessage,
      429,
      Math.ceil((baseRecord.blockedUntil - now) / 1000),
    );
  }

  const count = baseRecord.count + 1;
  const nextRecord: RateLimitRecord = {
    ...baseRecord,
    count,
  };

  if (count > options.limit) {
    nextRecord.blockedUntil = now + blockMs;
  }

  return nextRecord;
}

function ensureAllowed(record: RateLimitRecord, options: RateLimitOptions) {
  if (record.count <= options.limit) {
    return;
  }

  const retryAfterSeconds = record.blockedUntil
    ? Math.ceil((record.blockedUntil - Date.now()) / 1000)
    : options.blockSeconds;

  throw new RequestSecurityError(
    options.errorMessage,
    429,
    Math.max(retryAfterSeconds, 1),
  );
}

async function consumeFromMemory(options: RateLimitOptions) {
  const store = getMemoryStore();
  const key = getHashedKey(options.scope, options.key);
  const nextRecord = createNextRecord(store.get(key) ?? null, options);
  store.set(key, nextRecord);
  ensureAllowed(nextRecord, options);
}

async function consumeFromNetlify(options: RateLimitOptions) {
  const store = getStore(STORE_NAME);
  const key = getHashedKey(options.scope, options.key);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const entry = await store.getWithMetadata(key, { type: "json" });
    const current = (entry?.data as RateLimitRecord | null) ?? null;
    const nextRecord = createNextRecord(current, options);
    const saved = entry
      ? await store.setJSON(key, nextRecord, {
          onlyIfMatch: entry.etag,
        })
      : await store.setJSON(key, nextRecord, {
          onlyIfNew: true,
        });

    if (!saved.modified) {
      continue;
    }

    ensureAllowed(nextRecord, options);
    return;
  }

  throw new RequestSecurityError(
    "Säkerhetskontrollen kunde inte genomföras. Försök igen.",
    503,
  );
}

export async function consumeRateLimit(options: RateLimitOptions) {
  if (isNetlifyBlobsAvailable()) {
    return consumeFromNetlify(options);
  }

  return consumeFromMemory(options);
}

export async function clearRateLimit(scope: string, key: string) {
  const hashedKey = getHashedKey(scope, key);

  if (isNetlifyBlobsAvailable()) {
    await getStore(STORE_NAME).delete(hashedKey);
    return;
  }

  getMemoryStore().delete(hashedKey);
}
