import { DatabaseMcpServer, McpServer } from "@repo/zod-types";

export class McpServersSerializer {
  static serializeMcpServer(dbServer: DatabaseMcpServer): McpServer {
    return {
      uuid: dbServer.uuid,
      name: dbServer.name,
      description: dbServer.description,
      type: dbServer.type,
      command: dbServer.command,
      args: dbServer.args,
      env: dbServer.env,
      url: dbServer.url,
      error_status: dbServer.error_status,
      health_status: dbServer.health_status,
      last_health_check_at:
        dbServer.last_health_check_at?.toISOString() ?? null,
      last_health_check_error: dbServer.last_health_check_error,
      last_health_check_latency_ms: dbServer.last_health_check_latency_ms,
      created_at: dbServer.created_at.toISOString(),
      bearerToken: dbServer.bearerToken,
      headers: dbServer.headers,
      user_id: dbServer.user_id,
    };
  }

  static serializeMcpServerList(dbServers: DatabaseMcpServer[]): McpServer[] {
    return dbServers.map(this.serializeMcpServer);
  }
}
