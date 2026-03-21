import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MetaMcpLogDetailValue } from "@repo/zod-types";

const SENSITIVE_KEY_PATTERN =
  /(authorization|api[-_]?key|bearer|cookie|password|secret|session|token)/i;
const MAX_ARRAY_ITEMS = 5;
const MAX_OBJECT_KEYS = 12;
const MAX_STRING_LENGTH = 120;
const MAX_PREVIEW_LENGTH = 240;
const MAX_DEPTH = 3;

const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeValue = (
  value: unknown,
  key?: string,
  depth: number = 0,
): unknown => {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return truncate(value, MAX_STRING_LENGTH);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    if (isPlainObject(value)) {
      return `[Object(${Object.keys(value).length})]`;
    }

    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, undefined, depth + 1));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeValue(entryValue, entryKey, depth + 1),
        ]),
    );
  }

  return truncate(String(value), MAX_STRING_LENGTH);
};

const stringifyPreview = (value: unknown): string | undefined => {
  try {
    const preview = JSON.stringify(value);
    if (!preview) {
      return undefined;
    }

    return truncate(preview, MAX_PREVIEW_LENGTH);
  } catch {
    return undefined;
  }
};

export const summarizeToolArguments = (
  args: unknown,
): Record<string, MetaMcpLogDetailValue> => {
  if (!isPlainObject(args)) {
    const preview = stringifyPreview(sanitizeValue(args));

    return preview
      ? {
          argumentCount: 0,
          argumentPreview: preview,
        }
      : { argumentCount: 0 };
  }

  const argumentKeys = Object.keys(args);
  const argumentPreview = stringifyPreview(sanitizeValue(args));

  return {
    argumentCount: argumentKeys.length,
    argumentKeys,
    ...(argumentPreview ? { argumentPreview } : {}),
  };
};

export const summarizeToolResult = (
  result: CallToolResult,
): Record<string, MetaMcpLogDetailValue> => {
  const contentItems = Array.isArray(result.content) ? result.content : [];
  const contentTypes = contentItems
    .map((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        typeof item.type === "string"
      ) {
        return item.type;
      }

      return typeof item;
    })
    .slice(0, MAX_ARRAY_ITEMS);

  const firstTextContent = contentItems.find(
    (item): item is { text: string } =>
      typeof item === "object" &&
      item !== null &&
      "text" in item &&
      typeof item.text === "string",
  );
  const structuredContentKeys = isPlainObject(result.structuredContent)
    ? Object.keys(result.structuredContent).slice(0, MAX_OBJECT_KEYS)
    : [];

  return {
    contentItems: contentItems.length,
    contentTypes,
    resultIsError: Boolean(result.isError),
    ...(firstTextContent
      ? { resultPreview: truncate(firstTextContent.text, MAX_STRING_LENGTH) }
      : {}),
    ...(structuredContentKeys.length > 0 ? { structuredContentKeys } : {}),
  };
};

export const getElapsedDurationMs = (startedAt: number): number =>
  Math.max(0, Math.round(performance.now() - startedAt));
