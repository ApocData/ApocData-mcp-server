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

import { callDataPlane } from "../transport.js";
import { withCache } from "../cache.js";
import type { ToolDef } from "./types.js";

export const stockList: ToolDef = {
  name: "get_stock_list",
  description: "获取所有 A 股主数据列表(支持分页)。返回 5000+ 股的 symbol/name/full_symbol/exchange/industry 等核心字段。适用于'查询有哪些股票'、'按行业筛选'类问题。本数据每日更新,默认 1h 缓存。",
  inputSchema: {
    type: "object",
    properties: {
      current: { type: "integer", description: "页码,从 1 开始", default: 1 },
      size: { type: "integer", description: "每页条数,默认 50,最大 50", default: 50 },
    },
  },
  handler: async (args, client) => {
    const targetPage = Math.max((args.current as number) ?? 1, 1);
    const size = Math.min(Math.max((args.size as number) ?? 50, 1), 50);
    const cacheKey = `tool:get_stock_list:${targetPage}:${size}`;
    return withCache(cacheKey, 60 * 60 * 1000, async () => {
      // I-041 fix: API 使用 cursor 分页(symbol 排序),需逐页翻到目标页
      let cursor: string | undefined;
      let data: unknown[] = [];
      let hasMore = false;
      let nextCursor: string | undefined;

      for (let p = 1; p <= targetPage; p++) {
        const params: Record<string, unknown> = { limit: size };
        if (cursor) params.cursor = cursor;
        const r = await callDataPlane<unknown[]>(client, "/v1/stocks", params);
        if (r.error) return { error: true, ...r.error };
        if (p === targetPage) {
          data = r.data ?? [];
          hasMore = !!r.pagination?.hasMore;
          nextCursor = r.pagination?.nextCursor;
        } else {
          // 中间页:提取 nextCursor 继续翻
          cursor = r.pagination?.nextCursor;
          if (!cursor || !r.pagination?.hasMore) break;
        }
      }
      return {
        data,
        pagination: { hasMore, nextCursor, page: targetPage, size },
      };
    });
  },
};
