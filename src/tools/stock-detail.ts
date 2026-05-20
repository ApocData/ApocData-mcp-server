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

export const stockDetail: ToolDef = {
  name: "get_stock_detail",
  description: "获取单只 A 股详情:基础信息 + ST 状态 + 最新 ROE。symbol 为 6 位代码(如 '000001' '600519')。本数据每日更新,默认 1h 缓存。",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "6 位 A 股代码,不含市场后缀,如 '000001' '600519'" },
    },
    required: ["symbol"],
  },
  handler: async (args, client) => {
    const symbol = args.symbol as string;
    const cacheKey = `tool:get_stock_detail:${symbol}`;
    return withCache(cacheKey, 60 * 60 * 1000, async () => {
      const r = await callDataPlane(client, `/v1/stocks/${encodeURIComponent(symbol)}`);
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
