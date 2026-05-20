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

export const macroDashboard: ToolDef = {
  name: "get_macro_dashboard",
  description: "获取中国宏观经济面板:GDP/CPI/PPI/M2/PMI 等核心指标的最新值与同环比。本数据按月更新,默认 5min MCP 缓存(后端 1min 缓存)。",
  inputSchema: { type: "object", properties: {} },
  handler: async (_args, client) => {
    return withCache("tool:get_macro_dashboard", 5 * 60 * 1000, async () => {
      const r = await callDataPlane(client, "/v1/macro/dashboard");
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
