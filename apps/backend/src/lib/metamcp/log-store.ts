import type { MetaMcpLogContext, MetaMcpLogEntry } from "@repo/zod-types";

import logger from "@/utils/logger";

type MetaMcpLogEventInput = Omit<MetaMcpLogEntry, "id" | "timestamp">;

class MetaMcpLogStore {
  private logs: MetaMcpLogEntry[] = [];
  private readonly maxLogs = 1000; // Keep only the last 1000 logs
  private readonly listeners: Set<(log: MetaMcpLogEntry) => void> = new Set();

  addLog(
    serverName: string,
    level: MetaMcpLogEntry["level"],
    message: string,
    error?: unknown,
    context: MetaMcpLogContext = {},
  ) {
    this.addEvent({
      serverName,
      level,
      message,
      error: error
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined,
      ...context,
    });
  }

  addEvent(event: MetaMcpLogEventInput) {
    const logEntry: MetaMcpLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console for debugging
    const detailsSuffix = logEntry.details
      ? ` ${JSON.stringify(logEntry.details)}`
      : "";
    const durationSuffix =
      typeof logEntry.durationMs === "number"
        ? ` (${logEntry.durationMs}ms)`
        : "";
    const fullMessage = `[MetaMCP][${logEntry.serverName}] ${logEntry.message}${durationSuffix}${detailsSuffix}`;
    switch (logEntry.level) {
      case "error":
        logger.error(fullMessage, logEntry.error || "");
        break;
      case "warn":
        logger.warn(fullMessage, logEntry.error || "");
        break;
      case "info":
        logger.info(fullMessage, logEntry.error || "");
        break;
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(logEntry);
      } catch (err) {
        logger.error("Error notifying log listener:", err);
      }
    });
  }

  getLogs(limit?: number): MetaMcpLogEntry[] {
    const logsToReturn = limit ? this.logs.slice(-limit) : this.logs;
    return [...logsToReturn].reverse(); // Return newest first
  }

  clearLogs(): void {
    this.logs = [];
  }

  addListener(listener: (log: MetaMcpLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

// Singleton instance
export const metamcpLogStore = new MetaMcpLogStore();
