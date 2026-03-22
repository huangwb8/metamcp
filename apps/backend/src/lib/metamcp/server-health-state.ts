import { McpServerHealthStatusEnum } from "@repo/zod-types";

import logger from "@/utils/logger";

import { mcpServersRepository } from "../../db/repositories";

export interface ServerHealthSnapshot {
  status: (typeof McpServerHealthStatusEnum.Enum)[keyof typeof McpServerHealthStatusEnum.Enum];
  checkedAt: Date;
  error?: string | null;
  latencyMs?: number | null;
}

const truncateErrorMessage = (
  message: string | null | undefined,
): string | null => {
  if (!message) {
    return null;
  }

  return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
};

export async function recordServerHealthSnapshot(
  serverUuid: string,
  snapshot: ServerHealthSnapshot,
): Promise<void> {
  try {
    await mcpServersRepository.updateServerHealthStatus({
      serverUuid,
      healthStatus: snapshot.status,
      checkedAt: snapshot.checkedAt,
      error: truncateErrorMessage(snapshot.error),
      latencyMs: snapshot.latencyMs ?? null,
    });
  } catch (error) {
    logger.error(`Failed to record health snapshot for ${serverUuid}:`, error);
  }
}

export async function markServerHealthy(input: {
  serverUuid: string;
  checkedAt?: Date;
  latencyMs?: number | null;
}): Promise<void> {
  await recordServerHealthSnapshot(input.serverUuid, {
    status: McpServerHealthStatusEnum.Enum.HEALTHY,
    checkedAt: input.checkedAt ?? new Date(),
    latencyMs: input.latencyMs ?? null,
    error: null,
  });
}

export async function markServerUnhealthy(input: {
  serverUuid: string;
  checkedAt?: Date;
  error?: string | null;
  latencyMs?: number | null;
}): Promise<void> {
  await recordServerHealthSnapshot(input.serverUuid, {
    status: McpServerHealthStatusEnum.Enum.UNHEALTHY,
    checkedAt: input.checkedAt ?? new Date(),
    latencyMs: input.latencyMs ?? null,
    error: input.error ?? null,
  });
}

export async function resetServerHealth(serverUuid: string): Promise<void> {
  try {
    await mcpServersRepository.resetServerHealthStatus(serverUuid);
  } catch (error) {
    logger.error(`Failed to reset health snapshot for ${serverUuid}:`, error);
  }
}
