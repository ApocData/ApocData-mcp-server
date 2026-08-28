/**
 * 天启至数 ApocData - MCP 工具配置表
 *
 * 46 个 /open/data/* 端点的元数据声明。
 * 严格对齐后端 controller @RequestParam 签名（参数名、必填、默认值、上限）。
 *
 * - format=compact 全局 advice 处理，仅对返回 List<Map> 的接口生效，因此只有这类工具暴露 format 参数
 * - fields 字段裁剪仅 financial / announcements 显式支持
 */

export interface ParamDef {
  type: 'string' | 'integer' | 'number' | 'boolean';
  description: string;
  enum?: string[];
  default?: string | number | boolean;
}

export interface ToolDef {
  name: string;
  path: string;
  description: string;
  params: Record<string, ParamDef>;
  required?: string[];
}

const SYMBOL_6: ParamDef = {
  type: 'string',
  description: 'A 股 6 位代码，如 000001（平安银行）、600519（贵州茅台），后端自动补全交易所后缀',
};

const FORMAT_COMPACT: ParamDef = {
  type: 'string',
  description: '响应格式：默认 row（行式 JSON），compact 改为列式（columns/rows，节省 60-70% token），仅对返回数组的接口生效',
  enum: ['row', 'compact'],
};

const limitParam = (defaultVal: number, max: number): ParamDef => ({
  type: 'integer',
  description: `返回条数，默认 ${defaultVal}，最大 ${max}（超出会静默截断，响应头 X-Tdc-Truncated=true）`,
  default: defaultVal,
});

/* ===== A. 行情与估值（10 个） ===== */

