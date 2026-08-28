/**
 * MCP resources：暴露给 Agent 的静态文档。
 *
 * Agent 通过 resources/list 发现可读资源，通过 resources/read 拉取内容。
 * 比 tool description 更详细，但比挂全文档更精简——目标是让 Agent 一上来就能：
 * 1. 看懂全局能力（guide）
 * 2. 知道场景到工具的映射（scenarios）
 * 3. 查到 limit 上限/默认值（limits）
 */

export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  text: string;
}

const GUIDE = `# ApocData MCP - 接入与工具速查

## 是什么

天启至数 ApocData 是 A 股免鉴权数据 API（\`https://www.apocdata.com/api/blade-dataplatform/open/data/*\`），本 MCP server 把 46 个端点包装成可直接调用的工具。

## 工具分组（46 个）

| 类别 | 工具 |
| --- | --- |
| **A 行情与估值** | quote / quotes / daily / stock / stocks / st / ranking / indexes / index-daily / hot-rank |
| **B 财务与股东** | financial / express / dividend / holders / holder-number / share-float / repurchase / block-trade |
| **C 资金流向** | moneyflow / hsgt / hk-hold / hk-daily / margin / dragon-tiger / hot-money / hot-money-detail |
| **D 涨跌停与板块** | limit-list / limit-step / sector-flow / cyq-perf |
| **E 公告/调研** | announcements / survey |
| **F 板块成分** | concepts / concept-stocks / ths-boards / ths-board-stocks |
| **G 可转债** | convertible-bonds / cb-price-chg |
| **H 因子** | factors / tech-factor |
| **I 宏观** | macro / macro-latest / macro-definition |
| **J 日历** | calendar |
| **K 综合（推荐用于多维分析）** | profile-full / factor-categories |

## 关键约定

- **symbol 格式**：A 股传 6 位代码（如 \`600519\`），后端自动补全交易所后缀；港股/指数/可转债传完整 \`tsCode\`（如 \`00700.HK\` / \`000300.SH\` / \`127026.SZ\`）
- **延迟**：免鉴权接口走 FREE 套餐，盘中实时数据有 15min 延迟
- **数据稀疏≠错误**：express/survey/share-float 返回空数组属正常；hk-daily 已下线，调用返回 HTTP 410
- **错误协议**：业务错误用 HTTP 200 + \`success=false\` + \`msg\`，不走 HTTP 4xx
- **格式优化**：返回数组的工具支持 \`format=compact\`（columns+rows 列式，省 60-70% token）；**所有工具都支持 \`fields\` 字段白名单**（在 query 里加 fields=col1,col2 即可，工具 schema 只在 financial/announcements 显式列出但全局生效）

## 元信息透传

每次调用返回前会有一段 \`<!-- meta -->\` 注释块，含：
- \`X-Tdc-RateLimit-Remaining\`：剩余限流配额（每 IP 60 req/min）
- \`X-Tdc-Truncated=true\`：limit 超上限被截断
- \`X-Tdc-Error-Code\`：标准错误码（如 \`RESOURCE_NOT_FOUND\`）
- \`X-Tdc-Freshness-Tier\`：数据时效分类（**用这个判断"数据多新"**）
  - \`intraday\`：盘中实时（FREE 套餐 15min 延迟）
  - \`post-close\`：盘后批量（16:30 / 17:00-18:00 / 20:00）
  - \`t0-morning\`：T+0 当天 08:00（公告/新闻）
  - \`quarterly\`：季报，报告期后约 1 个月
  - \`metadata\`：元数据/低频
  - \`aggregated\`：聚合接口（取最严约束）
- \`X-Tdc-Freshness-Detail\`：上面 tier 的人类可读说明
- \`Cache-Control\`：服务端缓存策略，避免重复调用

Agent 可读这些头主动调整行为，避免无谓重试。**典型用法**：看到 \`Freshness-Tier=intraday\` 且当前已收盘 → 数据是 14:55 的快照；看到 \`post-close\` 且当前 19:00 → 数据应是当日 17:00 的。

## 详细文档

完整使用指南：https://github.com/ApocData/ApocData-skill
`;

