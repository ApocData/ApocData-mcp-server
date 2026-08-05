#!/usr/bin/env node
/**
 * 覆盖测试：
 * 1. 截断：传 limit=超上限，验证响应头 X-Tdc-Limit-Truncated=true
 * 2. 限流：连续调 N 次，看 X-RateLimit-Remaining 是否递减
 * 3. 枚举遍历：把每个有 enum 的工具所有合法值都跑一遍
 *
 * 限流和截断是 advice 行为，若线上 advice 未部署会被标 LAG。
 */

const BASE = process.env.APOCDATA_BASE_URL
  ?? 'https://data.tianqis.com/api/blade-dataplatform/open/data';

const checks = [];
function check(kind, name, cond, detail = '') {
  checks.push({ kind, name, pass: !!cond, detail });
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.append(k, String(v));
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'apocdata-coverage-test/0.1', Accept: 'application/json' },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  const headers = {};
  for (const [k, v] of res.headers) headers[k.toLowerCase()] = v;
  return { status: res.status, body, headers };
}

// ===== 1. 截断 =====
// daily 上限 30，传 999 应触发截断
{
  const r = await fetchJson('daily', { symbol: '600519', limit: 999 });
  const truncated = r.headers['x-tdc-limit-truncated'];
  check(truncated ? 'PROD' : 'LAG', 'daily limit=999 触发 X-Tdc-Limit-Truncated 头',
    truncated === 'true', `header=${truncated ?? '(missing)'}`);
  const dataLen = Array.isArray(r.body?.data) ? r.body.data.length : 0;
  check('PROD', 'daily limit=999 实际返回 ≤ 30 条', dataLen <= 30, `dataLen=${dataLen}`);
}

// holders 不带 limit 也会被截断（@RequestParam 默认值），换个 ranking 验
{
  const r = await fetchJson('ranking', { direction: 'gain', limit: 999 });
  const truncated = r.headers['x-tdc-limit-truncated'];
  check(truncated ? 'PROD' : 'LAG', 'ranking limit=999 触发截断',
    truncated === 'true', `header=${truncated ?? '(missing)'}`);
  const dataLen = Array.isArray(r.body?.data) ? r.body.data.length : 0;
  check('PROD', 'ranking limit=999 实际返回 ≤ 50 条', dataLen <= 50, `dataLen=${dataLen}`);
}

// ===== 2. 限流 =====
// 连续打 5 次 quote，看 remaining 是否递减
{
  const remainings = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetchJson('quote', { symbol: '600519' });
    const rem = r.headers['x-ratelimit-remaining'];
    if (rem !== undefined) remainings.push(parseInt(rem, 10));
  }
  if (remainings.length === 0) {
    check('LAG', '限流头 X-RateLimit-Remaining 存在', false, 'no header in any of 5 responses');
  } else {
    check('PROD', '限流头存在且为数值', remainings.every(n => Number.isFinite(n)), `samples=${remainings.join(',')}`);
    const monotone = remainings.every((n, i) => i === 0 || n <= remainings[i - 1]);
    check('PROD', '限流剩余值随调用递减', monotone, `samples=${remainings.join(',')}`);
  }
}

// ===== 3. 枚举遍历 =====
const ENUM_CASES = [
  // ranking direction
  { path: 'ranking', params: { direction: 'gain', limit: 1 }, label: 'ranking direction=gain' },
  { path: 'ranking', params: { direction: 'loss', limit: 1 }, label: 'ranking direction=loss' },
  // limit-list kind
  { path: 'limit-list', params: { kind: 'U', limit: 1 }, label: 'limit-list kind=U' },
  { path: 'limit-list', params: { kind: 'D', limit: 1 }, label: 'limit-list kind=D' },
  { path: 'limit-list', params: { kind: 'Z', limit: 1 }, label: 'limit-list kind=Z' },
  // sector-flow type
  { path: 'sector-flow', params: { type: 'industry', limit: 1 }, label: 'sector-flow type=industry' },
  { path: 'sector-flow', params: { type: 'concept', limit: 1 }, label: 'sector-flow type=concept' },
  { path: 'sector-flow', params: { type: 'region', limit: 1 }, label: 'sector-flow type=region' },
  // hot-rank type
  { path: 'hot-rank', params: { type: 'A股市场', limit: 1 }, label: 'hot-rank type=A股市场' },
  { path: 'hot-rank', params: { type: 'ETF基金', limit: 1 }, label: 'hot-rank type=ETF基金' },
  { path: 'hot-rank', params: { type: '港股市场', limit: 1 }, label: 'hot-rank type=港股市场' },
  { path: 'hot-rank', params: { type: '美股市场', limit: 1 }, label: 'hot-rank type=美股市场' },
  // margin exchange
  { path: 'margin', params: { exchange: 'SSE', limit: 1 }, label: 'margin exchange=SSE' },
  { path: 'margin', params: { exchange: 'SZSE', limit: 1 }, label: 'margin exchange=SZSE' },
  { path: 'margin', params: { exchange: 'BSE', limit: 1 }, label: 'margin exchange=BSE' },
  // macro type
  { path: 'macro', params: { type: 'GDP', limit: 1 }, label: 'macro type=GDP' },
  { path: 'macro', params: { type: 'CPI', limit: 1 }, label: 'macro type=CPI' },
  { path: 'macro', params: { type: 'PPI', limit: 1 }, label: 'macro type=PPI' },
  { path: 'macro', params: { type: 'PMI', limit: 1 }, label: 'macro type=PMI' },
];

for (const c of ENUM_CASES) {
  const r = await fetchJson(c.path, c.params);
  check('PROD', `${c.label} → success=true`,
    r.status === 200 && r.body?.success === true,
    `http=${r.status} success=${r.body?.success}`);
}

// 报告
console.log('');
for (const c of checks) {
  const sym = c.kind === 'LAG' ? (c.pass ? '✓' : '— LAG') : (c.pass ? '✓' : '✗');
  console.log(`[${c.kind}] ${sym} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}

const prod = checks.filter(c => c.kind === 'PROD');
const lag = checks.filter(c => c.kind === 'LAG');
const prodPass = prod.filter(c => c.pass).length;
const lagPass = lag.filter(c => c.pass).length;

console.log('');
console.log(`PROD: ${prodPass}/${prod.length} pass`);
if (lag.length) console.log(`LAG : ${lagPass}/${lag.length} 线上已生效（其余待发版）`);
process.exit(prodPass === prod.length ? 0 : 1);
