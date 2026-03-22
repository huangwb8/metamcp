import type { MetaMcpLogEntry } from "@repo/zod-types";

const STDERR_ERROR_PATTERNS = [
  /cannot find module/i,
  /module_not_found/i,
  /\benoent\b/i,
  /no such file or directory/i,
  /command not found/i,
  /permission denied/i,
];

export interface ClassifiedStderrMessage {
  event: "stderr";
  level: MetaMcpLogEntry["level"];
  status: "error" | "stderr";
  message: string;
}

export const classifyStderrMessage = (
  rawMessage: string,
): ClassifiedStderrMessage | undefined => {
  const message = rawMessage.trim();

  if (!message) {
    return undefined;
  }

  const isError = STDERR_ERROR_PATTERNS.some((pattern) =>
    pattern.test(message),
  );

  return {
    event: "stderr",
    level: isError ? "error" : "warn",
    status: isError ? "error" : "stderr",
    message,
  };
};
