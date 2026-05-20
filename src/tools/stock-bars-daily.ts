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

export const stockBarsDaily: ToolDef = {
  name: "get_stock_bars_daily",
  description: "获取单只 A 股日 K 历史(open/high/low/close/volume/amount/change_pct)。from/to 为 YYYY-MM-DD 区间,默认最近 60 个交易日。10min MCP 缓存。",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "6 位 A 股代码" },
      from: { type: "string", description: "起始日期 YYYY-MM-DD,默认 60 交易日前" },
      to: { type: "string", description: "结束日期 YYYY-MM-DD,默认今天" },
    },
    required: ["symbol"],
  },
  handler: async (args, client) => {
    const symbol = args.symbol as string;
    const params: Record<string, unknown> = {};
    if (args.from) params.from = args.from;
    if (args.to) params.to = args.to;
    const cacheKey = `tool:get_stock_bars_daily:${symbol}:${args.from ?? ""}:${args.to ?? ""}`;
    return withCache(cacheKey, 10 * 60 * 1000, async () => {
      const r = await callDataPlane(client, `/v1/stocks/${encodeURIComponent(symbol)}/bars/daily`, params);
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
