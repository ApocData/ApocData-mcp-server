#!/usr/bin/env node
/**
 * 天启至数 ApocData - MCP Server
 *
 * stdio transport，47 个 A 股数据工具。
 *
 * CLI:
 *   apocdata-mcp                 启动 MCP server
 *   apocdata-mcp --version | -v  打印版本号后退出
 *   apocdata-mcp --help    | -h  打印用法后退出
 *
 * 环境变量：
 *   APOCDATA_BASE_URL    覆盖默认 base URL（默认指向 data.tianqis.com）
 *   APOCDATA_DEBUG       设为 "1" 时把每次调用元信息打到 stderr
 *   APOCDATA_TIMEOUT_MS  单次请求超时（默认 30000）
 *   APOCDATA_MAX_RETRIES 5xx/网络错误重试次数（默认 2）
 *
 * 信号：
 *   SIGTERM / SIGINT  优雅退出（等 in-flight 请求结束，最多 5s）
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ApocDataClient, NetworkError } from './client.js';
import { ALL_RESOURCES } from './resources.js';
import { ALL_TOOLS, type ToolDef } from './tools.js';

const PKG_VERSION = readPackageVersion();
const DEFAULT_BASE_URL = 'https://data.tianqis.com/api/blade-dataplatform/open/data';
const SHUTDOWN_GRACE_MS = 5_000;

// === CLI 处理（必须在创建 transport 之前，否则会污染 stdout） ===
handleCliFlags(process.argv.slice(2));

const baseUrl = process.env.APOCDATA_BASE_URL ?? DEFAULT_BASE_URL;
const debug = process.env.APOCDATA_DEBUG === '1';

const client = new ApocDataClient(baseUrl, {
  timeoutMs: parsePositiveInt(process.env.APOCDATA_TIMEOUT_MS, 30_000),
  maxRetries: parsePositiveInt(process.env.APOCDATA_MAX_RETRIES, 2),
});
const toolByName = new Map<string, ToolDef>(ALL_TOOLS.map((t) => [t.name, t]));

const server = new Server(
  {
    name: 'apocdata-mcp-server',
    version: PKG_VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

const resourceByUri = new Map(ALL_RESOURCES.map((r) => [r.uri, r]));

// 优雅退出状态
let inflight = 0;
let shuttingDown = false;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: buildInputSchema(t),
    })),
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: ALL_RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const resource = resourceByUri.get(uri);
  if (!resource) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: resource.text,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (shuttingDown) {
    return {
      content: [{ type: 'text', text: 'Server shutting down, request rejected' }],
      isError: true,
    };
  }
  const { name, arguments: args = {} } = request.params;
  const tool = toolByName.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  inflight++;
  try {
    const result = await client.call(tool.path, args as Record<string, unknown>);
    if (debug) {
      process.stderr.write(
        `[apocdata-mcp] ${tool.path} status=${result.status} meta=${JSON.stringify(result.meta)}\n`,
      );
    }
    return {
      content: [
        {
          type: 'text',
          text: formatResponse(result.body, result.meta),
        },
      ],
      isError: result.status >= 400 || isApiError(result.body),
    };
  } catch (err) {
    const prefix = err instanceof NetworkError ? 'Network error' : 'Request failed';
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `${prefix}: ${msg}` }],
      isError: true,
    };
  } finally {
    inflight--;
  }
});

function buildInputSchema(tool: ToolDef) {
  const properties: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(tool.params)) {
    const schema: Record<string, unknown> = {
      type: def.type,
      description: def.description,
    };
    if (def.enum) schema.enum = def.enum;
    if (def.default !== undefined) schema.default = def.default;
    properties[name] = schema;
  }
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };
  if (tool.required && tool.required.length > 0) {
    schema.required = tool.required;
  }
  return schema;
}

function isApiError(body: unknown): boolean {
  if (body && typeof body === 'object' && 'success' in body) {
    return (body as { success: unknown }).success === false;
  }
  return false;
}

/**
 * 把响应 body + meta 合并成给 Agent 看的文本。
 * meta 里的 X-Tdc-* 头放在前面（限流/截断/错误码线索），body 紧跟其后。
 */
function formatResponse(body: unknown, meta: Record<string, string>): string {
  const interesting = Object.entries(meta).filter(([k]) => {
    const lower = k.toLowerCase();
    return lower.startsWith('x-tdc-') || lower === 'cache-control';
  });
  const metaText = interesting.length
    ? `<!-- meta\n${interesting.map(([k, v]) => `${k}: ${v}`).join('\n')}\n-->\n`
    : '';
  return metaText + JSON.stringify(body, null, 2);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readPackageVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    // dist/index.js → ../package.json
    const pkg = JSON.parse(readFileSync(resolve(dir, '..', 'package.json'), 'utf-8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function handleCliFlags(argv: string[]): void {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`apocdata-mcp-server ${PKG_VERSION}\n`);
    process.exit(0);
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(
      `apocdata-mcp-server ${PKG_VERSION}\n` +
      `\n` +
      `天启至数 ApocData - MCP Server，stdio transport，47 个 A 股数据工具。\n` +
      `\n` +
      `Usage:\n` +
      `  apocdata-mcp                  Start MCP server on stdio\n` +
      `  apocdata-mcp --version|-v     Print version and exit\n` +
      `  apocdata-mcp --help|-h        Show this help\n` +
      `\n` +
      `Environment:\n` +
      `  APOCDATA_BASE_URL             Override base URL (default ${DEFAULT_BASE_URL})\n` +
      `  APOCDATA_DEBUG=1              Log call meta to stderr\n` +
      `  APOCDATA_TIMEOUT_MS=30000     Per-request timeout in ms\n` +
      `  APOCDATA_MAX_RETRIES=2        Retries on 5xx / network error\n` +
      `\n` +
      `Signals:\n` +
      `  SIGTERM, SIGINT               Graceful shutdown (wait up to 5s for inflight)\n` +
      `\n` +
      `Docs: https://github.com/ApocData/ApocData-skill\n`,
    );
    process.exit(0);
  }
  // 未识别参数：警告但继续启动
  const unknown = argv.filter((a) => a.startsWith('-'));
  if (unknown.length > 0) {
    process.stderr.write(`[apocdata-mcp] Unknown flags ignored: ${unknown.join(' ')}\n`);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  if (debug) {
    process.stderr.write(`[apocdata-mcp] ${signal} received, draining ${inflight} in-flight…\n`);
  }
  // 等 in-flight 完成（最多 SHUTDOWN_GRACE_MS）
  const deadline = Date.now() + SHUTDOWN_GRACE_MS;
  while (inflight > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  try {
    await server.close();
  } catch (err) {
    if (debug) {
      process.stderr.write(`[apocdata-mcp] server.close() error: ${String(err)}\n`);
    }
  }
  process.exit(0);
}

async function main() {
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (debug) {
    process.stderr.write(
      `[apocdata-mcp] server ready, version=${PKG_VERSION}, base=${baseUrl}, tools=${ALL_TOOLS.length}\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
