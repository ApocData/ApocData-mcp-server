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
import type { ToolDef } from "./types.js";

export const stockQuote: ToolDef = {
  name: "get_stock_quote",
  description: "获取单只 A 股最新实时行情快照(含 last_price, change_pct, volume, turnover, bid/ask)。延迟 15 分钟(SKU-FREE)/ 0 分钟(SKU-PRO+)。返回值含 meta.ingestLagSeconds 表示数据新鲜度。本端点**不缓存**(实时性优先)。",
  inputSchema: {
    type: "object",
    properties: { symbol: { type: "string", description: "6 位 A 股代码,如 '000001'" } },
    required: ["symbol"],
  },
  handler: async (args, client) => {
    const symbol = args.symbol as string;
    const r = await callDataPlane(client, `/v1/stocks/${encodeURIComponent(symbol)}/quote`);
    if (r.error) return { error: true, ...r.error };
    return { data: r.data, meta: r.meta };
  },
};
