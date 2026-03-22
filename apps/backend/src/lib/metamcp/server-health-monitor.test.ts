import { ServerParameters } from "@repo/zod-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMetaMcpClientMock } = vi.hoisted(() => ({
  createMetaMcpClientMock: vi.fn(),
}));

vi.mock("../../db/repositories", () => ({
  mcpServersRepository: {
    findAll: vi.fn(),
    findByUuid: vi.fn(),
    updateServerHealthStatus: vi.fn(),
    resetServerHealthStatus: vi.fn(),
  },
}));

vi.mock("./client-factory", () => ({
  createMetaMcpClient: createMetaMcpClientMock,
}));

vi.mock("./utils", () => ({
  convertDbServerToParams: vi.fn(),
}));

import { probeServerHealth } from "./server-health-monitor";

const baseServerParams: ServerParameters = {
  uuid: "server-1",
  name: "Test Server",
  description: "Test server",
  type: "STDIO",
  command: "echo",
  args: ["ok"],
  env: {},
  created_at: new Date("2026-03-22T00:00:00.000Z").toISOString(),
  status: "active",
};

describe("probeServerHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a server as healthy after a successful MCP handshake", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const closeTransport = vi.fn().mockResolvedValue(undefined);
    const closeClient = vi.fn().mockResolvedValue(undefined);

    createMetaMcpClientMock.mockReturnValue({
      client: {
        connect,
        close: closeClient,
      },
      transport: {
        close: closeTransport,
      },
    });

    const result = await probeServerHealth(baseServerParams, 100);

    expect(result.error).toBeNull();
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(closeTransport).toHaveBeenCalledTimes(1);
    expect(closeClient).toHaveBeenCalledTimes(1);
  });

  it("reports a server as unhealthy when MCP connection fails", async () => {
    const connect = vi.fn().mockRejectedValue(new Error("connection failed"));
    const closeTransport = vi.fn().mockResolvedValue(undefined);
    const closeClient = vi.fn().mockResolvedValue(undefined);

    createMetaMcpClientMock.mockReturnValue({
      client: {
        connect,
        close: closeClient,
      },
      transport: {
        close: closeTransport,
      },
    });

    const result = await probeServerHealth(baseServerParams, 100);

    expect(result.error).toBe("connection failed");
    expect(closeTransport).toHaveBeenCalledTimes(1);
    expect(closeClient).toHaveBeenCalledTimes(1);
  });
});