const SCENARIOS = `# 常见场景到工具的映射

按用户意图找最优工具组合。**优先用一次能拿到多维数据的工具**（profile-full）。

## 单股分析

| 用户意图 | 推荐 |
| --- | --- |
| 全面了解一只股票 | **profile-full(symbol)** — 一次 8 维 |
| 当前股价/涨跌 | quote(symbol) |
| 基本信息（行业/PE/市值） | stock(symbol) |
| 是否 ST | st(symbol) |
| 历史 K 线 | daily(symbol, limit) 或 daily(symbol, start, end) |
| 技术指标（MACD/RSI/KDJ） | tech-factor(symbol) |
| 财务摘要 | financial(symbol, limit) |
| 业绩快报（季报披露窗口） | express(symbol) |
| 十大股东 | holders(symbol) |
| 股东户数变化 | holder-number(symbol) |
| 资金流（主力/超大单） | moneyflow(symbol) |
| 北向持仓 | hk-hold(symbol) |
| 筹码分布 | cyq-perf(symbol) |
| 公司公告（正式披露） | announcements(symbol, fields=title,summary,ann_date) |
| 机构调研 | survey(symbol) |
| 分红送配 | dividend(symbol) |
| 限售解禁 | share-float(symbol) |
| 大宗交易 | block-trade(symbol) |
| 回购 | repurchase(symbol) |

## 全市场排行/筛选

| 用户意图 | 推荐 |
| --- | --- |
| 今天涨幅榜/跌幅榜 | ranking(direction=gain\\|loss) |
| 当日热度榜 | hot-rank(type=A股市场) |
| 今天涨停/跌停个股 | limit-list(kind=U\\|D\\|Z) |
| 连板天梯 | limit-step() |
| 板块资金流榜 | sector-flow(type=industry\\|concept\\|region) |
| 龙虎榜 | dragon-tiger(date) 或按个股 dragon-tiger(symbol) |
| 游资席位清单 | hot-money() |
| 游资交易明细 | hot-money-detail(symbol\\|date) |
| 沪深港通总流向 | hsgt() |
| 融资融券 | margin(exchange=SSE\\|SZSE\\|BSE) |
| 名称/行业搜股票 | stocks(q\\|industry\\|market) |

## 板块成分

| 用户意图 | 推荐 |
| --- | --- |
| 找东财概念板块 | concepts(q) → concept-stocks(themeCode) |
| 找同花顺板块（行业+概念） | ths-boards(q) → ths-board-stocks(tsCode) |

## 指数与港股可转债

| 用户意图 | 推荐 |
| --- | --- |
| 指数日 K（沪深 300 等） | indexes(q) → index-daily(tsCode 如 000300.SH) |
| 港股日 K | hk-daily 已下线，调用返回 HTTP 410 |
| 可转债列表 | convertible-bonds(q\\|stkCode) |
| 转股价变动 | cb-price-chg(tsCode) |

## 宏观与日历

| 用户意图 | 推荐 |
| --- | --- |
| CPI/PPI/GDP/PMI 历史 | macro(type) |
| 最新一期值 | macro-latest(type) |
| 指标定义说明 | macro-definition(type) |
| 某区间交易日 | calendar(start, end) |

## 因子

| 用户意图 | 推荐 |
| --- | --- |
| 平台支持哪些因子 | factor-categories() — 看 11 个分类概览 |
| 全部 154 个因子明细 | factors() |
| 个股技术指标值 | tech-factor(symbol) |

## 反模式（不要这样用）

- ❌ 用 quote + stock + holders + ... 串调 8 个接口 → ✅ 一次 profile-full
- ❌ 用 stock + st 拼出"ST 状态" → ✅ 直接 st(symbol)
- ❌ 拿到 array[0] 就重试 → ✅ 检查 meta 里 X-Tdc-Sparse 注释，数据稀疏属正常
`;

