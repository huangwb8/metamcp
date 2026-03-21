import { McpServerErrorStatusEnum } from "@repo/zod-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findByUuidMock,
  updateServerErrorStatusMock,
  getMcpMaxAttemptsMock,
} = vi.hoisted(() => ({
  findByUuidMock: vi.fn(),
  updateServerErrorStatusMock: vi.fn(),
  getMcpMaxAttemptsMock: vi.fn(),
}));

vi.mock("../../db/repositories/index", () => ({
  mcpServersRepository: {
    findByUuid: findByUuidMock,
    updateServerErrorStatus: updateServerErrorStatusMock,
  },
}));

vi.mock("../config.service", () => ({
  configService: {
    getMcpMaxAttempts: getMcpMaxAttemptsMock,
  },
}));

import { serverErrorTracker } from "./server-error-tracker";

describe("ServerErrorTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      serverErrorTracker as typeof serverErrorTracker & {
        resetRuntimeState?: () => void;
      }
    ).resetRuntimeState?.();
  });

  it("falls back to three attempts when config is unavailable", async () => {
    getMcpMaxAttemptsMock.mockRejectedValue(new Error("config unavailable"));

    await expect(
      serverErrorTracker.getServerMaxAttempts("server-1"),
    ).resolves.toBe(3);
  });

  it("does not let a stale persisted ERROR state block new retries", async () => {
    findByUuidMock.mockResolvedValue({
      uuid: "server-1",
      error_status: McpServerErrorStatusEnum.Enum.ERROR,
    });

    await expect(
      serverErrorTracker.isServerInErrorState("server-1"),
    ).resolves.toBe(false);
  });

  it("clears persisted ERROR state after a successful reconnect", async () => {
    findByUuidMock.mockResolvedValue({
      uuid: "server-1",
      error_status: McpServerErrorStatusEnum.Enum.ERROR,
    });

    await serverErrorTracker.recordSuccessfulConnection("server-1");

    expect(updateServerErrorStatusMock).toHaveBeenCalledWith({
      serverUuid: "server-1",
      errorStatus: McpServerErrorStatusEnum.Enum.NONE,
    });
  });
});