const TOOLS_A: ToolDef[] = [
  {
    name: 'quote',
    path: 'quote',
    description: 'A1 实时行情快照（FREE 套餐延迟 15min）。单只股票最新 OHLC + 量价 + 涨跌幅。用于"现在多少钱"类问题；查多只用 quotes；要财务/股东/公告等多维数据请直接用 profile-full',
    params: { symbol: SYMBOL_6 },
    required: ['symbol'],
  },
  {
    name: 'quotes',
    path: 'quotes',
    description: 'A2 批量行情快照。symbols 逗号分隔，最多 10 只（超出截断）',
    params: {
      symbols: {
        type: 'string',
        description: '股票代码列表，逗号分隔，最多 10 只，如 "000001,600519,688981"',
      },
    },
    required: ['symbols'],
  },
  {
    name: 'daily',
    path: 'daily',
    description: 'A3 日 K 历史（一只股票的多天）。按 limit 取最近 N 条（最多 30），或 start+end（YYYYMMDD）按区间查。要"多只股票一天"的横向排行用 ranking；要"今天涨多少"用 quote',
    params: {
      symbol: SYMBOL_6,
      limit: limitParam(30, 30),
      start: { type: 'string', description: '起始日期 YYYYMMDD，必须与 end 同时给' },
      end: { type: 'string', description: '结束日期 YYYYMMDD' },
      format: FORMAT_COMPACT,
    },
    required: ['symbol'],
  },
  {
    name: 'stocks',
    path: 'stocks',
    description: 'A4 股票列表搜索。按名称/代码关键词 q 模糊匹配，可过滤行业/市场，支持游标翻页',
    params: {
      q: { type: 'string', description: '名称或代码关键词，模糊匹配。含中文/特殊字符时必须 URL-encode（本 MCP server 已自动编码；直连 REST API 需用 curl -G --data-url-encode "q=..."）' },
      industry: { type: 'string', description: '行业过滤，如 "银行" "白酒"' },
      market: { type: 'string', description: '市场过滤，如 "主板" "科创板" "创业板" "北交所"' },
      limit: limitParam(20, 50),
      cursor: { type: 'string', description: '游标翻页 token，从上次响应取' },
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'stock',
    path: 'stock',
    description: 'A5 股票静态基本信息：name/market/industry/area/list_date/pe/pb/total_mv/circ_mv。**不含**当日行情（用 quote）和 ST 状态（用 st）',
    params: { symbol: SYMBOL_6 },
    required: ['symbol'],
  },
  {
    name: 'st',
    path: 'st',
    description: 'A6 ST 状态查询。返回最新 ST/*ST/退市风险状态，正常股 data=null',
    params: { symbol: SYMBOL_6 },
    required: ['symbol'],
  },
  {
    name: 'ranking',
    path: 'ranking',
    description: 'A7 涨跌幅排行榜。全市场当日涨跌幅排序',
    params: {
      direction: {
        type: 'string',
        description: 'gain 涨幅榜 / loss 跌幅榜',
        enum: ['gain', 'loss'],
        default: 'gain',
      },
      limit: limitParam(20, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'indexes',
    path: 'indexes',
    description: 'A8 指数列表搜索。按名称/代码 q 关键词搜索',
    params: {
      q: { type: 'string', description: '指数名/代码关键词，如 "上证" "沪深300"' },
      market: { type: 'string', description: '市场过滤，可选' },
      limit: limitParam(20, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'index-daily',
    path: 'index-daily',
    description: 'A9 指数日 K。tsCode 是指数代码带后缀，如 000300.SH（沪深300）、000001.SH（上证综指）、399001.SZ（深证成指）',
    params: {
      tsCode: { type: 'string', description: '指数代码，带交易所后缀，如 000300.SH / 399001.SZ' },
      limit: limitParam(30, 30),
      format: FORMAT_COMPACT,
    },
    required: ['tsCode'],
  },
  {
    name: 'hot-rank',
    path: 'hot-rank',
    description: 'A10 东方财富人气榜（按市场分类）',
    params: {
      type: {
        type: 'string',
        description: '市场类型',
        enum: ['A股市场'],
        default: 'A股市场',
      },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
];

/* ===== B. 财务与股东（8 个） ===== */

const TOOLS_B: ToolDef[] = [
  {
    name: 'financial',
    path: 'financial',
    description: 'B1 财务摘要。最近 limit 期（最多 4 期）。fields 可选字段白名单节省 token，如 fields=roe,revenue,net_profit',
    params: {
      symbol: SYMBOL_6,
      reportType: { type: 'string', description: '报告期类型，如 "annual" 年报、"q1" 一季报；不传返回最近期次' },
      limit: limitParam(4, 4),
      fields: { type: 'string', description: '字段白名单，逗号分隔，仅返回这些字段' },
      format: FORMAT_COMPACT,
    },
    required: ['symbol'],
  },
  {
    name: 'express',
    path: 'express',
    description: 'B2 业绩快报（仅季报披露窗口期约 1 个月有数据）',
    params: { symbol: SYMBOL_6, limit: limitParam(4, 8), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'dividend',
    path: 'dividend',
    description: 'B3 分红送配。最近 limit 条记录（最多 20）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 20), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'holders',
    path: 'holders',
    description: 'B4 十大股东（最新一期）。holderCategory 可选过滤股东类型',
    params: {
      symbol: SYMBOL_6,
      holderCategory: { type: 'string', description: '股东类型过滤，可选' },
      format: FORMAT_COMPACT,
    },
    required: ['symbol'],
  },
  {
    name: 'holder-number',
    path: 'holder-number',
    description: 'B5 股东户数变化。最近 limit 期（最多 20）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 20), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'share-float',
    path: 'share-float',
    description: 'B6 限售解禁。最近 limit 条（最多 20）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 20), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'repurchase',
    path: 'repurchase',
    description: 'B7 股票回购。最近 limit 条（最多 20）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 20), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'block-trade',
    path: 'block-trade',
    description: 'B8 大宗交易。按 symbol 查最近 limit 条（最多 30）。部分小盘股空返回属正常',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 30), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
];

/* ===== C. 资金流向（8 个，含港股日K） ===== */

const TOOLS_C: ToolDef[] = [
  {
    name: 'moneyflow',
    path: 'moneyflow',
    description: 'C1 个股资金流。超大/大/中/小单买卖额、净流入。最近 limit 条（最多 30）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 30), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'hsgt',
    path: 'hsgt',
    description: 'C2 沪深港通资金流（北向/南向汇总）。最近 limit 个交易日（最多 30）',
    params: { limit: limitParam(10, 30), format: FORMAT_COMPACT },
  },
  {
    name: 'hk-hold',
    path: 'hk-hold',
    description: 'C3 沪深港通持股（按 A 股 symbol 查北向持仓变化）。最近 limit 条（最多 30）',
    params: { symbol: SYMBOL_6, limit: limitParam(10, 30), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
  {
    name: 'hk-daily',
    path: 'hk-daily',
    description: 'C3b 港股日 K 已下线，调用将返回 HTTP 410；港股日线数据暂不对外提供',
    params: {
      tsCode: { type: 'string', description: '港股代码带后缀，如 00700.HK / 09988.HK' },
      limit: limitParam(30, 30),
      format: FORMAT_COMPACT,
    },
    required: ['tsCode'],
  },
  {
    name: 'margin',
    path: 'margin',
    description: 'C4 融资融券汇总。可按交易所过滤',
    params: {
      exchange: {
        type: 'string',
        description: '交易所过滤',
        enum: ['SSE', 'SZSE', 'BSE'],
      },
      limit: limitParam(10, 30),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'dragon-tiger',
    path: 'dragon-tiger',
    description: 'C5 龙虎榜。传 symbol 查个股上榜历史；否则查 date（YYYYMMDD，缺省最新交易日）当日榜单',
    params: {
      symbol: { type: 'string', description: 'A 股 6 位代码，可选' },
      date: { type: 'string', description: '交易日 YYYYMMDD，缺省最新交易日' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'hot-money',
    path: 'hot-money',
    description: 'C6 游资名录（**席位列表本身**，知名游资营业部清单）。要某游资的具体买卖记录用 hot-money-detail',
    params: { limit: limitParam(50, 50), format: FORMAT_COMPACT },
  },
  {
    name: 'hot-money-detail',
    path: 'hot-money-detail',
    description: 'C7 游资交易明细。**按股票或日期查**：传 symbol 查个股被游资买卖记录；否则查 date 当日全市场明细。注意参数是 symbol/date，不是游资名',
    params: {
      symbol: { type: 'string', description: 'A 股 6 位代码，可选' },
      date: { type: 'string', description: '交易日 YYYYMMDD，缺省最新交易日' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
];

/* ===== D. 涨跌停与板块（4 个） ===== */

const TOOLS_D: ToolDef[] = [
  {
    name: 'limit-list',
    path: 'limit-list',
    description: 'D1 涨跌停池。某交易日涨停/跌停/炸板个股',
    params: {
      kind: {
        type: 'string',
        description: 'U 涨停 / D 跌停 / Z 炸板',
        enum: ['U', 'D', 'Z'],
        default: 'U',
      },
      date: { type: 'string', description: '交易日 YYYYMMDD，缺省最新交易日' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'limit-step',
    path: 'limit-step',
    description: 'D2 连板天梯。某交易日连板个股按连板数降序',
    params: {
      date: { type: 'string', description: '交易日 YYYYMMDD，缺省最新交易日' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'sector-flow',
    path: 'sector-flow',
    description: 'D3 板块资金流榜。最新交易日板块资金流排行',
    params: {
      type: {
        type: 'string',
        description: 'industry 行业 / concept 概念 / region 地域（兼容中文别名）',
        enum: ['industry', 'concept', 'region'],
        default: 'industry',
      },
      limit: limitParam(20, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'cyq-perf',
    path: 'cyq-perf',
    description: 'D4 筹码分布及胜率。最近 limit 条（最多 20）',
    params: { symbol: SYMBOL_6, limit: limitParam(5, 20), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
];

/* ===== E. 公告/新闻/调研（3 个） ===== */

const TOOLS_E: ToolDef[] = [
  {
    name: 'announcements',
    path: 'announcements',
    description: 'E1 公司**正式公告**（交易所披露）。支持区间/类型/关键字过滤：startDate+endDate（YYYYMMDD 区间）、category（精确类型）、q（标题模糊）。**列表浏览**用 includeContent=false 跳过正文省 80% token；**全文阅读**用默认 includeContent=true + fields 精挑。最权威但更新慢。',
    params: {
      symbol: SYMBOL_6,
      startDate: { type: 'string', description: '起始日 YYYYMMDD（按 ann_date 过滤），可选' },
      endDate: { type: 'string', description: '结束日 YYYYMMDD（按 ann_date 过滤），可选' },
      category: { type: 'string', description: '公告类型精确匹配，如 annual_report / quarterly / dividend / governance（取决于数据源 category 字段）' },
      q: { type: 'string', description: '标题关键字模糊搜索（不走 content 全文，避免性能问题）' },
      limit: limitParam(5, 30),
      includeContent: {
        type: 'boolean',
        description: '默认 true 返回 content Markdown 全文（可能 5-10KB/条）；false 仅返元数据 + summary（列表场景用）',
        default: true,
      },
      fields: { type: 'string', description: '字段白名单，逗号分隔，如 title,summary,ann_date' },
      format: FORMAT_COMPACT,
    },
    required: ['symbol'],
  },
  {
    name: 'survey',
    path: 'survey',
    description: 'E3 机构调研。最近 limit 条（最多 10）。小盘股或冷门股可能长期无机构调研',
    params: { symbol: SYMBOL_6, limit: limitParam(5, 10), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
];

/* ===== F. 板块成分（4 个） ===== */

const TOOLS_F: ToolDef[] = [
  {
    name: 'concepts',
    path: 'concepts',
    description: 'F1 东方财富**概念板块**目录（如"人工智能""半导体"）。要行业 + 概念混合的同花顺版本用 ths-boards',
    params: {
      q: { type: 'string', description: '名称关键词，可选' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'concept-stocks',
    path: 'concept-stocks',
    description: 'F2 东财概念成分股。themeCode 形如 000894.DC（从 concepts 接口获取）',
    params: {
      themeCode: { type: 'string', description: '概念代码，如 000894.DC，从 concepts 接口取' },
      limit: limitParam(50, 50),
      format: FORMAT_COMPACT,
    },
    required: ['themeCode'],
  },
  {
    name: 'ths-boards',
    path: 'ths-boards',
    description: 'F3 同花顺板块（**行业指数 + 概念指数**两种都有）。只要东财概念用 concepts',
    params: {
      q: { type: 'string', description: '名称或代码关键词，可选' },
      limit: limitParam(30, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'ths-board-stocks',
    path: 'ths-board-stocks',
    description: 'F4 同花顺板块成分股。tsCode 形如 886108.TI（从 ths-boards 接口获取）',
    params: {
      tsCode: { type: 'string', description: '板块代码，如 886108.TI，从 ths-boards 接口取' },
      limit: limitParam(50, 50),
      format: FORMAT_COMPACT,
    },
    required: ['tsCode'],
  },
];

/* ===== G. 可转债（2 个） ===== */

const TOOLS_G: ToolDef[] = [
  {
    name: 'convertible-bonds',
    path: 'convertible-bonds',
    description: 'G1 可转债列表。可按债券简称/代码 q 搜索，或按正股 stkCode 反查',
    params: {
      q: { type: 'string', description: '债券简称或代码关键词，可选' },
      stkCode: { type: 'string', description: '正股代码，可选（反查正股发行的可转债）' },
      limit: limitParam(20, 50),
      format: FORMAT_COMPACT,
    },
  },
  {
    name: 'cb-price-chg',
    path: 'cb-price-chg',
    description: 'G2 可转债转股价变动。tsCode 形如 127026.SZ',
    params: {
      tsCode: { type: 'string', description: '可转债代码带后缀，如 127026.SZ' },
      limit: limitParam(10, 20),
      format: FORMAT_COMPACT,
    },
    required: ['tsCode'],
  },
];

/* ===== H. 因子（2 个） ===== */

const TOOLS_H: ToolDef[] = [
  {
    name: 'factors',
    path: 'factors',
    description: 'H1 量化因子**全量注册表**（154 个因子的脱敏元数据）。要按 11 个 event_type 业务分类查看用 factor-categories；要某股票的技术指标值用 tech-factor',
    params: { format: FORMAT_COMPACT },
  },
  {
    name: 'tech-factor',
    path: 'tech-factor',
    description: 'H2 技术面因子。MACD/KDJ/RSI/BOLL/MA 等，前复权。最近 limit 条（最多 10）',
    params: { symbol: SYMBOL_6, limit: limitParam(1, 10), format: FORMAT_COMPACT },
    required: ['symbol'],
  },
];

/* ===== I. 宏观（3 个） ===== */

const TOOLS_I: ToolDef[] = [
  {
    name: 'macro',
    path: 'macro',
    description: 'I1 宏观指标**历史多期**（默认 12 期，最多 12）。type 仅支持 GDP/CPI/PPI/PMI。只要最新值用 macro-latest；要指标定义用 macro-definition',
    params: {
      type: {
        type: 'string',
        description: '指标 type',
        enum: ['GDP', 'CPI', 'PPI', 'PMI'],
      },
      limit: limitParam(12, 12),
      format: FORMAT_COMPACT,
    },
    required: ['type'],
  },
  {
    name: 'macro-latest',
    path: 'macro/latest',
    description: 'I2 宏观指标最新值（盘中实时缓存 5s）',
    params: {
      type: {
        type: 'string',
        description: '指标 type',
        enum: ['GDP', 'CPI', 'PPI', 'PMI'],
      },
    },
    required: ['type'],
  },
  {
    name: 'macro-definition',
    path: 'macro/definition',
    description: 'I3 宏观指标定义（名称/单位/频率/说明）',
    params: {
      type: {
        type: 'string',
        description: '指标 type',
        enum: ['GDP', 'CPI', 'PPI', 'PMI'],
      },
    },
    required: ['type'],
  },
];

/* ===== J. 日历（1 个） ===== */

const TOOLS_J: ToolDef[] = [
  {
    name: 'calendar',
    path: 'calendar',
    description: 'J1 交易日历。区间内 A 股交易日列表，跨度最多 366 天，start/end 缺省查当年至今。默认返回 List<string>（向后兼容）；传 detail=true 返回 List<{trade_date, pretrade_date}>，方便算"上一交易日"',
    params: {
      start: { type: 'string', description: '起始日 YYYYMMDD，可选' },
      end: { type: 'string', description: '结束日 YYYYMMDD，可选' },
      detail: {
        type: 'boolean',
        description: '默认 false 返回简单日期数组；true 返回带 pretrade_date 的 Map 列表（区间内首日 pretrade_date 为 null）',
        default: false,
      },
    },
  },
];

/* ===== K. 综合（2 个） ===== */

const TOOLS_K: ToolDef[] = [
  {
    name: 'profile-full',
    path: 'profile/full',
    description: 'K1 **个股综合画像（推荐用于多维分析）**。一次并发返回 8 维：basic/quote/financial(4期)/tech-factor/cyq-perf/moneyflow(5日)/hk-hold(5日)/announcements(3条)。等价于 8 接口串行调用但延时减 60%+，token 利用率最大化。**只要单个维度数据时不要用这个**（用对应单接口节省 token）',
    params: { symbol: SYMBOL_6 },
    required: ['symbol'],
  },
  {
    name: 'factor-categories',
    path: 'factor-categories',
    description: 'K2 量化因子分类目录。11 个 event_type 业务分类的说明 + 因子数量统计。配合 factors 使用',
    params: { format: FORMAT_COMPACT },
  },
];

export const ALL_TOOLS: ToolDef[] = [
  ...TOOLS_A,
  ...TOOLS_B,
  ...TOOLS_C,
  ...TOOLS_D,
  ...TOOLS_E,
  ...TOOLS_F,
  ...TOOLS_G,
  ...TOOLS_H,
  ...TOOLS_I,
  ...TOOLS_J,
  ...TOOLS_K,
];