const LIMITS = `# 工具参数 limit 速查表（超出会静默截断）

| 工具 | 默认 | 最大 |
| --- | --- | --- |
| quote | — | — |
| quotes (symbols 列表长度) | — | 10 |
| daily | 30 | 30 |
| stocks | 20 | 50 |
| ranking | 20 | 50 |
| indexes | 20 | 50 |
| index-daily | 30 | 30 |
| hot-rank | 30 | 50 |
| financial | 4 | 4 |
| express | 4 | 8 |
| dividend | 10 | 20 |
| holder-number | 10 | 20 |
| share-float | 10 | 20 |
| repurchase | 10 | 20 |
| block-trade | 10 | 30 |
| moneyflow | 10 | 30 |
| hsgt | 10 | 30 |
| hk-hold | 10 | 30 |
| hk-daily | 30 | 30 |
| margin | 10 | 30 |
| dragon-tiger | 30 | 50 |
| hot-money | 50 | 50 |
| hot-money-detail | 30 | 50 |
| limit-list | 30 | 50 |
| limit-step | 30 | 50 |
| sector-flow | 20 | 50 |
| cyq-perf | 5 | 20 |
| announcements | 5 | 5 |
| survey | 5 | 10 |
| concepts | 30 | 50 |
| concept-stocks | 50 | 50 |
| ths-boards | 30 | 50 |
| ths-board-stocks | 50 | 50 |
| convertible-bonds | 20 | 50 |
| cb-price-chg | 10 | 20 |
| tech-factor | 1 | 10 |
| macro | 12 | 12 |
| calendar 跨度 | — | 366 天 |

## 字段裁剪 fields（全局支持）

**所有 46 个工具都支持** \`?fields=col1,col2,...\`，响应只保留指定字段。请求列序保持。响应头会带 \`X-Tdc-Fields-Applied\`。

最受益的几个（默认字段多、token 贵）：

- **financial** — 默认返回 60+ 字段，建议 \`fields=symbol,end_date,roe,revenue,net_profit\`
- **announcements** — 默认含 Markdown 全文（很长），建议 \`fields=title,summary,ann_date,url\`
- **quote** — 16 字段，紧凑场景可 \`fields=symbol,close,pct_chg\`
- **stock** — 12 字段，估值场景可 \`fields=symbol,name,pe,pb,total_mv\`
- **profile-full** — 8 维聚合，按需只要某些 section（注意是子 Map，行为待验证）

不存在的字段自动忽略（不报错），空 fields 返回原数据。

## format=compact

所有返回数组的工具支持。响应从 \`[{a:1,b:2}, {a:3,b:4}]\` 变成 \`{columns:["a","b"], rows:[[1,2],[3,4]]}\`，省 60-70% token。
单条 Map 返回的工具（quote/stock/st/macro-latest/macro-definition/profile-full/calendar）不支持。
`;

export const ALL_RESOURCES: ResourceDef[] = [
  {
    uri: 'apocdata://guide',
    name: 'ApocData 接入指南',
    description: '全局能力速览 + 46 工具分组 + 关键约定（symbol 格式 / 延迟 / 错误协议 / 元信息头）',
    mimeType: 'text/markdown',
    text: GUIDE,
  },
  {
    uri: 'apocdata://scenarios',
    name: '场景速查',
    description: '常见用户意图到工具组合的映射；含反模式（应该一次画像就别串调 8 个接口）',
    mimeType: 'text/markdown',
    text: SCENARIOS,
  },
  {
    uri: 'apocdata://limits',
    name: 'limit / fields / compact 速查表',
    description: '所有工具的 limit 默认值与上限；哪些工具支持 fields 字段裁剪和 format=compact',
    mimeType: 'text/markdown',
    text: LIMITS,
  },
];
