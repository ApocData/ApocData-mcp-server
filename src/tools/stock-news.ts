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

export const stockNews: ToolDef = {
  name: "get_stock_news",
  description: "获取单只 A 股最近新闻(标题/来源/发布时间/摘要),按发布时间倒序。默认返 20 条。本端点**不缓存**(新闻时效性强)。",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "6 位 A 股代码" },
      limit: { type: "integer", description: "返回条数,默认 20,最大 50", default: 20 },
    },
    required: ["symbol"],
  },
  handler: async (args, client) => {
    const symbol = args.symbol as string;
    const limit = (args.limit as number) ?? 20;
    const r = await callDataPlane(client, `/v1/stocks/${encodeURIComponent(symbol)}/news`, { limit });
    if (r.error) return { error: true, ...r.error };
    return { data: r.data, meta: r.meta };
  },
};
