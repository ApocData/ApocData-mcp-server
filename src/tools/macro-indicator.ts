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

export const macroIndicator: ToolDef = {
  name: "get_macro_indicator",
  description: "获取单个宏观指标的时序数据(如 CPI/PPI/GDP)。indicator 为指标 code(如 'CPI' 'M2' 'GDP'),from/to 为 YYYY-MM 月度区间。默认 5min 缓存。",
  inputSchema: {
    type: "object",
    properties: {
      indicator: { type: "string", description: "指标 code,如 'CPI' / 'PPI' / 'M2' / 'GDP' / 'PMI'" },
      from: { type: "string", description: "起始月 YYYY-MM,可选" },
      to: { type: "string", description: "结束月 YYYY-MM,可选" },
    },
    required: ["indicator"],
  },
  handler: async (args, client) => {
    const indicator = args.indicator as string;
    const params: Record<string, unknown> = {};
    if (args.from) params.from = args.from;
    if (args.to) params.to = args.to;
    const key = `tool:get_macro_indicator:${indicator}:${args.from ?? ""}:${args.to ?? ""}`;
    return withCache(key, 5 * 60 * 1000, async () => {
      const r = await callDataPlane(client, `/v1/macro/${encodeURIComponent(indicator)}`, params);
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
