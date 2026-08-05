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

import { stockList } from "./stock-list.js";
import { stockDetail } from "./stock-detail.js";
import { stockQuote } from "./stock-quote.js";
import { quotesSnapshot } from "./quotes-snapshot.js";
import { stockBarsDaily } from "./stock-bars-daily.js";
import { stockFinancials } from "./stock-financials.js";
import { top10Holders } from "./top10-holders.js";
// import { stockNews } from "./stock-news.js"; // 已停用：新闻库无可靠股票代码字段，get_stock_news 按代码搜新闻无效
import { macroDashboard } from "./macro-dashboard.js";
import { macroIndicator } from "./macro-indicator.js";
import { factorRegistry } from "./factor-registry.js";
import { tradeDays } from "./trade-days.js";
import type { ToolDef } from "./types.js";

/**
 * 12 个原子 tool 集中导出。
 * 后续 P5-Agent-4 加 3 聚合 + 2 场景 tool 时,在此 append 即可。
 */
export const ATOMIC_TOOLS: ToolDef[] = [
  stockList,
  stockDetail,
  stockQuote,
  quotesSnapshot,
  stockBarsDaily,
  stockFinancials,
  top10Holders,
  // stockNews, // 已停用：新闻库无可靠股票代码字段，按股票代码搜新闻无效
  macroDashboard,
  macroIndicator,
  factorRegistry,
  tradeDays,
];
