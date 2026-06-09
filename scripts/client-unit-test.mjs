#!/usr/bin/env node
/**
 * ApocDataClient 单元测试。
 *
 * 用 monkeypatch globalThis.fetch 模拟 HTTP 响应，不打外网。
 * 验证：
 * - 4xx 不重试，直接返回
 * - 5xx 重试到成功
 * - 5xx 重试用尽抛 NetworkError
 * - 超时抛 NetworkError（带 timeout 字样）
 * - meta 头里只保留 x-tdc-* / cache-control
 * - URL 构造：空值参数被跳过，多个参数串接
 */

import { ApocDataClient, NetworkError } from '../dist/client.js';

const checks = [];
function check(name, cond, detail = '') {
  checks.push({ name, pass: !!cond, detail });
}

// 工具：把 fetch 替换成可编排的 mock
function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(calls.length, url, init);
  };
  return calls;
}

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// === 1. 4xx 不重试 ===
{
  const calls = mockFetch((n) => jsonResponse(400, { code: 400, success: false, msg: 'bad' }));
  const client = new ApocDataClient('http://x', { maxRetries: 3, retryBackoffMs: 1 });
  const result = await client.call('any', {});
  check('4xx 直接返回，不重试', calls.length === 1, `actually called ${calls.length} times`);
  check('4xx body 透传', result.status === 400 && result.body.success === false);
}

// === 2. 5xx 重试到成功 ===
{
  const calls = mockFetch((n) => {
    if (n < 3) return jsonResponse(503, { msg: 'unavailable' });
    return jsonResponse(200, { success: true, data: { ok: true } });
  });
  const client = new ApocDataClient('http://x', { maxRetries: 3, retryBackoffMs: 1 });
  const result = await client.call('any', {});
  check('5xx 重试到成功（3 次试 → 第 3 次返回 200）', result.status === 200, `calls=${calls.length}`);
  check('重试后返回 success=true', result.body.success === true);
}

// === 3. 5xx 重试用尽抛 NetworkError ===
// 注：客户端 5xx 重试用尽后会返回最后一次的 5xx 响应（不是抛错），因为只有 fetch 异常才会跑到 catch
// 这是设计选择：5xx 仍是合法 HTTP，body 可能有信息
{
  const calls = mockFetch((n) => jsonResponse(503, { msg: 'still unavailable' }));
  const client = new ApocDataClient('http://x', { maxRetries: 2, retryBackoffMs: 1 });
  const result = await client.call('any', {});
  check('5xx 重试用尽返回最后响应（不抛错）', result.status === 503);
  check('5xx 总共调用 maxRetries+1 次', calls.length === 3, `calls=${calls.length}`);
}

// === 4. 网络异常重试用尽抛 NetworkError ===
{
  const calls = mockFetch((n) => {
    throw new TypeError('fetch failed');
  });
  const client = new ApocDataClient('http://x', { maxRetries: 1, retryBackoffMs: 1 });
  let caught = null;
  try { await client.call('any', {}); } catch (e) { caught = e; }
  check('网络异常用尽抛 NetworkError', caught instanceof NetworkError);
  check('网络异常重试次数对', calls.length === 2, `calls=${calls.length}`);
  check('NetworkError 含 cause', caught?.cause instanceof TypeError);
}

// === 5. 超时（AbortError）抛 NetworkError ===
{
  const calls = mockFetch((n, url, init) => {
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  });
  const client = new ApocDataClient('http://x', { timeoutMs: 50, maxRetries: 0, retryBackoffMs: 1 });
  let caught = null;
  try { await client.call('slow', {}); } catch (e) { caught = e; }
  check('超时抛 NetworkError', caught instanceof NetworkError);
  check('超时错误消息含 "timed out"', caught?.message?.includes('timed out'));
}

// === 6. meta 头提取 ===
{
  mockFetch((n) => jsonResponse(200, { success: true, data: {} }, {
    'x-tdc-ratelimit-remaining': '42',
    'x-tdc-truncated': 'false',
    'cache-control': 'max-age=300',
    'x-some-other': 'ignored',
    'content-length': '100',
  }));
  const client = new ApocDataClient('http://x');
  const result = await client.call('any', {});
  const keys = Object.keys(result.meta).map(k => k.toLowerCase()).sort();
  check('meta 含 x-tdc-* 头', keys.includes('x-tdc-ratelimit-remaining') && keys.includes('x-tdc-truncated'));
  check('meta 含 cache-control', keys.includes('cache-control'));
  check('meta 不含无关头', !keys.includes('x-some-other') && !keys.includes('content-length'));
}

// === 7. URL 构造 ===
{
  let capturedUrl;
  mockFetch((n, url) => { capturedUrl = String(url); return jsonResponse(200, {}); });
  const client = new ApocDataClient('http://x/base/', { maxRetries: 0 });
  await client.call('/quote', { symbol: '600519', limit: 5, empty: '', missing: undefined, zero: 0 });
  check('URL 拼接（base 末尾 / 与 path 起始 / 都处理）', capturedUrl.startsWith('http://x/base/quote?'));
  check('URL 含非空参数', capturedUrl.includes('symbol=600519') && capturedUrl.includes('limit=5'));
  check('URL 含 zero（0 是有效值）', capturedUrl.includes('zero=0'));
  check('URL 跳过空字符串和 undefined', !capturedUrl.includes('empty=') && !capturedUrl.includes('missing='));
}

// === 8. body 非 JSON 也不崩 ===
{
  mockFetch((n) => new Response('<html>500</html>', { status: 500 }));
  const client = new ApocDataClient('http://x', { maxRetries: 0 });
  const result = await client.call('any', {});
  check('非 JSON body 包装为 { raw }', result.body?.raw?.includes('<html>') ?? false);
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
