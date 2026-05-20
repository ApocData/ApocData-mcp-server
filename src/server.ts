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

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createTransport } from "./transport.js";
import { ATOMIC_TOOLS } from "./tools/index.js";
import type { ToolDef } from "./tools/types.js";

const VERSION = "0.1.0";

/**
 * 构造 MCP server 实例,注册所有 tool。
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "tianqi-mcp",
      version: VERSION,
    },
    {
      capabilities: { tools: {} },
    }
  );

  // axios 实例在 server 构造时一次创建,所有 tool 共享
  const client = createTransport();

  // tool 名 → ToolDef 索引
  const toolMap = new Map<string, ToolDef>(ATOMIC_TOOLS.map((t) => [t.name, t]));

  // 列 tool
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ATOMIC_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // 调 tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments ?? {};
    const tool = toolMap.get(toolName);
    if (!tool) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, code: "TOOL_NOT_FOUND", message: `未知 tool: ${toolName}` }) }],
        isError: true,
      };
    }
    try {
      const result = await tool.handler(args, client);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, code: "TOOL_HANDLER_ERROR", message }) }],
        isError: true,
      };
    }
  });

  return server;
}
