import type { MetaMcpLogEntry } from "@repo/zod-types";

export const LOG_FILTER_IDS = [
  "all",
  "error",
  "warning",
  "success",
  "activity",
  "info",
] as const;

export type LogFilterId = (typeof LOG_FILTER_IDS)[number];

export const getLogFilterId = (
  log: MetaMcpLogEntry,
): Exclude<LogFilterId, "all"> => {
  if (log.level === "error" || log.status === "error" || log.error) {
    return "error";
  }

  if (log.level === "warn") {
    return "warning";
  }

  if (log.status === "success") {
    return "success";
  }

  if (log.status === "started") {
    return "activity";
  }

  return "info";
};

export const filterLogsByCategory = (
  logs: MetaMcpLogEntry[],
  filterId: LogFilterId,
) => {
  if (filterId === "all") {
    return logs;
  }

  return logs.filter((log) => getLogFilterId(log) === filterId);
};

export const getLogFilterCounts = (logs: MetaMcpLogEntry[]) => {
  const counts: Record<LogFilterId, number> = {
    all: logs.length,
    error: 0,
    warning: 0,
    success: 0,
    activity: 0,
    info: 0,
  };

  for (const log of logs) {
    counts[getLogFilterId(log)] += 1;
  }

  return counts;
};

export const serializeLogsForClipboard = (logs: MetaMcpLogEntry[]) =>
  JSON.stringify(
    logs,
    (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    },
    2,
  );
