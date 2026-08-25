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

import axios, { AxiosError, AxiosInstance } from "axios";
import type { TdcResponse, BladeResponse } from "./types.js";
import { translateError } from "./errors.js";

const VERSION = "0.1.0";

/**
 * 创建带嵌入式 API Key 的 axios 实例。
 * 从 process.env.TQ_API_KEY 读 Key;无 Key 直接 throw(MCP 启动失败,Agent 用户能看到)。
 * 从 process.env.TQ_API_BASE 读 gateway 地址(默认 http://localhost:9001)。
 */
export function createTransport(): AxiosInstance {
  const apiKey = process.env.TQ_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 TQ_API_KEY 环境变量,请在 Claude Desktop 的 mcpServers 配置中设置");
  }
  const baseURL = process.env.TQ_API_BASE ?? "http://localhost:9001";

  return axios.create({
    baseURL,
    headers: {
      "X-API-Key": apiKey,
      "User-Agent": `tianqi-mcp/${VERSION}`,
    },
    timeout: 30_000,
    validateStatus: () => true,
  });
}

/**
 * 调用 /v1/** 数据面端点,自动解 TdcResponse 信封 + 错误翻译。
 */
export async function callDataPlane<T>(
  client: AxiosInstance,
  path: string,
  params?: Record<string, unknown>
): Promise<{ data?: T; meta?: TdcResponse<T>["meta"]; pagination?: TdcResponse<T>["pagination"]; error?: { code: string; message: string } }> {
  try {
    const res = await client.get<TdcResponse<T>>(path, { params });
    if (res.status >= 200 && res.status < 300) {
      const body = res.data;
      if (body.error) {
        return { error: translateError({ backendCode: body.error.code, backendMessage: body.error.message }) };
      }
      return { data: body.data, meta: body.meta, pagination: body.pagination };
    }
    const body = res.data;
    return {
      error: translateError({
        httpStatus: res.status,
        backendCode: body?.error?.code,
        backendMessage: body?.error?.message,
      }),
    };
  } catch (e) {
    const ae = e as AxiosError;
    return {
      error: translateError({
        httpStatus: ae.response?.status,
        cause: e,
        backendMessage: ae.message,
      }),
    };
  }
}

/**
 * 调用 /portal/**, /admin/** 等走 R<T> 信封的端点(本期不用,留接口给 P5-Agent-4)。
 */
export async function callBladeR<T>(
  client: AxiosInstance,
  path: string,
  params?: Record<string, unknown>
): Promise<{ data?: T; error?: { code: string; message: string } }> {
  const res = await client.get<BladeResponse<T>>(path, { params });
  if (res.status >= 200 && res.status < 300 && res.data.success) {
    return { data: res.data.data };
  }
  return {
    error: translateError({
      httpStatus: res.status,
      backendMessage: res.data?.msg,
    }),
  };
}
