import {
  McpServerErrorStatusEnum,
  McpServerHealthStatusEnum,
} from "@repo/zod-types";

export const isMcpServerUnhealthy = (healthStatus?: string | null): boolean =>
  healthStatus === McpServerHealthStatusEnum.Enum.UNHEALTHY;

export const isMcpServerRetryable = (input: {
  errorStatus?: string | null;
  healthStatus?: string | null;
}): boolean =>
  input.errorStatus === McpServerErrorStatusEnum.Enum.ERROR ||
  input.healthStatus === McpServerHealthStatusEnum.Enum.UNHEALTHY;

export const getMcpServerHealthBadgeVariant = (
  healthStatus?: string | null,
): "success" | "destructive" | "warning" => {
  switch (healthStatus) {
    case McpServerHealthStatusEnum.Enum.HEALTHY:
      return "success";
    case McpServerHealthStatusEnum.Enum.UNHEALTHY:
      return "destructive";
    default:
      return "warning";
  }
};
