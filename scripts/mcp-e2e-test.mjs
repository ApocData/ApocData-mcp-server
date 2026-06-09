#!/usr/bin/env node
/**
 * MCP 协议层端到端测试。
 *
 * 启动 dist/index.js stdio server，通过 JSON-RPC 发请求，验证：
 * 1. tools/list 返回 47 个工具，schema 结构正确
 * 2. tools/call 正常调用 isError=false，meta 头被注入到 text 内容
 * 3. tools/call 业务错误（success=false）isError=true
 * 4. tools/call HTTP 4xx（未部署端点）isError=true
 * 5. format=compact 真的返回 columns/rows 列式结构 + X-Tdc-Format 头
 * 6. 未知 tool 名返回 isError=true
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, '..', 'dist', 'index.js');

class McpClient {
  constructor() {
    this.proc = spawn('node', [SERVER], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    this.buf = '';
    this.pending = new Map();
    this.nextId = 1;
    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    this.proc.stderr.on('data', (chunk) => {
      // 转发 server 的 debug 日志
      if (process.env.VERBOSE) process.stderr.write(chunk);
    });
  }

  _onData(chunk) {
    this.buf += chunk.toString('utf-8');
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          this.pending.get(msg.id).resolve(msg);
          this.pending.delete(msg.id);
        }
      } catch (e) {
        // 忽略非 JSON 行
      }
    }
  }

  request(method, params) {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify(msg) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 15000);
    });
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  close() {
    this.proc.stdin.end();
    this.proc.kill();
  }
}

const checks = [];
function check(name, cond, detail = '') {
  checks.push({ kind: 'PROD', name, pass: !!cond, detail });
}
function checkLag(name, cond, detail = '') {
  checks.push({ kind: 'LAG', name, pass: !!cond, detail });
}

const client = new McpClient();

try {
  // 1. initialize
  const init = await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e', version: '0' },
  });
  client.notify('notifications/initialized');
  check('initialize 返回 protocolVersion', init.result?.protocolVersion === '2024-11-05');
  check('serverInfo.name = apocdata-mcp-server', init.result?.serverInfo?.name === 'apocdata-mcp-server');

  // 2. tools/list
  const list = await client.request('tools/list', {});
  const tools = list.result?.tools ?? [];
  check('tools/list 返回 47 工具', tools.length === 47, `got ${tools.length}`);
  const quote = tools.find(t => t.name === 'quote');
  check('quote 工具有正确 schema', quote?.inputSchema?.required?.[0] === 'symbol');
  const macro = tools.find(t => t.name === 'macro');
  check('macro 工具 enum 含 GDP/CPI/PPI/PMI',
    JSON.stringify(macro?.inputSchema?.properties?.type?.enum) === JSON.stringify(['GDP', 'CPI', 'PPI', 'PMI']));

  // 3. 正常调用：stock(600519) → isError=false
  const ok = await client.request('tools/call', {
    name: 'stock',
    arguments: { symbol: '600519' },
  });
  check('正常调用 isError=false', ok.result?.isError === false);
  const okText = ok.result?.content?.[0]?.text ?? '';
  check('正常调用 body 含贵州茅台', okText.includes('贵州茅台'));

  // 4. 业务错误：holders(symbol=999999) → success=false → isError=true
  const bizErr = await client.request('tools/call', {
    name: 'holders',
    arguments: { symbol: '999999' },
  });
  check('业务错误 isError=true', bizErr.result?.isError === true);
  const bizText = bizErr.result?.content?.[0]?.text ?? '';
  check('业务错误 body 含错误消息', bizText.includes('未找到股票'));

  // 5. HTTP 4xx：未部署端点 profile-full → isError=true
  const httpErr = await client.request('tools/call', {
    name: 'profile-full',
    arguments: { symbol: '600519' },
  });
  check('HTTP 404 isError=true', httpErr.result?.isError === true);

  // 6. format=compact：daily(symbol=600519, limit=3, format=compact)
  // §5.3 advice 源码已有，线上待发版（注册或重启）
  const compact = await client.request('tools/call', {
    name: 'daily',
    arguments: { symbol: '600519', limit: 3, format: 'compact' },
  });
  const compactText = compact.result?.content?.[0]?.text ?? '';
  checkLag('compact 响应有 X-Tdc-Format=compact 头', compactText.includes('X-Tdc-Format'));
  checkLag('compact 响应含 columns 字段', compactText.includes('"columns"'));
  checkLag('compact 响应含 rows 字段', compactText.includes('"rows"'));

  // 7. 未知 tool
  const unknown = await client.request('tools/call', {
    name: 'totally-fake-tool',
    arguments: {},
  });
  check('未知 tool 名 isError=true', unknown.result?.isError === true);

  // 8. resources/list 列出 3 个文档
  const resList = await client.request('resources/list', {});
  const resources = resList.result?.resources ?? [];
  check('resources/list 返回 3 个 resource', resources.length === 3, `got ${resources.length}`);
  const uris = resources.map(r => r.uri).sort();
  check('resources 含 guide/scenarios/limits',
    JSON.stringify(uris) === JSON.stringify(['apocdata://guide', 'apocdata://limits', 'apocdata://scenarios']));

  // 9. resources/read 拉取 guide
  const guide = await client.request('resources/read', { uri: 'apocdata://guide' });
  const guideText = guide.result?.contents?.[0]?.text ?? '';
  check('resources/read guide 含工具速查', guideText.includes('profile-full'));
  check('resources/read guide 含元信息说明', guideText.includes('X-Tdc-RateLimit-Remaining'));

  // 10. resources/read 未知 URI 返回 JSON-RPC error
  const badRead = await client.request('resources/read', { uri: 'apocdata://nope' });
  check('resources/read 未知 URI 返回 error response', badRead.error !== undefined,
    `got ${JSON.stringify(badRead).slice(0, 80)}`);

} finally {
  client.close();
}

// 报告
console.log('');
for (const c of checks) {
  const sym = c.kind === 'LAG' ? (c.pass ? '✓' : '— LAG') : (c.pass ? '✓' : '✗');
  console.log(`${sym} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}

const prod = checks.filter(c => c.kind === 'PROD');
const lag = checks.filter(c => c.kind === 'LAG');
const prodPass = prod.filter(c => c.pass).length;
const lagPass = lag.filter(c => c.pass).length;

console.log('');
console.log(`PROD: ${prodPass}/${prod.length} pass`);
if (lag.length) console.log(`LAG : ${lagPass}/${lag.length} 线上已生效（其余待发版）`);
process.exit(prodPass === prod.length ? 0 : 1);
