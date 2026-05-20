# tianqi-mcp

天启数据云 MCP Server — 将 `/v1/**` 数据面打包成 17 个 MCP tool（**本期 12 原子**，后续 3 聚合 + 2 场景 by P5-Agent-4），供 Claude Desktop / Cursor / VS Code / Cline 等 MCP 客户端使用，让 AI Agent 直接调用获取 A 股行情/财务/股东/新闻/宏观/因子数据。

## 安装

### 选项 1：本地源码（**当前唯一可用**）

```bash
git clone <repo> tianqi-mcp
cd tianqi-mcp
pnpm install
pnpm build
```

### 选项 2：npx（P5-Agent-6 发版后可用）

未来 npm 包发版后，无需本地安装，Claude Desktop 配置时自动拉取最新版。

## Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

```json
{
  "mcpServers": {
    "tianqi": {
      "command": "node",
      "args": ["/绝对路径/tianqi-mcp/dist/index.js"],
      "env": {
        "TQ_API_KEY": "tq_prod_xxx_yyy",
        "TQ_API_BASE": "http://localhost:9001"
      }
    }
  }
}
```

未来 npm 发版后可用：

```json
{
  "mcpServers": {
    "tianqi": {
      "command": "npx",
      "args": ["-y", "@tianqi/mcp-server"],
      "env": {
        "TQ_API_KEY": "tq_prod_xxx_yyy",
        "TQ_API_BASE": "http://your-gateway-host:9001"
      }
    }
  }
}
```

重启 Claude Desktop，新对话即可看到 `tianqi` 12 个 tool。

## 12 原子 tool 速查

| Tool | 用途 | 缓存 |
|---|---|---|
| `get_stock_list` | 列所有 A 股（分页） | 1h |
| `get_stock_detail` | 单股基础信息 + ST 状态 + ROE | 1h |
| `get_stock_quote` | 单股实时行情快照 | 无 |
| `get_quotes_snapshot` | 批量（≤50）实时行情 | 无 |
| `get_stock_bars_daily` | 单股日 K 历史 | 10min |
| `get_stock_financials` | 单股最新季度财务 | 6h |
| `get_top10_holders` | 单股十大股东 | 6h |
| `get_stock_news` | 单股最近新闻 | 无 |
| `get_macro_dashboard` | 中国宏观经济面板 | 5min |
| `get_macro_indicator` | 单个宏观指标时序 | 5min |
| `get_factor_registry` | 量化因子目录（脱敏） | 1h |
| `get_trade_days` | A 股交易日历 | 24h |

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `TQ_API_KEY` | ✅ | — | 从天启数据云运维获取（格式 `tq_<env>_<publicId>_<secret>`） |
| `TQ_API_BASE` | ❌ | `http://localhost:9001` | gateway 地址 |

## 常见问题

**Q: Claude Desktop 启动后没看到 tianqi tool?**
A: 检查 ① `TQ_API_KEY` 已配 ② Node ≥ 18 ③ `~/Library/Logs/Claude/mcp-server-tianqi.log` 看启动日志。

**Q: 调 tool 返"API Key 无效"?**
A: TQ_API_KEY 错误或被吊销，联系运维。

**Q: 调 tool 返"频率超限"?**
A: 当前 SKU QPS 上限到了，等几秒或联系运维升级。

**Q: get_stock_quote 数据是 15 分钟前的?**
A: SKU-FREE 行情延迟 15 分钟，升级到 SKU-PRO+ 实时。

**Q: 因子工具 `get_factor_registry` 返回里没有公式？**
A: 因子 `calc_formula` / `weight` 等内部字段属于平台保密，所有客户调用都拿不到（包括 Agent）。这是设计，不是 bug。

## 开发

```bash
pnpm install
pnpm dev          # tsx watch 模式
pnpm test         # vitest (8 个单测)
pnpm typecheck    # tsc --noEmit
pnpm build        # 产出 dist/
```

## 架构

```
Claude Desktop / Cursor / VS Code
        │ MCP stdio
        ▼
   tianqi-mcp (本仓)
        │ HTTPS + X-API-Key
        ▼
   blade-gateway (天启数据云 9001)
        │ TdcApiKeyGlobalFilter (鉴权 + 限流 + 审计)
        ▼
   blade-dataplatform
        │
        ▼
   MongoDB (业务数据)
```

详见上游设计：`tianqicloud/docs/superpowers/specs/2026-05-20-tianqi-data-cloud-p5-agent-mcp-design.md`。

## License

Apache 2.0
