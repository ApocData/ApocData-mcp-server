#!/usr/bin/env node
/**
 * 错误路径测试：构造非法参数，验证业务错误的响应契约。
 *
 * 契约：
 * - 业务错误用 HTTP 200 + R.success=false 表达（不走 4xx）
 * - R.msg 给出可读错误说明
 * - 计划中 R.code 应该是字符串错误码（INVALID_PARAM_VALUE 等），但当前线上为 HTTP 数值
 *   —— 这是路线图 §5.1 的待发版功能
 *
 * 用例分两类：
 * - PROD: 线上已部署的校验（RESOURCE_NOT_FOUND、日期格式、跨度上限）
 * - LAG: 源码已实现但线上未部署的校验（多接口非法 enum 当前会被静默接受）
 *        LAG 用例只输出"观察到的行为"，不参与 pass/fail 判定
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

  // 源码已写但线上未发版（§2.1）
  { kind: 'LAG', path: 'ranking',          params: { direction: 'foo' },        desc: 'ranking direction 必须 gain/loss' },
  { kind: 'LAG', path: 'macro',            params: { type: 'XYZ' },             desc: 'macro type 必须 GDP/CPI/PPI/PMI' },
  { kind: 'LAG', path: 'macro/latest',     params: { type: 'XYZ' },             desc: 'macro/latest type 限制' },
  { kind: 'LAG', path: 'macro/definition', params: { type: 'XYZ' },             desc: 'macro/definition type 限制' },
  { kind: 'LAG', path: 'sector-flow',      params: { type: 'foo' },             desc: 'sector-flow type 必须 industry/concept/region' },
  { kind: 'LAG', path: 'hot-rank',         params: { type: '欧股市场' },         desc: 'hot-rank type 限制 4 选 1' },
  { kind: 'LAG', path: 'margin',           params: { exchange: 'NYSE' },        desc: 'margin exchange 必须 SSE/SZSE/BSE' },
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
  // 判定：PROD 必须 success=false；LAG 只观察
  line.pass = line.kind === 'LAG' ? null : line.success === false;
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
  const verdict = r.pass === null ? '— LAG' : (r.pass ? '✓ pass' : '✗ FAIL');
  console.log(headers.map(h => pad(h === 'verdict' ? verdict : h === 'errHdr' ? r.errHeader : r[h], colWidth[h])).join(' │ '));
}

const prod = results.filter(r => r.kind === 'PROD');
const prodPass = prod.filter(r => r.pass).length;
const lag = results.filter(r => r.kind === 'LAG');
const lagBehavior = lag.filter(r => r.success === false).length;

console.log('');
console.log(`PROD: ${prodPass}/${prod.length} pass`);
console.log(`LAG : ${lagBehavior}/${lag.length} 当前线上已校验（其余仍待发版）`);
process.exit(prodPass === prod.length ? 0 : 1);
