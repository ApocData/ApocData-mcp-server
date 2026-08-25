#!/usr/bin/env node
/**
 * 契约测试：对全部公开工具逐个发真实 HTTP 调用。
 * 输出表格：tool / HTTP status / API success / data 形状 / 备注
 *
 * 用法：
 *   node scripts/contract-test.mjs
 *   APOCDATA_BASE_URL=http://localhost:8200/blade-dataplatform/open/data node scripts/contract-test.mjs
 */

import { ALL_TOOLS } from '../dist/tools.js';

const BASE = process.env.APOCDATA_BASE_URL
  ?? 'https://www.apocdata.com/api/blade-dataplatform/open/data';

// 每个 tool 的测试入参。stable A 股：000001 平安银行 / 600519 茅台
const TEST_INPUTS = {
  quote: { symbol: '000001' },
  quotes: { symbols: '000001,600519' },
  daily: { symbol: '600519', limit: 3 },
  stocks: { q: '茅台', limit: 3 },
  stock: { symbol: '600519' },
  st: { symbol: '600519' },
  ranking: { direction: 'gain', limit: 3 },
  indexes: { q: '沪深300', limit: 3 },
  'index-daily': { tsCode: '000300.SH', limit: 3 },
  'hot-rank': { type: 'A股市场', limit: 3 },

  financial: { symbol: '600519', limit: 1 },
  express: { symbol: '600519', limit: 1 },
  dividend: { symbol: '600519', limit: 3 },
  holders: { symbol: '600519' },
  'holder-number': { symbol: '600519', limit: 3 },
  'share-float': { symbol: '600519', limit: 3 },
  repurchase: { symbol: '600519', limit: 3 },
  'block-trade': { symbol: '600519', limit: 3 },

  moneyflow: { symbol: '600519', limit: 3 },
  hsgt: { limit: 3 },
  'hk-hold': { symbol: '600519', limit: 3 },
  'hk-daily': { tsCode: '00700.HK', limit: 3 },
  margin: { limit: 3 },
  'dragon-tiger': { limit: 3 },
  'hot-money': { limit: 3 },
  'hot-money-detail': { limit: 3 },

  'limit-list': { kind: 'U', limit: 3 },
  'limit-step': { limit: 3 },
  'sector-flow': { type: 'industry', limit: 3 },
  'cyq-perf': { symbol: '600519', limit: 3 },

  announcements: { symbol: '600519', limit: 1, fields: 'title,ann_date' },
  survey: { symbol: '600519', limit: 3 },

  concepts: { limit: 3 },
  'concept-stocks': { themeCode: 'INVALID', limit: 3 },
  'ths-boards': { limit: 3 },
  'ths-board-stocks': { tsCode: 'INVALID', limit: 3 },

  'convertible-bonds': { limit: 3 },
  'cb-price-chg': { tsCode: '127026.SZ', limit: 3 },

  factors: {},
  'tech-factor': { symbol: '600519', limit: 1 },

  macro: { type: 'CPI', limit: 3 },
  'macro-latest': { type: 'CPI' },
  'macro-definition': { type: 'CPI' },

  calendar: { start: '20260101', end: '20260131' },

  'profile-full': { symbol: '600519' },
  'factor-categories': {},
};

function buildUrl(tool, params) {
  const url = new URL(`${BASE.replace(/\/+$/, '')}/${tool.path.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.append(k, String(v));
  }
  return url.toString();
}

function shape(data) {
  if (data === null || data === undefined) return 'null';
  if (Array.isArray(data)) return `array[${data.length}]`;
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return 'object{}';
    if ('columns' in data && 'rows' in data) {
      return `compact[cols=${data.columns?.length},rows=${data.rows?.length}]`;
    }
    return `object{${keys.length} keys}`;
  }
  return typeof data;
}

const results = [];

for (const tool of ALL_TOOLS) {
  const input = TEST_INPUTS[tool.name];
  if (input === undefined) {
    results.push({ tool: tool.name, status: 'SKIP', note: 'no test input defined' });
    continue;
  }
  const url = buildUrl(tool, input);
  let line = { tool: tool.name, path: tool.path };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'apocdata-contract-test/0.1', Accept: 'application/json' },
    });
    line.http = res.status;
    const errCode = res.headers.get('x-tdc-error-code');
    if (errCode) line.errCode = errCode;
    const truncated = res.headers.get('x-tdc-limit-truncated');
    if (truncated === 'true') line.truncated = true;

    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (body && typeof body === 'object') {
      line.apiSuccess = body.success;
      line.dataShape = shape(body.data);
      if (body.success === false) line.msg = body.msg;
      else if (body.msg && body.msg !== '操作成功') line.msg = body.msg;
    } else {
      line.dataShape = 'non-json';
      line.msg = text.slice(0, 80);
    }
  } catch (err) {
    line.http = 'ERR';
    line.msg = err.message;
  }
  results.push(line);
}

// 输出表格
const headers = ['tool', 'http', 'apiSuccess', 'errCode', 'dataShape', 'truncated', 'msg'];
const colWidth = {
  tool: Math.max(...results.map(r => r.tool.length), 4),
  http: 5,
  apiSuccess: 11,
  errCode: 24,
  dataShape: 22,
  truncated: 5,
  msg: 50,
};
const pad = (s, w) => String(s ?? '').slice(0, w).padEnd(w);
console.log(headers.map(h => pad(h, colWidth[h])).join(' │ '));
console.log(headers.map(h => '─'.repeat(colWidth[h])).join('─┼─'));

const counts = { ok: 0, apiFail: 0, http4xx: 0, http5xx: 0, err: 0 };
for (const r of results) {
  console.log(headers.map(h => pad(r[h], colWidth[h])).join(' │ '));
  if (r.http === 'ERR') counts.err++;
  else if (typeof r.http === 'number' && r.http >= 500) counts.http5xx++;
  else if (typeof r.http === 'number' && r.http >= 400) counts.http4xx++;
  else if (r.apiSuccess === false) counts.apiFail++;
  else counts.ok++;
}

console.log('');
console.log(`Total ${results.length} tools  │  ✓ ok ${counts.ok}  │  ⚠ apiFail ${counts.apiFail}  │  http4xx ${counts.http4xx}  │  http5xx ${counts.http5xx}  │  err ${counts.err}`);

const skipped = results.filter((r) => r.status === 'SKIP').length;
process.exit(counts.http4xx + counts.http5xx + counts.apiFail + counts.err + skipped > 0 ? 1 : 0);
