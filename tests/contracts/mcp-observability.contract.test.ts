import { MetaMcpLogEntrySchema } from "../../packages/zod-types/src";
import {
  summarizeToolArguments,
  summarizeToolResult,
} from "../../apps/backend/src/lib/metamcp/observability";

describe("mcp observability contract", () => {
  it("summarizes tool arguments without leaking sensitive fields", () => {
    const summary = summarizeToolArguments({
      query: "latest release notes",
      apiKey: "super-secret-token",
      nested: {
        password: "hidden",
      },
    });

    expect(summary).toMatchObject({
      argumentCount: 3,
      argumentKeys: ["query", "apiKey", "nested"],
    });
    expect(summary.argumentPreview).toContain("[REDACTED]");
    expect(summary.argumentPreview).not.toContain("super-secret-token");
    expect(summary.argumentPreview).not.toContain("hidden");
  });

  it("summarizes tool results with types, preview, and structured content keys", () => {
    const summary = summarizeToolResult({
      content: [
        {
          type: "text",
          text: "Fetched 2 repositories from GitHub and ranked them by stars.",
        },
        {
          type: "resource",
          resource: {
            text: "irrelevant",
          },
        },
      ],
      structuredContent: {
        repositories: [
          {
            name: "metamcp",
          },
        ],
        total: 2,
      },
      isError: false,
    } as any);

    expect(summary).toMatchObject({
      contentItems: 2,
      contentTypes: ["text", "resource"],
      resultIsError: false,
      structuredContentKeys: ["repositories", "total"],
    });
    expect(summary.resultPreview).toContain("Fetched 2 repositories");
  });

  it("accepts enriched MCP execution logs in the shared schema", () => {
    const parsed = MetaMcpLogEntrySchema.parse({
      id: "log-1",
      timestamp: new Date(),
      serverName: "GitHub",
      level: "info",
      message: 'MCP tool "search_repositories" completed',
      category: "tool",
      event: "tool_call",
      status: "success",
      namespaceUuid: "namespace-uuid",
      sessionId: "session-uuid",
      serverUuid: "server-uuid",
      toolName: "search_repositories",
      durationMs: 128,
      details: {
        requestSource: "metamcp",
        argumentCount: 2,
        argumentKeys: ["query", "limit"],
        contentTypes: ["text"],
        resultPreview: "Fetched 2 repositories",
      },
    });

    expect(parsed.details?.requestSource).toBe("metamcp");
    expect(parsed.details?.contentTypes).toEqual(["text"]);
  });
});
