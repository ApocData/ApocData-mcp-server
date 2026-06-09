#!/usr/bin/env node
/**
 * 集成测试：
 * 1. 起一个本地 mock HTTP server 编排响应序列
 * 2. 通过子进程启 MCP server，APOCDATA_BASE_URL 指向 mock
 * 3. 验证：
 *    - 真实 retries：连续 503 后 200 应在 ~500+1000ms 后成功
 *    - timeout：mock 故意延迟，client timeout 应触发 NetworkError
 *    - --version：纯 CLI 行为
 *    - SIGTERM 优雅退出：发信号后进程在 grace period 内 exit 0
 *    - SIGTERM 等 in-flight：信号到来时有正在跑的请求，等完成后再退
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_JS = resolve(__dirname, '..', 'dist', 'index.js');

const checks = [];
function check(name, cond, detail = '') {
  checks.push({ name, pass: !!cond, detail });
}

/** 起一个 mock HTTP server，handler 决定每次请求的响应 */
function startMockServer(handler) {
  return new Promise((resolveServer) => {
    let callCount = 0;
    const server = createServer((req, res) => {
      callCount++;
      Promise.resolve(handler(callCount, req)).then((spec) => {
        res.statusCode = spec.status ?? 200;
        for (const [k, v] of Object.entries(spec.headers ?? {})) res.setHeader(k, v);
        res.end(spec.body ?? '');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveServer({
        url: `http://127.0.0.1:${port}/open/data`,
        get callCount() { return callCount; },
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/** 用 MCP JSON-RPC 包一次 tools/call，返回结果文本和耗时 */
class McpHarness {
  constructor(env = {}) {
    this.proc = spawn('node', [SERVER_JS], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    this.buf = '';
    this.pending = new Map();
    this.nextId = 1;
    this.exitCode = null;
    this.exitSignal = null;
    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    this.proc.stderr.on('data', () => {});
    this.proc.on('exit', (code, signal) => {
      this.exitCode = code;
      this.exitSignal = signal;
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
      } catch {
        // 忽略
      }
    }
  }

  request(method, params, timeoutMs = 30000) {
    const id = this.nextId++;
    return new Promise((resolveReq, rejectReq) => {
      this.pending.set(id, { resolve: resolveReq, reject: rejectReq });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rejectReq(new Error(`Timeout ${method}`));
        }
      }, timeoutMs);
    });
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  async init() {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'integration', version: '0' },
    });
    this.notify('notifications/initialized');
  }

  async waitForExit(timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    while (this.exitCode === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return { code: this.exitCode, signal: this.exitSignal };
  }

  close() {
    try { this.proc.stdin.end(); } catch {}
    this.proc.kill();
  }
}

// ============= 测试 1：真实 retries =============
{
  const mock = await startMockServer((n) => {
    if (n < 3) return { status: 503, body: JSON.stringify({ msg: 'unavailable' }) };
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 200, success: true, data: { symbol: '000001' } }),
    };
  });

  const harness = new McpHarness({
    APOCDATA_BASE_URL: mock.url,
    APOCDATA_MAX_RETRIES: '3',
  });
  await harness.init();

  const start = Date.now();
  const res = await harness.request('tools/call', {
    name: 'stock',
    arguments: { symbol: '000001' },
  });
  const elapsed = Date.now() - start;

  check('retry 后 isError=false', res.result?.isError === false);
  check('retry 后 body 含 success', res.result?.content?.[0]?.text?.includes('"success": true'));
  check('mock server 被调 3 次', mock.callCount === 3, `actual=${mock.callCount}`);
  // backoff: 500 + 1000 = 1500ms 最少
  check('retry 耗时 ≥ 1500ms（backoff 真实生效）', elapsed >= 1500, `elapsed=${elapsed}ms`);

  harness.close();
  await mock.close();
}

// ============= 测试 2：timeout =============
{
  const mock = await startMockServer(() => new Promise((r) => {
    // 永远不响应
    setTimeout(() => r({ status: 200, body: 'too late' }), 30000);
  }));

  const harness = new McpHarness({
    APOCDATA_BASE_URL: mock.url,
    APOCDATA_TIMEOUT_MS: '200',
    APOCDATA_MAX_RETRIES: '0',
  });
  await harness.init();

  const start = Date.now();
  const res = await harness.request('tools/call', {
    name: 'stock',
    arguments: { symbol: '000001' },
  }, 10000);
  const elapsed = Date.now() - start;

  check('timeout isError=true', res.result?.isError === true);
  check('timeout 错误消息含 "timed out"', res.result?.content?.[0]?.text?.includes('timed out'));
  check('timeout 实际生效（<1500ms）', elapsed < 1500, `elapsed=${elapsed}ms`);

  harness.close();
  await mock.close();
}

// ============= 测试 3：--version =============
{
  const proc = spawn('node', [SERVER_JS, '--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  proc.stdout.on('data', (c) => { stdout += c; });
  const exitInfo = await new Promise((r) => proc.on('exit', (code) => r({ code, stdout })));
  check('--version exit 0', exitInfo.code === 0);
  check('--version 输出版本号', /apocdata-mcp-server \d+\.\d+\.\d+/.test(exitInfo.stdout));
}

// ============= 测试 4：--help =============
{
  const proc = spawn('node', [SERVER_JS, '--help'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  proc.stdout.on('data', (c) => { stdout += c; });
  const exitInfo = await new Promise((r) => proc.on('exit', (code) => r({ code, stdout })));
  check('--help exit 0', exitInfo.code === 0);
  check('--help 输出 Usage 段', exitInfo.stdout.includes('Usage:'));
  check('--help 列出 APOCDATA_BASE_URL', exitInfo.stdout.includes('APOCDATA_BASE_URL'));
}

// ============= 测试 5：SIGTERM 空闲时立即退出 =============
{
  const harness = new McpHarness({});
  await harness.init();
  // 验证 tools/list 工作
  const list = await harness.request('tools/list', {});
  check('启动后 tools/list 正常', list.result?.tools?.length === 47);

  const sigStart = Date.now();
  harness.proc.kill('SIGTERM');
  const exitInfo = await harness.waitForExit(3000);
  const sigElapsed = Date.now() - sigStart;
  check('SIGTERM 空闲时 exit 0', exitInfo.code === 0, `code=${exitInfo.code} signal=${exitInfo.signal}`);
  check('SIGTERM 空闲时退出快（<1500ms）', sigElapsed < 1500, `elapsed=${sigElapsed}ms`);
}

// ============= 测试 6：SIGTERM 在 in-flight 请求时等待完成 =============
{
  // mock 响应延迟 800ms
  const mock = await startMockServer(() => new Promise((r) => {
    setTimeout(() => r({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 200, success: true, data: { ok: 1 } }),
    }), 800);
  }));

  const harness = new McpHarness({
    APOCDATA_BASE_URL: mock.url,
    APOCDATA_MAX_RETRIES: '0',
  });
  await harness.init();

  // 发个请求但不等
  const inflightPromise = harness.request('tools/call', {
    name: 'stock',
    arguments: { symbol: '000001' },
  }, 5000);

  // 给 server 一点时间真的发出 fetch
  await new Promise((r) => setTimeout(r, 200));

  const sigStart = Date.now();
  harness.proc.kill('SIGTERM');

  // in-flight 请求应该完成
  let inflightResult = null;
  try { inflightResult = await inflightPromise; } catch (e) { inflightResult = { error: e.message }; }

  const exitInfo = await harness.waitForExit(3000);
  const sigElapsed = Date.now() - sigStart;

  check('SIGTERM 等待 in-flight 完成（≥500ms）', sigElapsed >= 500, `elapsed=${sigElapsed}ms`);
  check('SIGTERM 在 grace 内退出（<5500ms）', sigElapsed < 5500, `elapsed=${sigElapsed}ms`);
  check('in-flight 请求得到响应', inflightResult?.result?.isError === false,
    `result=${JSON.stringify(inflightResult).slice(0, 80)}`);
  check('SIGTERM 后 exit 0', exitInfo.code === 0, `code=${exitInfo.code}`);

  await mock.close();
}

// 报告
const pass = checks.filter(c => c.pass).length;
console.log('');
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
console.log('');
console.log(`${pass}/${checks.length} checks pass`);
process.exit(pass === checks.length ? 0 : 1);
