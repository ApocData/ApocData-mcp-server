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
 * 后端 R<T> 信封(blade 标准)。
 */
export interface BladeResponse<T = unknown> {
  code: number;
  success: boolean;
  msg?: string;
  data: T;
}

/**
 * 后端 TdcResponse 信封(数据面 /v1/** 用)。
 */
export interface TdcResponse<T = unknown> {
  data: T;
  meta?: {
    source?: string;
    ingestLagSeconds?: number;
    [key: string]: unknown;
  };
  pagination?: {
    nextCursor?: string;
    hasMore?: boolean;
    total?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * MCP tool 调用返回(LLM-friendly)。
 */
export interface ToolResult {
  error?: boolean;
  message?: string;
  code?: string;
  data?: unknown;
  meta?: Record<string, unknown>;
}
