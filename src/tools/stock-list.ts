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
      size: { type: "integer", description: "每页条数,默认 100,最大 500", default: 100 },
    },
  },
  handler: async (args, client) => {
    const current = (args.current as number) ?? 1;
    const size = (args.size as number) ?? 100;
    const cacheKey = `tool:get_stock_list:${current}:${size}`;
    return withCache(cacheKey, 60 * 60 * 1000, async () => {
      const r = await callDataPlane(client, "/v1/stocks", { current, size });
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
