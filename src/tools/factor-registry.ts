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

export const factorRegistry: ToolDef = {
  name: "get_factor_registry",
  description: "获取量化因子目录(脱敏后,含 factor_code/name/weight,**不含** calc_formula/conditions 等内部字段)。共 221 个因子规则,本数据极少变化,默认 1h MCP 缓存(后端 24h 缓存)。",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "返回条数,默认 50,最大 221", default: 50 },
    },
  },
  handler: async (args, client) => {
    const limit = (args.limit as number) ?? 50;
    return withCache(`tool:get_factor_registry:${limit}`, 60 * 60 * 1000, async () => {
      const r = await callDataPlane(client, "/v1/factors/registry", { limit });
      if (r.error) return { error: true, ...r.error };
      return { data: r.data, meta: r.meta };
    });
  },
};
