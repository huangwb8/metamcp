import { ServerParameters } from "@repo/zod-types";

import { mcpServersRepository, namespacesRepository } from "../db/repositories";
import { initializeEnvironmentConfiguration } from "./bootstrap.service";
import { metaMcpServerPool } from "./metamcp";
import { mcpServerPool } from "./metamcp/mcp-server-pool";
import { convertDbServerToParams } from "./metamcp/utils";

const sleep = (time: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, time));

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

const getStartupPriority = (params: ServerParameters): number => {
  switch (params.type) {
    case "STREAMABLE_HTTP":
    case "SSE":
      return 0;
    case "STDIO":
    default:
      return 1;
  }
};

export async function waitForBackendReadiness(options?: {
  port?: number;
  attempts?: number;
  intervalMs?: number;
  path?: string;
}): Promise<boolean> {
  const port = options?.port ?? 12009;
  const attempts = options?.attempts ?? 20;
  const intervalMs = options?.intervalMs ?? 500;
  const path = options?.path ?? "/health";
  const url = `http://127.0.0.1:${port}${path}`;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until the backend starts answering.
    }

    if (attempt < attempts) {
      await sleep(intervalMs);
    }
  }

  return false;
}

async function warmServersForStartup(
  allServerParams: Record<string, ServerParameters>,
): Promise<void> {
  const startupConcurrency = parsePositiveInt(
    process.env.MCP_STARTUP_WARMUP_CONCURRENCY,
    2,
  );
  const batchDelayMs = parsePositiveInt(
    process.env.MCP_STARTUP_WARMUP_DELAY_MS,
    750,
  );

  const orderedServers = Object.entries(allServerParams).sort(
    ([leftUuid, leftParams], [rightUuid, rightParams]) => {
      const priorityDifference =
        getStartupPriority(leftParams) - getStartupPriority(rightParams);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return leftUuid.localeCompare(rightUuid);
    },
  );

  for (let index = 0; index < orderedServers.length; index += startupConcurrency) {
    const batch = orderedServers.slice(index, index + startupConcurrency);

    await Promise.allSettled(
      batch.map(([uuid, params]) =>
        mcpServerPool.ensureIdleSessionForNewServer(uuid, params),
      ),
    );

    if (index + startupConcurrency < orderedServers.length) {
      await sleep(batchDelayMs);
    }
  }
}

/**
 * Startup initialization that must happen before the HTTP server begins listening.
 *
 * IMPORTANT: This function does not prevent the app from starting unless BOOTSTRAP_FAIL_HARD=true.
 */
export async function initializeOnStartup(): Promise<void> {
  const parseBool = (value: string | undefined, defaultValue: boolean) => {
    if (value === undefined) return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
    return defaultValue;
  };

  const enableEnvBootstrap = parseBool(process.env.BOOTSTRAP_ENABLE, true);
  const failHard = parseBool(process.env.BOOTSTRAP_FAIL_HARD, false);

  if (enableEnvBootstrap) {
    try {
      await initializeEnvironmentConfiguration();
    } catch (err) {
      console.error(
        "❌ Error initializing environment-based configuration (ignored):",
        err,
      );
      if (failHard) {
        throw err;
      }
    }
  } else {
    console.log("Environment bootstrap disabled via BOOTSTRAP_ENABLE=false");
  }
}

/**
 * Startup function to initialize idle servers for all namespaces and all MCP servers
 */
export async function initializeIdleServers() {
  try {
    console.log(
      "Initializing idle servers for all namespaces and all MCP servers...",
    );

    // Fetch all namespaces from the database
    const namespaces = await namespacesRepository.findAll();
    const namespaceUuids = namespaces.map((namespace) => namespace.uuid);

    if (namespaceUuids.length === 0) {
      console.log("No namespaces found in database");
    } else {
      console.log(
        `Found ${namespaceUuids.length} namespaces: ${namespaceUuids.join(", ")}`,
      );
    }

    // Fetch ALL MCP servers from the database (not just namespace-associated ones)
    console.log("Fetching all MCP servers from database...");
    const allDbServers = await mcpServersRepository.findAll();
    console.log(`Found ${allDbServers.length} total MCP servers in database`);

    // Convert all database servers to ServerParameters format
    const allServerParams: Record<string, ServerParameters> = {};
    for (const dbServer of allDbServers) {
      const serverParams = await convertDbServerToParams(dbServer);
      if (serverParams) {
        allServerParams[dbServer.uuid] = serverParams;
      }
    }

    console.log(
      `Successfully converted ${Object.keys(allServerParams).length} MCP servers to ServerParameters format`,
    );

    // Initialize idle sessions for the underlying MCP server pool with ALL servers,
    // but do it in small batches to avoid stampeding many cold STDIO servers at once.
    if (Object.keys(allServerParams).length > 0) {
      await warmServersForStartup(allServerParams);
      console.log(
        "✅ Successfully initialized idle MCP server pool sessions for ALL servers",
      );
    }

    // Ensure idle servers for all namespaces (MetaMCP server pool)
    if (namespaceUuids.length > 0) {
      await metaMcpServerPool.ensureIdleServers(namespaceUuids, true);
      console.log(
        "✅ Successfully initialized idle servers for all namespaces",
      );
    }

    console.log(
      "✅ Successfully initialized idle servers for all namespaces and all MCP servers",
    );
  } catch (error) {
    console.log("❌ Error initializing idle servers:", error);
    // Don't exit the process, just log the error
    // The server should still start even if idle server initialization fails
  }
}
