import { z } from "zod";

export const MetaMcpLogDetailValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const MetaMcpLogContextSchema = z.object({
  category: z.enum(["server", "session", "tool", "system"]).optional(),
  event: z.string().optional(),
  status: z.string().optional(),
  namespaceUuid: z.string().optional(),
  sessionId: z.string().optional(),
  serverUuid: z.string().optional(),
  toolName: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  details: z.record(MetaMcpLogDetailValueSchema).optional(),
});

export const MetaMcpLogEntrySchema = z
  .object({
    id: z.string(),
    timestamp: z.date(),
    serverName: z.string(),
    level: z.enum(["error", "info", "warn"]),
    message: z.string(),
    error: z.string().optional(),
  })
  .merge(MetaMcpLogContextSchema);

export const GetLogsRequestSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

export const GetLogsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(MetaMcpLogEntrySchema),
  totalCount: z.number(),
});

export const ClearLogsResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type MetaMcpLogDetailValue = z.infer<typeof MetaMcpLogDetailValueSchema>;
export type MetaMcpLogContext = z.infer<typeof MetaMcpLogContextSchema>;
export type MetaMcpLogEntry = z.infer<typeof MetaMcpLogEntrySchema>;
export type GetLogsRequest = z.infer<typeof GetLogsRequestSchema>;
export type GetLogsResponse = z.infer<typeof GetLogsResponseSchema>;
export type ClearLogsResponse = z.infer<typeof ClearLogsResponseSchema>;
