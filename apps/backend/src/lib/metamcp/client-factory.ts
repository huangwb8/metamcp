import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ServerParameters } from "@repo/zod-types";

import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
import { metamcpLogStore } from "./log-store";
import { classifyStderrMessage } from "./stderr-log-classification";
import { resolveEnvVariables } from "./utils";

/**
 * Transforms localhost URLs to use host.docker.internal when running inside Docker.
 */
export const transformDockerUrl = (url: string): string => {
  if (process.env.TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL === "true") {
    return url.replace(/localhost|127\.0\.0\.1/g, "host.docker.internal");
  }

  return url;
};

export const createMetaMcpClient = (
  serverParams: ServerParameters,
): { client: Client | undefined; transport: Transport | undefined } => {
  let transport: Transport | undefined;

  if (!serverParams.type || serverParams.type === "STDIO") {
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
    const transformedUrl = transformDockerUrl(serverParams.url);
    const headers: Record<string, string> = {
      ...(serverParams.headers || {}),
    };
    const authToken =
      serverParams.oauth_tokens?.access_token || serverParams.bearerToken;

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (Object.keys(headers).length === 0) {
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
    const transformedUrl = transformDockerUrl(serverParams.url);
    const headers: Record<string, string> = {
      ...(serverParams.headers || {}),
    };
    const authToken =
      serverParams.oauth_tokens?.access_token || serverParams.bearerToken;

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (Object.keys(headers).length === 0) {
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
