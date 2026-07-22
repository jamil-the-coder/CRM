import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkRateLimit } from "./rate-limit";

const usedKeys: string[] = [];

afterAll(async () => {
  if (usedKeys.length > 0) {
    await db.rateLimitHit.deleteMany({ where: { key: { in: usedKeys } } });
  }
});

function uniqueKey(label: string) {
  const key = `test:${label}:${crypto.randomUUID()}`;
  usedKeys.push(key);
  return key;
}

describe("checkRateLimit", () => {
  it("allows requests under the max", async () => {
    const key = uniqueKey("under-max");
    const first = await checkRateLimit(key, { windowMs: 60_000, max: 3 });
    const second = await checkRateLimit(key, { windowMs: 60_000, max: 3 });
    expect(first.limited).toBe(false);
    expect(second.limited).toBe(false);
  });

  it("blocks once the max is reached within the window", async () => {
    const key = uniqueKey("at-max");
    await checkRateLimit(key, { windowMs: 60_000, max: 2 });
    await checkRateLimit(key, { windowMs: 60_000, max: 2 });
    const third = await checkRateLimit(key, { windowMs: 60_000, max: 2 });
    expect(third.limited).toBe(true);
  });

  it("does not let hits under one key affect a different key", async () => {
    const keyA = uniqueKey("isolated-a");
    const keyB = uniqueKey("isolated-b");
    await checkRateLimit(keyA, { windowMs: 60_000, max: 1 });
    const resultB = await checkRateLimit(keyB, { windowMs: 60_000, max: 1 });
    expect(resultB.limited).toBe(false);
  });

  it("ignores hits older than the window", async () => {
    const key = uniqueKey("old-hits");
    await db.rateLimitHit.create({
      data: { key, createdAt: new Date(Date.now() - 120_000) },
    });
    const result = await checkRateLimit(key, { windowMs: 60_000, max: 1 });
    expect(result.limited).toBe(false);
  });
});
