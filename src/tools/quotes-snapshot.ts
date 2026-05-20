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

export const quotesSnapshot: ToolDef = {
  name: "get_quotes_snapshot",
  description: "批量获取多只 A 股最新实时行情快照(一次 ≤ 50 只)。每只股返 last_price/change_pct/volume 等。本端点**不缓存**(实时性优先)。",
  inputSchema: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "6 位 A 股代码数组,如 ['000001','600519']",
        maxItems: 50,
      },
    },
    required: ["symbols"],
  },
  handler: async (args, client) => {
    const symbols = args.symbols as string[];
    const r = await callDataPlane(client, "/v1/quotes/snapshot", { symbols: symbols.join(",") });
    if (r.error) return { error: true, ...r.error };
    return { data: r.data, meta: r.meta };
  },
};
