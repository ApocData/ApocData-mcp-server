/**
 * Copyright (c) 2018-2099, Chill Zhuang 庄骞 (bladejava@qq.com).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * @author Chill
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { withCache, clearCache } from "../src/cache.js";

describe("withCache", () => {
  beforeEach(() => clearCache());

  it("caches the result and skips factory on second call", async () => {
    const factory = vi.fn().mockResolvedValue({ value: 42 });
    const r1 = await withCache("k1", 60_000, factory);
    const r2 = await withCache("k1", 60_000, factory);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toEqual({ value: 42 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("invokes factory after TTL expiry", async () => {
    const factory = vi.fn()
      .mockResolvedValueOnce({ value: "first" })
      .mockResolvedValueOnce({ value: "second" });
    const r1 = await withCache("k2", 50, factory);
    await new Promise((r) => setTimeout(r, 80));
    const r2 = await withCache("k2", 50, factory);
    expect(r1).toEqual({ value: "first" });
    expect(r2).toEqual({ value: "second" });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("different keys cache independently", async () => {
    const factoryA = vi.fn().mockResolvedValue("A");
    const factoryB = vi.fn().mockResolvedValue("B");
    expect(await withCache("kA", 60_000, factoryA)).toBe("A");
    expect(await withCache("kB", 60_000, factoryB)).toBe("B");
    expect(await withCache("kA", 60_000, factoryA)).toBe("A");
    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
  });
});
