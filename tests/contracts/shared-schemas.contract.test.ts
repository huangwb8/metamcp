import {
  BulkImportMcpServerSchema,
  createServerFormSchema,
  MetaMcpLogEntrySchema,
  RefreshNamespaceToolsRequestSchema,
  UpdateNamespaceToolStatusRequestSchema,
} from "../../packages/zod-types/src";

describe("shared MetaMCP schema contract", () => {
  it("requires a command for STDIO servers in the create form schema", () => {
    const result = createServerFormSchema.safeParse({
      name: "local_stdio",
      type: "STDIO",
      command: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["command"],
        message: "validation:command.required",
      }),
    );
  });

  it("requires a valid URL for SSE servers in the create form schema", () => {
    const result = createServerFormSchema.safeParse({
      name: "remote_sse",
      type: "SSE",
      url: "not-a-url",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["url"],
        message: "validation:url.required",
      }),
    );
  });

  it("normalizes bulk import server type aliases before enum validation", () => {
    const parsed = BulkImportMcpServerSchema.parse({
      type: "http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
      },
    });

    expect(parsed.type).toBe("STREAMABLE_HTTP");
  });

  it("accepts namespace refresh payloads that use forwarded MetaMCP tool names", () => {
    const parsed = RefreshNamespaceToolsRequestSchema.parse({
      namespaceUuid: "7ca07488-e4dc-4031-b823-1041e369fdc5",
      tools: [
        {
          name: "GitHub__search_repositories",
          description: "Search repositories",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
              },
            },
          },
        },
      ],
    });

    expect(parsed.tools[0]?.name).toBe("GitHub__search_repositories");
    expect(parsed.tools[0]?.inputSchema).toMatchObject({
      type: "object",
    });
  });

  it("rejects invalid UUIDs when updating namespace tool status", () => {
    const result = UpdateNamespaceToolStatusRequestSchema.safeParse({
      namespaceUuid: "not-a-uuid",
      toolUuid: "tool-uuid",
      serverUuid: "server-uuid",
      status: "ACTIVE",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["namespaceUuid"] }),
        expect.objectContaining({ path: ["toolUuid"] }),
        expect.objectContaining({ path: ["serverUuid"] }),
      ]),
    );
  });

  it("accepts structured live log entries for MCP activity events", () => {
    const parsed = MetaMcpLogEntrySchema.parse({
      id: "log-1",
      timestamp: new Date("2026-03-21T10:00:00.000Z"),
      serverName: "GitHub",
      level: "info",
      message: 'Tool "search_repositories" completed',
      category: "tool",
      event: "tool_call",
      status: "success",
      namespaceUuid: "7ca07488-e4dc-4031-b823-1041e369fdc5",
      sessionId: "session-123",
      serverUuid: "server-123",
      toolName: "search_repositories",
      durationMs: 128,
      details: {
        argumentCount: 1,
        argumentKeys: ["query"],
        argumentPreview: '{"query":"metamcp"}',
      },
    });

    expect(parsed.category).toBe("tool");
    expect(parsed.durationMs).toBe(128);
    expect(parsed.details?.argumentKeys).toEqual(["query"]);
  });
});
