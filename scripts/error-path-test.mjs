#!/usr/bin/env node
/**
 * 错误路径测试：构造非法参数，验证业务错误的响应契约。
 *
 * 契约：
 * - 非法参数和资源不存在返回 HTTP 400 + R.success=false
 * - R.msg 给出可读错误说明
 * - X-Tdc-Error-Code 提供机器可读错误码
 */

const BASE = process.env.APOCDATA_BASE_URL
  ?? 'https://www.apocdata.com/api/blade-dataplatform/open/data';

const CASES = [
  // 线上已部署的错误校验
  { kind: 'PROD', path: 'holders',       params: { symbol: '999999' },                                desc: 'holders 不存在 symbol' },
  { kind: 'PROD', path: 'st',            params: { symbol: '999999' },                                desc: 'st 不存在 symbol' },
  { kind: 'PROD', path: 'moneyflow',     params: { symbol: '999999' },                                desc: 'moneyflow 不存在 symbol' },
  { kind: 'PROD', path: 'announcements', params: { symbol: '999999' },                                desc: 'announcements 不存在 symbol' },
  { kind: 'PROD', path: 'express',       params: { symbol: '999999' },                                desc: 'express 不存在 symbol' },
  { kind: 'PROD', path: 'daily',         params: { symbol: '600519', start: '20260101', end: 'bad' }, desc: 'daily end 日期格式错' },
  { kind: 'PROD', path: 'daily',         params: { symbol: '600519', start: '20260101' },             desc: 'daily start/end 必须成对' },
  { kind: 'PROD', path: 'calendar',      params: { start: 'bad', end: '20260101' },                   desc: 'calendar 起始日格式错' },
  { kind: 'PROD', path: 'calendar',      params: { start: '20250101', end: '20260601' },              desc: 'calendar 跨度超 366 天' },
  { kind: 'PROD', path: 'limit-list',    params: { kind: 'X' },                                       desc: 'limit-list kind 必须 U/D/Z' },

  { kind: 'PROD', path: 'ranking',          params: { direction: 'foo' },        desc: 'ranking direction 必须 gain/loss' },
  { kind: 'PROD', path: 'macro',            params: { type: 'XYZ' },             desc: 'macro type 必须 GDP/CPI/PPI/PMI' },
  { kind: 'PROD', path: 'macro/latest',     params: { type: 'XYZ' },             desc: 'macro/latest type 限制' },
  { kind: 'PROD', path: 'macro/definition', params: { type: 'XYZ' },             desc: 'macro/definition type 限制' },
  { kind: 'PROD', path: 'sector-flow',      params: { type: 'foo' },             desc: 'sector-flow type 必须 industry/concept/region' },
  { kind: 'PROD', path: 'hot-rank',         params: { type: '欧股市场' },         desc: 'hot-rank type 仅支持 A股市场' },
  { kind: 'PROD', path: 'margin',           params: { exchange: 'NYSE' },        desc: 'margin exchange 必须 SSE/SZSE/BSE' },
];

function buildUrl(path, params) {
  const url = new URL(`${BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.append(k, String(v));
  }
  return url.toString();
}

const results = [];

for (const c of CASES) {
  const url = buildUrl(c.path, c.params);
  const line = { ...c };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'apocdata-error-test/0.1', Accept: 'application/json' },
    });
    line.http = res.status;
    line.errHeader = res.headers.get('x-tdc-error-code') ?? '';
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (body && typeof body === 'object') {
      line.success = body.success;
      line.code = body.code;
      line.msg = String(body.msg ?? '').slice(0, 60);
    } else {
      line.msg = String(text).slice(0, 60);
    }
  } catch (err) {
    line.http = 'ERR';
    line.msg = err.message;
  }
  line.pass = line.http === 400 && line.success === false && line.errHeader.length > 0;
  results.push(line);
}

const headers = ['kind', 'path', 'desc', 'http', 'success', 'code', 'errHdr', 'msg', 'verdict'];
const colWidth = {
  kind:    4,
  path:    Math.max(...results.map(r => r.path.length), 4),
  desc:    Math.max(...results.map(r => r.desc.length), 4),
  http:    4,
  success: 7,
  code:    6,
  errHdr:  10,
  msg:     45,
  verdict: 7,
};
const pad = (s, w) => String(s ?? '').slice(0, w).padEnd(w);
console.log(headers.map(h => pad(h, colWidth[h])).join(' │ '));
console.log(headers.map(h => '─'.repeat(colWidth[h])).join('─┼─'));
for (const r of results) {
  const verdict = r.pass ? '✓ pass' : '✗ FAIL';
  console.log(headers.map(h => pad(h === 'verdict' ? verdict : h === 'errHdr' ? r.errHeader : r[h], colWidth[h])).join(' │ '));
}

const prod = results.filter(r => r.kind === 'PROD');
const prodPass = prod.filter(r => r.pass).length;
console.log('');
console.log(`PROD: ${prodPass}/${prod.length} pass`);
process.exit(prodPass === prod.length ? 0 : 1);
