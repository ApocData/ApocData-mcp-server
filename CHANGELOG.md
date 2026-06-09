# Changelog

All notable changes to `@apocdata/mcp-server` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **后端 §5.5 数据 SLA 标注**：响应头 `X-Tdc-Freshness-Tier` + `X-Tdc-Freshness-Detail` 透传数据时效分类（intraday / post-close / t0-morning / quarterly / metadata / aggregated 共 6 档）。MCP server 已通过 `x-tdc-` 前缀自动透传，guide resource 加了 6 档说明 + 典型用法
- **后端 §6.3 OpenAPI @Operation 文案调优**：12 个易混淆工具（quote / stock / daily / ranking / announcements / news / concepts / ths-boards / hot-money / hot-money-detail / macro / factors / profile-full / factor-categories）的 description 加"何时用 / 不该用"对照，Java 侧文档对齐 MCP server tools.ts
- **后端 §2.6 fields 全局扩展**：所有 47 个 `/open/data/*` 接口都支持 `?fields=col1,col2`（之前只有 financial / announcements）。MCP resources 的 `apocdata://limits` 段相应更新说明全局可用
- **后端 announcements 加过滤参数**：解决用户实测痛点"只能拿最近 5 条无任何过滤"。新增 `startDate` / `endDate` / `category` / `q` / `includeContent` 参数；limit 上限从 5 提到 30。MCP tool schema 同步更新，对应字段同步进 SKILL.md
- **后端 news 加过滤参数**：与 announcements 同款思路。新增 `startDate` / `endDate` / `category` / `q` / `sentiment`（bullish/neutral/bearish）/ `importance`（high/medium/low）；limit 上限从 10 提到 30；时间过滤优先级 startDate+endDate > hours
- **后端 calendar 加 `?detail=true`**：路线图差异登记"pretrade_date 可由相邻交易日计算"项落地。默认返回 List&lt;String&gt; 向后兼容；detail=true 返回 List&lt;{trade_date, pretrade_date}&gt;
- **MCP resources**：暴露 3 个 markdown 文档（`apocdata://guide` 接入指南 / `apocdata://scenarios` 场景速查 / `apocdata://limits` limit-fields-compact 速查表），Agent 一连上即可读到全局上下文
- **工具 description 调优**：易混淆的工具组（quote vs profile-full、daily vs ranking、news vs announcements、concepts vs ths-boards、hot-money vs hot-money-detail、macro 三件套）加入"何时用 / 不该用"提示，提升 Agent 选择准确率
- **GitHub Actions**：
  - `test.yml`：push / PR 触发，矩阵 Node 18/20/22 × Ubuntu/macOS，跑 unit + integration（不打外网）
  - `publish.yml`：GitHub Release 触发自动 `npm publish --access public --provenance`；支持 workflow_dispatch dry-run
- **CHANGELOG.md**：Keep-a-Changelog 格式
- **发包脚本**：`npm run publish:dry`、`npm run version:patch|minor|major`、`prepublishOnly` 自动跑 test:ci

### Changed

- e2e 测试用例从 11 涨到 16（加 resources/list、resources/read、未知 URI 错误响应）

## [0.1.0] - 2026-05-27

### Added

- 初始版本，覆盖 ApocData `/open/data/*` 全部 47 个免鉴权接口
- MCP server（stdio transport），自动透传 `X-Tdc-*` 元信息头与 `Cache-Control`
- HTTP client：30s 超时（AbortController）、5xx/网络异常指数 backoff 重试 ×2、4xx 不重试、错误归一化为 `NetworkError`
- 优雅退出：SIGTERM/SIGINT 等 in-flight 请求结束（最多 5s）后再退
- CLI：`--version` / `--help`，环境变量 `APOCDATA_BASE_URL` / `APOCDATA_DEBUG` / `APOCDATA_TIMEOUT_MS` / `APOCDATA_MAX_RETRIES`
- 测试套件 6 套：unit / contract / errors / coverage / e2e / integration，总计 125 PROD case

### Known limitations

后端服务 `data.tianqis.com` 当前部署版本滞后于源码，以下能力 MCP 客户端代码已就绪，需后端 redeploy 才会生效：

- `profile/full` 与 `factor-categories` 端点（404）
- 多接口非法 enum 校验（`ranking` direction / `macro` type / `sector-flow` type / `hot-rank` type / `margin` exchange / `macro-latest|definition` type）
- `X-Tdc-Error-Code` / `X-Tdc-RateLimit-Remaining` / `X-Tdc-Truncated` 响应头
- `format=compact` 列式输出

[Unreleased]: https://github.com/ApocData/ApocData-skill/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ApocData/ApocData-skill/releases/tag/v0.1.0
