# @apocdata-info/mcp-server

天启至数 **ApocData** 的 MCP（Model Context Protocol）Server。把 46 个免鉴权 A 股数据接口包装成 MCP tools，可在 Claude Desktop / Cursor / Cline / Continue 等任意 MCP client 中直接调用。

- 数据源：`https://www.apocdata.com/api/blade-dataplatform/open/data/*`
- 无需 API Key，无需注册（网关已配置 `/open/**` 免鉴权）
- 自动透传 `X-Tdc-*` 元信息头（限流剩余/截断标志/错误码/缓存策略）
- 46 工具覆盖：行情、估值、财务、股东、资金流、涨跌停、板块、公告、宏观、因子、综合画像

---

## 安装

### 方式 A：npx（推荐，零安装）

直接在 client 配置里写 `npx -y @apocdata-info/mcp-server`，无需手动 install。

### 方式 B：全局安装

```bash
npm install -g @apocdata-info/mcp-server
apocdata-mcp   # 可执行命令
```

---

## Client 配置示例

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "apocdata": {
      "command": "npx",
      "args": ["-y", "@apocdata-info/mcp-server"]
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "apocdata": {
      "command": "npx",
      "args": ["-y", "@apocdata-info/mcp-server"]
    }
  }
}
```

### Cline / Continue / 其它 stdio MCP client

同上，传 `command=npx, args=["-y","@apocdata-info/mcp-server"]` 即可。

### CLI flags

```bash
apocdata-mcp --version    # 打印版本号
apocdata-mcp --help       # 显示完整用法
```

### 信号

- `SIGTERM` / `SIGINT`：优雅退出。等正在进行的请求完成（最多 5 秒），再关闭 transport 退出。

### 调试模式

环境变量 `APOCDATA_DEBUG=1` 会把每次 HTTP 调用的 path/status/meta 打到 stderr：

```json
{
  "mcpServers": {
    "apocdata": {
      "command": "npx",
      "args": ["-y", "@apocdata-info/mcp-server"],
      "env": { "APOCDATA_DEBUG": "1" }
    }
  }
}
```

### 自定义 BASE URL

环境变量 `APOCDATA_BASE_URL` 可指向内网/私有部署：

```json
"env": { "APOCDATA_BASE_URL": "https://intranet.example.com/api/blade-dataplatform/open/data" }
```

### 超时与重试

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `APOCDATA_TIMEOUT_MS` | `30000` | 单次请求超时（毫秒），到时间 AbortController 中断 |
| `APOCDATA_MAX_RETRIES` | `2` | 5xx 或网络错误重试次数（不含首次），指数 backoff 500→1000→2000ms |

4xx 不重试（业务错误重试无意义）。重试用尽后返回最后一次的 5xx 响应，或抛 `NetworkError`（网络异常）。

---

## 工具清单（46 个）

| 类别 | 工具 |
| --- | --- |
| **A. 行情与估值（10）** | `quote` `quotes` `daily` `stock` `stocks` `st` `ranking` `indexes` `index-daily` `hot-rank` |
| **B. 财务与股东（8）** | `financial` `express` `dividend` `holders` `holder-number` `share-float` `repurchase` `block-trade` |
| **C. 资金流向（8）** | `moneyflow` `hsgt` `hk-hold` `hk-daily` `margin` `dragon-tiger` `hot-money` `hot-money-detail` |
| **D. 涨跌停与板块（4）** | `limit-list` `limit-step` `sector-flow` `cyq-perf` |
| **E. 公告/调研（2）** | `announcements` `survey` |
| **F. 板块成分（4）** | `concepts` `concept-stocks` `ths-boards` `ths-board-stocks` |
| **G. 可转债（2）** | `convertible-bonds` `cb-price-chg` |
| **H. 因子（2）** | `factors` `tech-factor` |
| **I. 宏观（3）** | `macro` `macro-latest` `macro-definition` |
| **J. 日历（1）** | `calendar` |
| **K. 综合（2）** | `profile-full` `factor-categories` |

每个 tool 的入参/出参/默认值在 MCP 协议层用 JSON Schema 暴露，client 会自动展示。

## MCP Resources

除工具外还暴露 3 个 markdown 文档，Agent 通过 `resources/list` 和 `resources/read` 拉取：

| URI | 内容 |
| --- | --- |
| `apocdata://guide` | 全局接入指南：46 工具分组、symbol 格式、延迟/限流/错误协议、元信息头说明 |
| `apocdata://scenarios` | 场景速查：常见用户意图到工具组合的映射 + 反模式（避免串调 8 个接口） |
| `apocdata://limits` | limit/fields/compact 速查表：每个工具的默认值/上限/字段裁剪支持情况 |

