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

export const top10Holders: ToolDef = {
  name: "get_top10_holders",
  description: "获取单只 A 股十大股东最新一期(姓名/持股数/持股比例/性质)。本数据按季度更新,默认 6h 缓存。",
  inputSchema: {
    type: "object",
    properties: { symbol: { type: "string", description: "6 位 A 股代码" } },
    required: ["symbol"],
  },
  handler: async (args, client) => {
    const symbol = args.symbol as string;
    return withCache(`tool:get_top10_holders:${symbol}`, 6 * 60 * 60 * 1000, async () => {
      const r = await callDataPlane(client, `/v1/stocks/${encodeURIComponent(symbol)}/holders/top10`);
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
