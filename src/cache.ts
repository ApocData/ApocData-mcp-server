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

import { LRUCache } from "lru-cache";

/**
 * MCP 端进程内 LRU 缓存。
 * - 容量 1000 条
 * - 默认 TTL 5min(若 factory 未指定)
 * - key 形如 "tool:get_stock_quote:000001"
 */
const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000,
});

/**
 * 缓存包装:命中直接返,未命中调 factory 并缓存。
 * @param key 缓存键
 * @param ttlMs 本次缓存 TTL(毫秒);若 undefined 用默认 5min
 * @param factory 数据源工厂
 */
export async function withCache<T>(
  key: string,
  ttlMs: number | undefined,
  factory: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key) as T | undefined;
  if (hit !== undefined) return hit;
  const value = await factory();
  if (ttlMs !== undefined) {
    cache.set(key, value, { ttl: ttlMs });
  } else {
    cache.set(key, value);
  }
  return value;
}

/**
 * 测试用:清空缓存。
 */
export function clearCache(): void {
  cache.clear();
}
