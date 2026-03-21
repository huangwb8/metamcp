import { McpServerErrorStatusEnum } from "@repo/zod-types";

import logger from "@/utils/logger";

import { mcpServersRepository } from "../../db/repositories/index";
import { configService } from "../config.service";

export interface ServerCrashInfo {
  serverUuid: string;
  exitCode: number | null;
  signal: string | null;
  timestamp: Date;
}

export class ServerErrorTracker {
  private static instance: ServerErrorTracker | null = null;

  // Track crash attempts per server
  private crashAttempts: Map<string, number> = new Map();

  // Track temporary retry blocks after a server has been marked as ERROR
  private retryBlockedUntil: Map<string, number> = new Map();

  // Default max attempts before marking as ERROR (fallback if config is not available)
  private readonly fallbackMaxAttempts: number = 3;

  // Default cooldown before a server in ERROR state can be retried automatically
  private readonly fallbackRetryCooldownMs: number = 30_000;

  // Server-specific max attempts (can be configured per server)
  private serverMaxAttempts: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): ServerErrorTracker {
    if (!ServerErrorTracker.instance) {
      ServerErrorTracker.instance = new ServerErrorTracker();
    }
    return ServerErrorTracker.instance;
  }

  /**
   * Set max attempts for a specific server
   */
  setServerMaxAttempts(serverUuid: string, maxAttempts: number): void {
    this.serverMaxAttempts.set(serverUuid, maxAttempts);
  }

  /**
   * Reset runtime-only tracking state.
   * Useful when a server recovers, when an operator manually retries,
   * and for isolated unit tests.
   */
  resetRuntimeState(serverUuid?: string): void {
    if (serverUuid) {
      this.crashAttempts.delete(serverUuid);
      this.retryBlockedUntil.delete(serverUuid);
      return;
    }

    this.crashAttempts.clear();
    this.retryBlockedUntil.clear();
    this.serverMaxAttempts.clear();
  }

  private getRetryCooldownMs(): number {
    const configuredValue = process.env.MCP_ERROR_RETRY_COOLDOWN_MS;
    if (!configuredValue) {
      return this.fallbackRetryCooldownMs;
    }

    const parsed = Number.parseInt(configuredValue, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return this.fallbackRetryCooldownMs;
    }

    return parsed;
  }

  /**
   * Get max attempts for a specific server
   */
  async getServerMaxAttempts(serverUuid: string): Promise<number> {
    // First check for server-specific configuration
    const serverSpecific = this.serverMaxAttempts.get(serverUuid);
    if (serverSpecific !== undefined) {
      return serverSpecific;
    }

    // Then check global configuration
    try {
      return await configService.getMcpMaxAttempts();
    } catch (error) {
      logger.warn(
        "Failed to get MCP max attempts from config, using fallback:",
        error,
      );
      return this.fallbackMaxAttempts;
    }
  }

  /**
   * Record a server crash and check if it should be marked as ERROR
   */
  async recordServerCrash(
    serverUuid: string,
    exitCode: number | null,
    signal: string | null,
  ): Promise<void> {
    logger.info(`recordServerCrash called for server ${serverUuid}`);

    // Get current attempt count
    const currentAttempts = this.crashAttempts.get(serverUuid) || 0;
    const newAttempts = currentAttempts + 1;

    // Update crash attempts tracking
    this.crashAttempts.set(serverUuid, newAttempts);

    const maxAttempts = await this.getServerMaxAttempts(serverUuid);

    logger.info(
      `Server ${serverUuid} crashed. Attempt ${newAttempts}/${maxAttempts}`,
    );

    // If we've reached max attempts, mark the server as ERROR
    if (newAttempts >= maxAttempts) {
      logger.warn(
        `Server ${serverUuid} has crashed ${newAttempts} times. Marking as ERROR.`,
      );

      try {
        await this.markServerAsError(serverUuid);
        this.retryBlockedUntil.set(
          serverUuid,
          Date.now() + this.getRetryCooldownMs(),
        );

        // Log the crash info
        const crashInfo: ServerCrashInfo = {
          serverUuid,
          exitCode,
          signal,
          timestamp: new Date(),
        };

        logger.error(
          "Server marked as ERROR due to repeated crashes:",
          crashInfo,
        );
      } catch (error) {
        logger.error(`Failed to mark server ${serverUuid} as ERROR:`, error);
      }
    }
  }

  /**
   * Record a successful connection and clear any stale ERROR state.
   */
  async recordSuccessfulConnection(serverUuid: string): Promise<void> {
    try {
      this.resetRuntimeState(serverUuid);

      const server = await mcpServersRepository.findByUuid(serverUuid);
      if (
        server?.error_status === McpServerErrorStatusEnum.Enum.ERROR
      ) {
        await mcpServersRepository.updateServerErrorStatus({
          serverUuid,
          errorStatus: McpServerErrorStatusEnum.Enum.NONE,
        });
        logger.info(
          `Server ${serverUuid} recovered successfully. Cleared ERROR state.`,
        );
      }
    } catch (error) {
      logger.error(
        `Error recording successful connection for ${serverUuid}:`,
        error,
      );
    }
  }

  /**
   * Mark a server as ERROR
   */
  private async markServerAsError(serverUuid: string): Promise<void> {
    try {
      // Update the server-level error status
      await mcpServersRepository.updateServerErrorStatus({
        serverUuid,
        errorStatus: McpServerErrorStatusEnum.Enum.ERROR,
      });

      logger.error(`Server ${serverUuid} marked as ERROR at server level`);
    } catch (error) {
      logger.error(`Error marking server ${serverUuid} as ERROR:`, error);
    }
  }

  /**
   * Reset crash attempts for a server (e.g., after successful recovery)
   */
  resetServerAttempts(serverUuid: string): void {
    this.crashAttempts.delete(serverUuid);
  }

  /**
   * Get current crash attempts for a server
   */
  getServerAttempts(serverUuid: string): number {
    return this.crashAttempts.get(serverUuid) || 0;
  }

  /**
   * Check if a server is in ERROR state
   */
  async isServerInErrorState(serverUuid: string): Promise<boolean> {
    try {
      const server = await mcpServersRepository.findByUuid(serverUuid);

      if (!server) {
        this.resetRuntimeState(serverUuid);
        return false;
      }

      if (server.error_status !== McpServerErrorStatusEnum.Enum.ERROR) {
        this.resetRuntimeState(serverUuid);
        return false;
      }

      const blockedUntil = this.retryBlockedUntil.get(serverUuid);

      // A persisted ERROR without an active runtime block should not
      // permanently prevent retries after a restart.
      if (!blockedUntil) {
        this.crashAttempts.delete(serverUuid);
        return false;
      }

      if (Date.now() >= blockedUntil) {
        this.crashAttempts.delete(serverUuid);
        this.retryBlockedUntil.delete(serverUuid);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        `Error checking server error state for ${serverUuid}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Reset error state for a server (e.g., after manual recovery)
   */
  async resetServerErrorState(serverUuid: string): Promise<void> {
    try {
      this.resetRuntimeState(serverUuid);

      // Update the database to clear the error status
      await mcpServersRepository.updateServerErrorStatus({
        serverUuid,
        errorStatus: McpServerErrorStatusEnum.Enum.NONE,
      });

      logger.info(`Reset error state for server ${serverUuid}`);
    } catch (error) {
      logger.error(
        `Error resetting error state for server ${serverUuid}:`,
        error,
      );
    }
  }
}

// Export singleton instance
export const serverErrorTracker = ServerErrorTracker.getInstance();
