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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { translateError } from "../src/errors.js";

describe("errors.translateError", () => {
  it("translates known backend code AUTH_INVALID to Chinese", () => {
    const r = translateError({ backendCode: "AUTH_INVALID" });
    expect(r.error).toBe(true);
    expect(r.code).toBe("AUTH_INVALID");
    expect(r.message).toContain("API Key 无效");
  });

  it("falls back to HTTP_STATUS_FALLBACK when no backend code", () => {
    const r = translateError({ httpStatus: 429 });
    expect(r.code).toBe("QPS_EXCEEDED");
    expect(r.message).toContain("频率超限");
  });

  it("returns UNKNOWN with backend message when nothing matches", () => {
    const r = translateError({ backendMessage: "weird upstream error" });
    expect(r.code).toBe("UNKNOWN");
    expect(r.message).toContain("weird upstream error");
  });
});

describe("transport.createTransport", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TQ_API_KEY;
  });
  afterEach(() => {
    delete process.env.TQ_API_KEY;
  });

  it("throws when TQ_API_KEY missing", async () => {
    const { createTransport } = await import("../src/transport.js");
    expect(() => createTransport()).toThrow("缺少 TQ_API_KEY");
  });

  it("creates axios instance with X-API-Key header", async () => {
    process.env.TQ_API_KEY = "tq_dev_test_key";
    const { createTransport } = await import("../src/transport.js");
    const client = createTransport();
    expect(client.defaults.headers["X-API-Key"]).toBe("tq_dev_test_key");
    expect(String(client.defaults.headers["User-Agent"])).toContain("tianqi-mcp/");
  });
});
