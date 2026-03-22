import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ServerParameters } from "@repo/zod-types";

import logger from "@/utils/logger";

import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
import { createMetaMcpClient } from "./client-factory";
import { metamcpLogStore } from "./log-store";
import { getElapsedDurationMs } from "./observability";
import { serverErrorTracker } from "./server-error-tracker";
import { markServerHealthy, markServerUnhealthy } from "./server-health-state";

const sleep = (time: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), time));

const baseRetryDelayMs = 2_000;
const maxRetryDelayMs = 15_000;

export const getConnectionRetryDelayMs = (attempt: number): number => {
  const normalizedAttempt = Math.max(1, attempt);
  return Math.min(
    baseRetryDelayMs * 2 ** (normalizedAttempt - 1),
    maxRetryDelayMs,
  );
};

export interface ConnectedClient {
  client: Client;
  cleanup: () => Promise<void>;
  onProcessCrash?: (exitCode: number | null, signal: string | null) => void;
}

export const connectMetaMcpClient = async (
  serverParams: ServerParameters,
  onProcessCrash?: (exitCode: number | null, signal: string | null) => void,
): Promise<ConnectedClient | undefined> => {
  // Get max attempts from server error tracker instead of hardcoding
  const maxAttempts = await serverErrorTracker.getServerMaxAttempts(
    serverParams.uuid,
  );
  let count = 0;
  let retry = true;
  let lastConnectionError: unknown;

  logger.info(
    `Connecting to server ${serverParams.name} (${serverParams.uuid}) with max attempts: ${maxAttempts}`,
  );

  while (retry) {
    let transport: Transport | undefined;
    let client: Client | undefined;
    const attemptNumber = count + 1;
    const connectionStart = performance.now();

    try {
      metamcpLogStore.addLog(
        serverParams.name,
        "info",
        `Connecting to MCP server (attempt ${attemptNumber}/${maxAttempts})`,
        undefined,
        {
          category: "server",
          event: "connect",
          status: "started",
          serverUuid: serverParams.uuid,
          details: {
            attempt: attemptNumber,
            maxAttempts,
            transportType: serverParams.type || "STDIO",
          },
        },
      );

      // Check if server is already in error state before attempting connection
      const isInErrorState = await serverErrorTracker.isServerInErrorState(
        serverParams.uuid,
      );
      if (isInErrorState) {
        logger.info(
          `Server ${serverParams.name} (${serverParams.uuid}) is already in ERROR state, skipping connection attempt`,
        );
        return undefined;
      }

      // Create fresh client and transport for each attempt
      const result = createMetaMcpClient(serverParams);
      client = result.client;
      transport = result.transport;

      if (!client || !transport) {
        return undefined;
      }

      // Set up process crash detection for STDIO transports BEFORE connecting
      if (transport instanceof ProcessManagedStdioTransport) {
        logger.info(
          `Setting up crash handler for server ${serverParams.name} (${serverParams.uuid})`,
        );
        transport.onprocesscrash = (exitCode, signal) => {
          logger.info(
            `Process crashed for server ${serverParams.name} (${serverParams.uuid}): code=${exitCode}, signal=${signal}`,
          );

          // Notify the pool about the crash
          if (onProcessCrash) {
            logger.info(
              `Calling onProcessCrash callback for server ${serverParams.name} (${serverParams.uuid})`,
            );
            onProcessCrash(exitCode, signal);
          } else {
            logger.info(
              `No onProcessCrash callback provided for server ${serverParams.name} (${serverParams.uuid})`,
            );
          }
        };
      }

      await client.connect(transport);
      await serverErrorTracker.recordSuccessfulConnection(serverParams.uuid);
      void markServerHealthy({
        serverUuid: serverParams.uuid,
      });
      const durationMs = getElapsedDurationMs(connectionStart);

      metamcpLogStore.addLog(
        serverParams.name,
        "info",
        "Connected to MCP server",
        undefined,
        {
          category: "server",
          event: "connect",
          status: "success",
          serverUuid: serverParams.uuid,
          durationMs,
          details: {
            attempt: attemptNumber,
            maxAttempts,
            transportType: serverParams.type || "STDIO",
          },
        },
      );

      return {
        client,
        cleanup: async () => {
          if (transport) {
            await transport.close();
          }
          if (client) {
            await client.close();
          }
        },
        onProcessCrash: (exitCode, signal) => {
          logger.warn(
            `Process crash detected for server ${serverParams.name} (${serverParams.uuid}): code=${exitCode}, signal=${signal}`,
          );

          // Notify the pool about the crash
          if (onProcessCrash) {
            onProcessCrash(exitCode, signal);
          }
        },
      };
    } catch (error) {
      lastConnectionError = error;
      metamcpLogStore.addLog(
        serverParams.name,
        "error",
        `Error connecting to MCP server (attempt ${attemptNumber}/${maxAttempts})`,
        error,
        {
          category: "server",
          event: "connect",
          status: "error",
          serverUuid: serverParams.uuid,
          durationMs: getElapsedDurationMs(connectionStart),
          details: {
            attempt: attemptNumber,
            maxAttempts,
            transportType: serverParams.type || "STDIO",
          },
        },
      );

      // CRITICAL FIX: Clean up transport/process on connection failure
      // This prevents orphaned processes from accumulating
      if (transport) {
        try {
          await transport.close();
          console.log(
            `Cleaned up transport for failed connection to ${serverParams.name} (${serverParams.uuid})`,
          );
        } catch (cleanupError) {
          console.error(
            `Error cleaning up transport for ${serverParams.name} (${serverParams.uuid}):`,
            cleanupError,
          );
        }
      }
      if (client) {
        try {
          await client.close();
        } catch (_cleanupError) {
          // Client may not be fully initialized, ignore
        }
      }

      count++;
      retry = count < maxAttempts;
      if (retry) {
        await sleep(getConnectionRetryDelayMs(count));
      }
    }
  }

  void markServerUnhealthy({
    serverUuid: serverParams.uuid,
    error:
      lastConnectionError instanceof Error
        ? lastConnectionError.message
        : "Failed to connect to MCP server",
  });

  return undefined;
};
