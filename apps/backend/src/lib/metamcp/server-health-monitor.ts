import { ServerParameters } from "@repo/zod-types";

import logger from "@/utils/logger";

import { mcpServersRepository } from "../../db/repositories";
import { createMetaMcpClient } from "./client-factory";
import { markServerHealthy, markServerUnhealthy } from "./server-health-state";
import { convertDbServerToParams } from "./utils";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const getHealthCheckIntervalMs = () =>
  parsePositiveInt(process.env.MCP_HEALTH_CHECK_INTERVAL_MS, 5 * 60 * 1000);

const getHealthCheckInitialDelayMs = () =>
  parsePositiveInt(process.env.MCP_HEALTH_CHECK_INITIAL_DELAY_MS, 30 * 1000);

const getHealthCheckTimeoutMs = () =>
  parsePositiveInt(process.env.MCP_HEALTH_CHECK_TIMEOUT_MS, 10 * 1000);

const getHealthCheckConcurrency = () =>
  parsePositiveInt(process.env.MCP_HEALTH_CHECK_CONCURRENCY, 3);

const getServerPriority = (params: ServerParameters): number => {
  switch (params.type) {
    case "STREAMABLE_HTTP":
    case "SSE":
      return 0;
    case "STDIO":
    default:
      return 1;
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export interface ServerHealthProbeResult {
  checkedAt: Date;
  latencyMs: number;
  error: string | null;
}

export async function probeServerHealth(
  serverParams: ServerParameters,
  timeoutMs: number = getHealthCheckTimeoutMs(),
): Promise<ServerHealthProbeResult> {
  const checkedAt = new Date();
  const startedAt = performance.now();
  const { client, transport } = createMetaMcpClient(serverParams);

  if (!client || !transport) {
    return {
      checkedAt,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      error: "Unable to create MCP client for health check",
    };
  }

  let timeoutId: NodeJS.Timeout | undefined;
  let timedOut = false;

  const connectPromise = client.connect(transport);
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Health check timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);

    return {
      checkedAt,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      error: null,
    };
  } catch (error) {
    return {
      checkedAt,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      error: getErrorMessage(error),
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const cleanupTasks: Array<Promise<unknown>> = [
      connectPromise.catch(() => undefined),
      transport.close(),
      client.close(),
    ];

    if (timedOut) {
      logger.warn(
        `Timed out health check for server ${serverParams.name} (${serverParams.uuid})`,
      );
    }

    await Promise.allSettled(cleanupTasks);
  }
}

class McpServerHealthMonitor {
  private static instance: McpServerHealthMonitor | null = null;

  private timer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private sweepInProgress = false;
  private singleChecksInFlight: Map<string, Promise<void>> = new Map();

  static getInstance(): McpServerHealthMonitor {
    if (!McpServerHealthMonitor.instance) {
      McpServerHealthMonitor.instance = new McpServerHealthMonitor();
    }

    return McpServerHealthMonitor.instance;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    const intervalMs = getHealthCheckIntervalMs();
    const initialDelayMs = getHealthCheckInitialDelayMs();

    this.initialTimer = setTimeout(() => {
      void this.runSweep("startup");
    }, initialDelayMs);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.runSweep("interval");
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runSweep(reason: "startup" | "interval" | "manual" = "manual") {
    if (this.sweepInProgress) {
      logger.info(
        `Skipping MCP server health sweep (${reason}) because one is already running`,
      );
      return;
    }

    this.sweepInProgress = true;

    try {
      const servers = await mcpServersRepository.findAll();
      const hydratedServers = await Promise.all(
        servers.map(async (server) => ({
          server,
          params: await convertDbServerToParams(server),
        })),
      );

      const orderedServers = hydratedServers.sort((left, right) => {
        const leftPriority = left.params ? getServerPriority(left.params) : 2;
        const rightPriority = right.params
          ? getServerPriority(right.params)
          : 2;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.server.uuid.localeCompare(right.server.uuid);
      });

      const concurrency = getHealthCheckConcurrency();
      for (let index = 0; index < orderedServers.length; index += concurrency) {
        const batch = orderedServers.slice(index, index + concurrency);

        await Promise.allSettled(
          batch.map(async ({ server, params }) => {
            await this.checkServer(server.uuid, params);
          }),
        );
      }
    } catch (error) {
      logger.error(`Failed to run MCP server health sweep (${reason}):`, error);
    } finally {
      this.sweepInProgress = false;
    }
  }

  async refreshServer(serverUuid: string): Promise<void> {
    const existingCheck = this.singleChecksInFlight.get(serverUuid);
    if (existingCheck) {
      return await existingCheck;
    }

    const checkPromise = this.refreshServerInternal(serverUuid).finally(() => {
      this.singleChecksInFlight.delete(serverUuid);
    });

    this.singleChecksInFlight.set(serverUuid, checkPromise);
    return await checkPromise;
  }

  private async refreshServerInternal(serverUuid: string): Promise<void> {
    const server = await mcpServersRepository.findByUuid(serverUuid);
    if (!server) {
      return;
    }

    const params = await convertDbServerToParams(server);
    await this.checkServer(serverUuid, params);
  }

  private async checkServer(
    serverUuid: string,
    params: ServerParameters | null,
  ): Promise<void> {
    if (!params) {
      await markServerUnhealthy({
        serverUuid,
        error: "Unable to resolve MCP server configuration for health check",
      });
      return;
    }

    const result = await probeServerHealth(params);

    if (!result.error) {
      await markServerHealthy({
        serverUuid,
        checkedAt: result.checkedAt,
        latencyMs: result.latencyMs,
      });
      return;
    }

    await markServerUnhealthy({
      serverUuid,
      checkedAt: result.checkedAt,
      latencyMs: result.latencyMs,
      error: result.error,
    });
  }
}

export const mcpServerHealthMonitor = McpServerHealthMonitor.getInstance();
