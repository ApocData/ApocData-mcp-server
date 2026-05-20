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

export const tradeDays: ToolDef = {
  name: "get_trade_days",
  description: "获取 A 股交易日历(年度)。year 默认当年。本数据跨年才变,默认 24h 缓存。",
  inputSchema: {
    type: "object",
    properties: {
      year: { type: "integer", description: "年份 YYYY,默认当年" },
    },
  },
  handler: async (args, client) => {
    const year = (args.year as number) ?? new Date().getFullYear();
    return withCache(`tool:get_trade_days:${year}`, 24 * 60 * 60 * 1000, async () => {
      const r = await callDataPlane(client, "/v1/calendar/trade-days", { year });
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
