import type { MetaMcpLogEntry } from "../../packages/zod-types/src";

import {
  filterLogsByCategory,
  getLogFilterCounts,
  getLogFilterId,
  serializeLogsForClipboard,
} from "../../apps/frontend/lib/logs/log-presentation";

const buildLog = (overrides: Partial<MetaMcpLogEntry>): MetaMcpLogEntry => ({
  id: overrides.id ?? "log-1",
  timestamp: overrides.timestamp ?? new Date("2026-03-22T08:00:00.000Z"),
  serverName: overrides.serverName ?? "MetaMCP",
  level: overrides.level ?? "info",
  message: overrides.message ?? "Log message",
  ...overrides,
});

describe("live logs presentation contract", () => {
  it("maps logs into a single filter bucket using severity-first precedence", () => {
    expect(
      getLogFilterId(
        buildLog({
          level: "error",
          status: "success",
        }),
      ),
    ).toBe("error");

    expect(
      getLogFilterId(
        buildLog({
          level: "warn",
          status: "success",
        }),
      ),
    ).toBe("warning");

    expect(
      getLogFilterId(
        buildLog({
          level: "warn",
          event: "stderr",
          status: "stderr",
        }),
      ),
    ).toBe("stderr");

    expect(
      getLogFilterId(
        buildLog({
          level: "info",
          status: "success",
        }),
      ),
    ).toBe("success");

    expect(
      getLogFilterId(
        buildLog({
          level: "info",
          status: "started",
        }),
      ),
    ).toBe("activity");

    expect(
      getLogFilterId(
        buildLog({
          level: "info",
        }),
      ),
    ).toBe("info");
  });

  it("counts and filters logs without duplicating entries across categories", () => {
    const logs = [
      buildLog({ id: "error", level: "error" }),
      buildLog({ id: "warning", level: "warn" }),
      buildLog({
        id: "stderr",
        level: "warn",
        event: "stderr",
        status: "stderr",
      }),
      buildLog({ id: "success", status: "success" }),
      buildLog({ id: "activity", status: "started" }),
      buildLog({ id: "info" }),
    ];

    expect(getLogFilterCounts(logs)).toEqual({
      all: 6,
      error: 1,
      warning: 1,
      stderr: 1,
      success: 1,
      activity: 1,
      info: 1,
    });

    expect(filterLogsByCategory(logs, "error").map((log) => log.id)).toEqual([
      "error",
    ]);
    expect(filterLogsByCategory(logs, "stderr").map((log) => log.id)).toEqual([
      "stderr",
    ]);
    expect(filterLogsByCategory(logs, "activity").map((log) => log.id)).toEqual(
      ["activity"],
    );
  });

  it("serializes clipboard JSON with ISO timestamps", () => {
    const json = serializeLogsForClipboard([
      buildLog({
        id: "copy-target",
        timestamp: new Date("2026-03-22T10:15:30.000Z"),
        status: "error",
      }),
    ]);

    expect(json).toContain('"id": "copy-target"');
    expect(json).toContain('"timestamp": "2026-03-22T10:15:30.000Z"');
    expect(json).toContain('"status": "error"');
  });
});