---

## 用法示例（在 Claude 里直接问）

```
> 帮我看下贵州茅台最近 5 天行情
（Claude 调用 daily(symbol="600519", limit=5)）

> 现在涨幅榜前 10 是哪些股票？
（Claude 调用 ranking(type="gainers", limit=10)）

> 整理一下平安银行的综合画像
（Claude 调用 profile-full(symbol="000001")）

> CPI 最近一次数据是多少？
（Claude 调用 macro-latest(type="cpi")）
```

---

## 性能与限流

- 单 IP 限流：60 req/min（响应头 `X-Tdc-RateLimit-Remaining` 透传剩余配额）
- 缓存策略：盘中实时数据 5s、盘后日更 5min、元数据 1h（`Cache-Control` 头自动给）
- `limit` 参数上限 50，超出会**静默截断**（看响应头 `X-Tdc-Truncated`）
- 大批量数据建议用 `format=compact` 列式输出，节省 60-70% token
- 字段较多的接口（如 financial、announcements）支持 `fields=...` 裁剪

详细行为参考主 SKILL 文档：<https://github.com/ApocData/ApocData-skill>

---

## 开发

```bash
git clone https://github.com/ApocData/ApocData-skill.git
cd ApocData-skill/mcp-server
npm install
npm run build
npm start
```

源码结构：

```
src/
  index.ts     # MCP server 入口，stdio transport
  client.ts    # HTTP client，BASE_URL 调用 + meta 头提取
  tools.ts     # 46 个工具的配置表（声明式）
```

要加一个新接口：在 `tools.ts` 对应分组里加一条 `ToolDef`，重新 build 即可，无需改其它代码。

## 测试

```bash
npm test                 # build + 6 类测试全跑（需在 tianqi-mcp 目录执行）
npm run test:unit        # client 单测：超时/重试/URL 构造，不打外网
npm run test:contract    # 46 工具逐个真实 HTTP 调用（happy path）
npm run test:errors      # 错误路径：非法参数 / 不存在 symbol / 日期格式
npm run test:coverage    # 限流头/截断头/所有枚举值遍历
npm run test:e2e         # MCP 协议层：stdio JSON-RPC + isError + compact
npm run test:integration # 集成：mock HTTP + 子进程 server，验证 retries / timeout / --version / SIGTERM
```

六个脚本对应六种验证：

| 脚本 | 验证 |
| --- | --- |
| `client-unit-test.mjs` | client 4xx 不重试、5xx 重试到成功/用尽、超时归一化、meta 头提取、URL 构造（mock fetch） |
| `contract-test.mjs` | 所有 46 端点参数名/必填和后端 `@RequestParam` 一致；happy path 全部 200 |
| `error-path-test.mjs` | 非法参数/资源不存在返回 HTTP 400 + `success=false` + `X-Tdc-Error-Code` |
| `coverage-test.mjs` | 限流头 / 截断头透传；所有 enum 工具（ranking / limit-list / sector-flow / hot-rank / margin / macro）的合法值全部遍历 |
| `mcp-e2e-test.mjs` | MCP 协议正确：tools/list 46 个、isError 在 HTTP 4xx 和 `success=false` 都正确标记、compact 模式列式输出 |
| `integration-test.mjs` | 真实 backoff 耗时验证；真实 timeout 触发；`--version` / `--help` CLI；SIGTERM 空闲即时退出；SIGTERM in-flight 等待完成后退出 |

私有部署：`APOCDATA_BASE_URL=http://your.host/path npm test`

### 生产契约基线

当前 `www.apocdata.com` 已提供并由测试套件持续验证：

- `ranking` / `macro` / `macro/latest` / `macro/definition` / `sector-flow` / `hot-rank` / `margin` 的非法 enum 校验
- `X-Tdc-Error-Code` 响应头
- `X-Tdc-RateLimit-Remaining` 响应头（限流剩余配额）
- `X-Tdc-Truncated` 响应头（limit 超上限通知）
- `format=compact` 列式输出
- `/profile/full` 和 `/factor-categories` 两个端点本身

---

## License

Apache-2.0
