# ApocData MCP Server

## 产品定位

天启至数 ApocData MCP Server 是一个**免鉴权**的 A 股数据 MCP 服务，将 46 个金融数据接口封装为标准 MCP tools，可在 Claude Desktop、Cursor、Cline、Continue 等任意 MCP 客户端中直接调用。

- **零门槛**：无需 API Key，无需注册，开箱即用
- **全覆盖**：46 个工具涵盖行情、财务、资金流、涨跌停、板块、公告、宏观等
- **标准协议**：完全遵循 Model Context Protocol，兼容所有 MCP 客户端

## 核心功能

| 功能模块 | 工具数 | 说明 |
|---------|--------|------|
| 实时行情 | 3 | 单只/批量行情快照、分钟 K 线 |
| 历史数据 | 4 | 日K/周K/月K/复权因子 |
| 财务数据 | 5 | 利润表/资产负债表/现金流/财务指标/业绩快报 |
| 股东分析 | 3 | 十大股东/十大流通股东/股东人数 |
| 资金流向 | 3 | 个股资金流/板块资金流/北向资金 |
| 涨跌停 | 4 | 涨停池/跌停池/炸板池/连板统计 |
| 板块行情 | 4 | 行业/概念/地域/自定义板块 |
| 公告信息 | 3 | 公告列表/公告详情/公告摘要 |
| 宏观经济 | 5 | CPI/PPI/M2/GDP/社融 |
| 综合画像 | 3 | 多维画像/基本面评分/技术因子 |
| 股票搜索 | 3 | 关键词搜索/股票列表/基本信息 |
| 其他 | 6 | 可转债/指数/基金/期货等 |

## 安装方式

### npx（推荐，零安装）

```json
{
  "mcpServers": {
    "apocdata": {
      "command": "npx",
      "args": ["-y", "@apocdata/mcp-server"]
    }
  }
}
```

### 全局安装

```bash
npm install -g @apocdata/mcp-server
apocdata-mcp
```

## 工具列表（46 个）

| 工具名 | 说明 |
|--------|------|
| quote | 实时行情快照（延迟 15min） |
| quotes | 批量行情快照（最多 10 只） |
| minute-k | 分钟 K 线 |
| daily | 日 K 历史 |
| weekly | 周 K 历史 |
| monthly | 月 K 历史 |
| adj-factor | 复权因子 |
| stock | 股票基本信息 |
| stocks | 股票搜索 |
| stock-list | 股票列表 |
| financial | 财务指标 |
| income | 利润表 |
| balance | 资产负债表 |
| cashflow | 现金流量表 |
| express | 业绩快报 |
| holder-number | 股东人数 |
| top10-holders | 十大股东 |
| top10-float-holders | 十大流通股东 |
| moneyflow | 个股资金流 |
| sector-moneyflow | 板块资金流 |
| north-moneyflow | 北向资金 |
| limit-list | 涨停池 |
| limit-down-list | 跌停池 |
| broken-limit | 炸板池 |
| limit-consecutive | 连板统计 |
| sector | 板块列表 |
| sector-stock | 板块成分股 |
| sector-constituent | 板块详情 |
| index-quote | 指数行情 |
| announcements | 公告列表 |
| announcement-detail | 公告详情 |
| announcement-summary | 公告摘要（LLM 生成） |
| profile-full | 综合画像（8 维数据） |
| fundamental-score | 基本面评分 |
| tech-factor | 技术因子 |
| macro-latest | 最新宏观数据 |
| macro-history | 宏观历史数据 |
| macro-calendar | 宏观发布日历 |
| convertible | 可转债列表 |
| fund | 基金信息 |
| futures | 期货行情 |
| etf | ETF 行情 |
| margin | 融资融券 |
| block-trade | 大宗交易 |
| repurchase | 回购 |
| st | ST 股票信息 |

## 技术特性

- **免鉴权**：网关已配置 `/open/**` 免鉴权，无需任何认证
- **元信息透传**：自动透传 `X-Tdc-*` 头（限流剩余/截断标志/错误码/缓存策略）
- **优雅退出**：支持 SIGTERM/SIGINT 信号，等待请求完成后退出
- **调试模式**：环境变量 `APOCDATA_DEBUG=1` 开启调试日志

## 链接

- **GitHub**：https://github.com/ApocData/ApocData-mcp-server
- **数据源**：https://data.tianqis.com
- **官网**：https://www.apocdata.com
