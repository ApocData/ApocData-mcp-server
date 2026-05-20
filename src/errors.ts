/**
 * Copyright (c) 2018-2099, Chill Zhuang 庄骞 (bladejava@qq.com).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * @author Chill
 */

/**
 * 后端 TdcResponse / blade R 错误码 → LLM-friendly 中文翻译。
 * 任何未匹配的 code 返原始 message,前缀"后端错误"。
 */
export const ERROR_TRANSLATIONS: Record<string, string> = {
  AUTH_INVALID: "API Key 无效,请联系运维更新 TQ_API_KEY",
  AUTH_REVOKED: "API Key 已吞吊,请联系运维补发",
  AUTH_EXPIRED: "API Key 已过期,请联系运维续期",
  SKU_INSUFFICIENT: "当前 SKU 等级不足以调用此 tool(需要 SKU-PRO+),请联系运维升级",
  QPS_EXCEEDED: "调用频率超限,请等待数秒后重试",
  QUOTA_EXCEEDED: "今日配额已用尽,明日 00:00 重置或联系运维升级",
  NOT_FOUND: "未找到该 symbol/indicator 的数据,请检查参数(symbol 应为 6 位代码,如 '000001')",
  INVALID_PARAM: "参数错误,请检查 symbol/date/range 格式",
  UPSTREAM_TIMEOUT: "数据源响应超时,建议重试或缩小查询范围",
  UPSTREAM_ERROR: "数据源临时不可用,稍后重试",
};

/**
 * HTTP 状态码 → 错误码兜底映射。
 */
export const HTTP_STATUS_FALLBACK: Record<number, string> = {
  401: "AUTH_INVALID",
  403: "SKU_INSUFFICIENT",
  404: "NOT_FOUND",
  429: "QPS_EXCEEDED",
  500: "UPSTREAM_ERROR",
  502: "UPSTREAM_ERROR",
  503: "UPSTREAM_ERROR",
  504: "UPSTREAM_TIMEOUT",
};

/**
 * 翻译后端错误为 LLM-friendly ToolResult 错误。
 */
export function translateError(opts: {
  httpStatus?: number;
  backendCode?: string;
  backendMessage?: string;
  cause?: unknown;
}): { error: true; code: string; message: string } {
  const code = opts.backendCode ?? (opts.httpStatus ? HTTP_STATUS_FALLBACK[opts.httpStatus] : null) ?? "UNKNOWN";
  const friendly = ERROR_TRANSLATIONS[code];
  if (friendly) return { error: true, code, message: friendly };
  if (opts.backendMessage) return { error: true, code, message: `后端错误: ${opts.backendMessage}` };
  return { error: true, code, message: `未知错误(HTTP ${opts.httpStatus ?? "?"})` };
}
