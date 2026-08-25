#!/usr/bin/env node
/**
 * 数据新鲜度/正确性探查：对 ALL_TOOLS 每个工具拉真实数据，
 * 提取所有日期类字段（trade_date / ann_date / updated_at / date / ts 等），
 * 打印该接口出现过的最新日期值，用于判断数据是否"最新"。
 *
 * 参考基准（2026-08-03 周一 15:06，A股已收盘）：
 *   正常最新交易日应为 2026-08-03（今日）或 2026-07-31（若 T+1）。
 *   任何 max 日期 < 2026-07-31 视为"数据陈旧/延迟"。
 */
import { ALL_TOOLS } from '../dist/tools.js';

const BASE = process.env.APOCDATA_BASE_URL
  ?? 'https://www.apocdata.com/api/blade-dataplatform/open/data';

const TEST_INPUTS = {
  quote: { symbol: '000001' },
  quotes: { symbols: '000001,600519' },
  daily: { symbol: '600519', limit: 5 },
  stocks: { q: '茅台', limit: 3 },
  stock: { symbol: '600519' },
  st: { symbol: '600519' },
  ranking: { direction: 'gain', limit: 3 },
  indexes: { q: '沪深300', limit: 3 },
  'index-daily': { tsCode: '000300.SH', limit: 5 },
  'hot-rank': { type: 'A股市场', limit: 3 },
  financial: { symbol: '600519', limit: 2 },
  express: { symbol: '600519', limit: 3 },
  dividend: { symbol: '600519', limit: 3 },
  holders: { symbol: '600519' },
  'holder-number': { symbol: '600519', limit: 3 },
  'share-float': { symbol: '600519', limit: 3 },
  repurchase: { symbol: '600519', limit: 3 },
  'block-trade': { symbol: '600519', limit: 3 },
  moneyflow: { symbol: '600519', limit: 5 },
  hsgt: { limit: 3 },
  'hk-hold': { symbol: '600519', limit: 3 },
  'hk-daily': { tsCode: '00700.HK', limit: 5 },
  margin: { limit: 3 },
  'dragon-tiger': { limit: 3 },
  'hot-money': { limit: 3 },
  'hot-money-detail': { limit: 3 },
  'limit-list': { kind: 'U', limit: 3 },
  'limit-step': { limit: 3 },
  'sector-flow': { type: 'industry', limit: 3 },
  'cyq-perf': { symbol: '600519', limit: 3 },
  announcements: { symbol: '600519', limit: 3 },
  survey: { symbol: '600519', limit: 3 },
  concepts: { limit: 3 },
  'concept-stocks': { themeCode: 'INVALID', limit: 3 },
  'ths-boards': { limit: 3 },
  'ths-board-stocks': { tsCode: 'INVALID', limit: 3 },
  'convertible-bonds': { limit: 3 },
  'cb-price-chg': { tsCode: '127026.SZ', limit: 3 },
  factors: {},
  'tech-factor': { symbol: '600519', limit: 3 },
  macro: { type: 'CPI', limit: 3 },
  'macro-latest': { type: 'CPI' },
  'macro-definition': { type: 'CPI' },
  calendar: { start: '20260801', end: '20260803' },
  'profile-full': { symbol: '600519' },
  'factor-categories': {},
};

const DATE_KEY_RE = /date|time|updated|_at$|^ts$|datetime|年月/i;
const DATE_VAL_RE = /^\d{8}$|^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$|^\d{4}\/\d{2}\/\d{2}/;

function buildUrl(tool, params) {
  const url = new URL(`${BASE.replace(/\/+$/, '')}/${tool.path.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.append(k, String(v));
  }
  return url.toString();
}

// 归一化日期到 YYYYMMDD 用于比较
function normDate(v) {
  if (typeof v !== 'string') return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  return null;
}

function walk(value, out) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) { value.slice(0, 8).forEach(r => walk(r, out)); return; }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (DATE_KEY_RE.test(k) && DATE_VAL_RE.test(String(v))) {
        const nd = normDate(String(v));
        if (nd) out.push({ key: k, raw: String(v), norm: nd });
      } else if (typeof v === 'object') {
        walk(v, out);
      }
    }
  }
}

const results = [];
for (const tool of ALL_TOOLS) {
  const input = TEST_INPUTS[tool.name];
  if (input === undefined) { results.push({ tool: tool.name, note: 'skip(no input)' }); continue; }
  const url = buildUrl(tool, input);
  const line = { tool: tool.name };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'apocdata-freshness/0.1', Accept: 'application/json' } });
    line.http = res.status;
    const body = await res.json().catch(() => null);
    if (!body || body.success === false) { line.note = 'API fail: ' + (body?.msg || res.status); results.push(line); continue; }
    const dates = [];
    walk(body.data, dates);
    if (dates.length === 0) {
      line.dates = '（无日期字段）';
      line.max = '-';
    } else {
      const uniq = [...new Set(dates.map(d => `${d.key}=${d.raw}`))];
      line.dates = uniq.slice(0, 6).join('  ');
      line.max = dates.reduce((a, b) => (b.norm > a.norm ? b : a)).norm;
    }
  } catch (e) {
    line.note = 'ERR ' + e.message;
  }
  results.push(line);
}

const CUTOFF = '20260731';
console.log('tool'.padEnd(18), '│ http │ max日期   │ 日期字段(样例)');
console.log('─'.repeat(18), '┼──────┼───────────┼────────────────────────────────────────');
let stale = 0, ok = 0;
for (const r of results) {
  if (r.max && r.max !== '-') {
    const flag = r.max < CUTOFF ? '  ⚠陈旧' : '  ✓';
    if (r.max < CUTOFF) stale++; else ok++;
    console.log(r.tool.padEnd(18), '│', String(r.http ?? '').padEnd(4), '│', r.max, '│', (r.dates || '').slice(0, 50), flag);
  } else {
    console.log(r.tool.padEnd(18), '│', String(r.http ?? '').padEnd(4), '│', (r.max || '-'), '│', (r.dates || r.note || '').slice(0, 50));
  }
}
console.log('');
console.log(`时间敏感接口：✓最新(≥7/31) ${ok} 个 │ ⚠陈旧(<7/31) ${stale} 个`);
console.log(`基准：2026-08-03 周一收盘，正常应到 2026-08-03 或 2026-07-31`);
