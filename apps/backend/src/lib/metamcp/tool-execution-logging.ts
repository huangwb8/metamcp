import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { MetaMCPHandlerContext } from "./metamcp-middleware/functional-middleware";

import { metamcpLogStore } from "./log-store";
import {
  getElapsedDurationMs,
  summarizeToolArguments,
  summarizeToolResult,
} from "./observability";

type RequestSource = "metamcp" | "openapi";

interface ToolExecutionLogTarget {
  context: MetaMCPHandlerContext;
  requestSource: RequestSource;
  serverName: string;
  serverUuid: string;
  toolName?: string;
}

const buildDetails = (
  requestSource: RequestSource,
  extra: Record<string, string | number | boolean | string[]> = {},
) => ({
  requestSource,
  ...extra,
});

export const logToolsListStarted = ({
  context,
  requestSource,
  serverName,
  serverUuid,
}: ToolExecutionLogTarget): void => {
  metamcpLogStore.addLog(
    serverName,
    "info",
    "Listing tools from MCP server",
    undefined,
    {
      category: "tool",
      event: "tools_list",
      status: "started",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      serverUuid,
      details: buildDetails(requestSource),
    },
  );
};

export const logToolsListCompleted = (
  { context, requestSource, serverName, serverUuid }: ToolExecutionLogTarget,
  toolCount: number,
  startedAt: number,
): void => {
  metamcpLogStore.addLog(
    serverName,
    "info",
    `Listed ${toolCount} tools from MCP server`,
    undefined,
    {
      category: "tool",
      event: "tools_list",
      status: "success",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      serverUuid,
      durationMs: getElapsedDurationMs(startedAt),
      details: buildDetails(requestSource, {
        toolCount,
      }),
    },
  );
};

export const logToolsListFailed = (
  { context, requestSource, serverName, serverUuid }: ToolExecutionLogTarget,
  startedAt: number,
  error: unknown,
): void => {
  metamcpLogStore.addLog(
    serverName,
    "error",
    "Failed to list tools from MCP server",
    error,
    {
      category: "tool",
      event: "tools_list",
      status: "error",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      serverUuid,
      durationMs: getElapsedDurationMs(startedAt),
      details: buildDetails(requestSource),
    },
  );
};

export const logToolCallStarted = (
  {
    context,
    requestSource,
    serverName,
    serverUuid,
    toolName,
  }: ToolExecutionLogTarget,
  args: unknown,
): void => {
  metamcpLogStore.addLog(
    serverName,
    "info",
    `Calling MCP tool "${toolName}"`,
    undefined,
    {
      category: "tool",
      event: "tool_call",
      status: "started",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      serverUuid,
      toolName,
      details: buildDetails(requestSource, summarizeToolArguments(args)),
    },
  );
};

export const logToolCallCompleted = (
  {
    context,
    requestSource,
    serverName,
    serverUuid,
    toolName,
  }: ToolExecutionLogTarget,
  args: unknown,
  result: CallToolResult,
  startedAt: number,
): void => {
  const level = result.isError ? "error" : "info";
  const message = result.isError
    ? `MCP tool "${toolName}" reported an error`
    : `MCP tool "${toolName}" completed`;

  metamcpLogStore.addLog(serverName, level, message, undefined, {
    category: "tool",
    event: "tool_call",
    status: result.isError ? "error" : "success",
    namespaceUuid: context.namespaceUuid,
    sessionId: context.sessionId,
    serverUuid,
    toolName,
    durationMs: getElapsedDurationMs(startedAt),
    details: buildDetails(requestSource, {
      ...summarizeToolArguments(args),
      ...summarizeToolResult(result),
    }),
  });
};

export const logToolCallFailed = (
  {
    context,
    requestSource,
    serverName,
    serverUuid,
    toolName,
  }: ToolExecutionLogTarget,
  startedAt: number,
  error: unknown,
): void => {
  metamcpLogStore.addLog(
    serverName,
    "error",
    `MCP tool "${toolName}" failed`,
    error,
    {
      category: "tool",
      event: "tool_call",
      status: "error",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      serverUuid,
      toolName,
      durationMs: getElapsedDurationMs(startedAt),
      details: buildDetails(requestSource),
    },
  );
};

export const logUnknownToolCall = (
  {
    context,
    requestSource,
    serverName,
    toolName,
  }: Omit<ToolExecutionLogTarget, "serverUuid"> & { serverUuid?: string },
  args: unknown,
): void => {
  metamcpLogStore.addLog(
    serverName,
    "error",
    `Unable to resolve MCP tool "${toolName}"`,
    undefined,
    {
      category: "tool",
      event: "tool_call",
      status: "error",
      namespaceUuid: context.namespaceUuid,
      sessionId: context.sessionId,
      toolName,
      details: buildDetails(requestSource, summarizeToolArguments(args)),
    },
  );
};
