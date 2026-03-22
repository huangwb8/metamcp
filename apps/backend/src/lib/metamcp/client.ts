import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ServerParameters } from "@repo/zod-types";

import logger from "@/utils/logger";

import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
import { metamcpLogStore } from "./log-store";
import { getElapsedDurationMs } from "./observability";
import { serverErrorTracker } from "./server-error-tracker";
import { classifyStderrMessage } from "./stderr-log-classification";
import { resolveEnvVariables } from "./utils";

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

/**
 * Transforms localhost URLs to use host.docker.internal when running inside Docker
 */
export const transformDockerUrl = (url: string): string => {
  if (process.env.TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL === "true") {
    const transformed = url.replace(
      /localhost|127\.0\.0\.1/g,
      "host.docker.internal",
    );
    return transformed;
  }
  return url;
};

export const createMetaMcpClient = (
  serverParams: ServerParameters,
): { client: Client | undefined; transport: Transport | undefined } => {
  let transport: Transport | undefined;

  // Create the appropriate transport based on server type
  // Default to "STDIO" if type is undefined
  if (!serverParams.type || serverParams.type === "STDIO") {
    // Resolve environment variable placeholders
    const resolvedEnv = serverParams.env
      ? resolveEnvVariables(serverParams.env)
      : undefined;

    const stdioParams: StdioServerParameters = {
      command: serverParams.command || "",
      args: serverParams.args || undefined,
      env: resolvedEnv,
      stderr: "pipe",
    };
    transport = new ProcessManagedStdioTransport(stdioParams);

    // Handle stderr stream when set to "pipe"
    if ((transport as ProcessManagedStdioTransport).stderr) {
      const stderrStream = (transport as ProcessManagedStdioTransport).stderr;

      stderrStream?.on("data", (chunk: Buffer) => {
        const stderrEntry = classifyStderrMessage(chunk.toString());

        if (!stderrEntry) {
          return;
        }

        metamcpLogStore.addLog(
          serverParams.name,
          stderrEntry.level,
          stderrEntry.message,
          undefined,
          {
            category: "server",
            event: stderrEntry.event,
            status: stderrEntry.status,
            serverUuid: serverParams.uuid,
          },
        );
      });

      stderrStream?.on("error", (error: Error) => {
        metamcpLogStore.addLog(
          serverParams.name,
          "error",
          "stderr error",
          error,
          {
            category: "server",
            event: "stderr",
            status: "error",
            serverUuid: serverParams.uuid,
          },
        );
      });
    }
  } else if (serverParams.type === "SSE" && serverParams.url) {
    // Transform the URL if TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL is set to "true"
    const transformedUrl = transformDockerUrl(serverParams.url);

    // Build headers: start with custom headers, then add auth header
    const headers: Record<string, string> = {
      ...(serverParams.headers || {}),
    };

    // Check for authentication - prioritize OAuth tokens, fallback to bearerToken
    const authToken =
      serverParams.oauth_tokens?.access_token || serverParams.bearerToken;
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const hasHeaders = Object.keys(headers).length > 0;

    if (!hasHeaders) {
      transport = new SSEClientTransport(new URL(transformedUrl));
    } else {
      transport = new SSEClientTransport(new URL(transformedUrl), {
        requestInit: {
          headers,
        },
        eventSourceInit: {
          fetch: (url, init) => fetch(url, { ...init, headers }),
        },
      });
    }
  } else if (serverParams.type === "STREAMABLE_HTTP" && serverParams.url) {
    // Transform the URL if TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL is set to "true"
    const transformedUrl = transformDockerUrl(serverParams.url);

    // Build headers: start with custom headers, then add auth header
    const headers: Record<string, string> = {
      ...(serverParams.headers || {}),
    };

    // Check for authentication - prioritize OAuth tokens, fallback to bearerToken
    const authToken =
      serverParams.oauth_tokens?.access_token || serverParams.bearerToken;
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const hasHeaders = Object.keys(headers).length > 0;

    if (!hasHeaders) {
      transport = new StreamableHTTPClientTransport(new URL(transformedUrl));
    } else {
      transport = new StreamableHTTPClientTransport(new URL(transformedUrl), {
        requestInit: {
          headers,
        },
      });
    }
  } else {
    metamcpLogStore.addLog(
      serverParams.name,
      "error",
      `Unsupported server type: ${serverParams.type}`,
      undefined,
      {
        category: "server",
        event: "connect",
        status: "error",
        serverUuid: serverParams.uuid,
        details: {
          transportType: serverParams.type || "unknown",
        },
      },
    );
    return { client: undefined, transport: undefined };
  }

  const client = new Client(
    {
      name: "metamcp-client",
      version: "2.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
      },
    },
  );
  return { client, transport };
};

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
          await transport!.close();
          await client!.close();
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
        } catch (cleanupError) {
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

  return undefined;
};
