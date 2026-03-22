"use client";

import type { MetaMcpLogDetailValue, MetaMcpLogEntry } from "@repo/zod-types";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileTerminal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "@/hooks/useTranslations";
import {
  LOG_FILTER_IDS,
  type LogFilterId,
  filterLogsByCategory,
  getLogFilterCounts,
  getLogFilterId,
  serializeLogsForClipboard,
} from "@/lib/logs/log-presentation";
import { useLogsStore } from "@/lib/stores/logs-store";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<MetaMcpLogEntry["level"], string> = {
  error: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  warn: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const CATEGORY_STYLES: Record<string, string> = {
  server:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  session: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  tool: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  system:
    "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const STATUS_STYLES: Record<string, string> = {
  started: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
};

const FILTER_STYLES: Record<LogFilterId, string> = {
  all: "border-border/60 text-muted-foreground hover:text-foreground",
  error:
    "border-red-500/20 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200",
  warning:
    "border-amber-500/20 text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200",
  success:
    "border-emerald-500/20 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200",
  activity:
    "border-blue-500/20 text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200",
  info: "border-slate-500/20 text-slate-700 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-200",
};

const ACTIVE_FILTER_STYLES: Record<LogFilterId, string> = {
  all: "border-foreground/15 bg-foreground/5 text-foreground",
  error: "border-red-500/25 bg-red-500/12 text-red-700 dark:text-red-300",
  warning:
    "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  success:
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  activity:
    "border-blue-500/25 bg-blue-500/12 text-blue-700 dark:text-blue-300",
  info: "border-slate-500/25 bg-slate-500/12 text-slate-700 dark:text-slate-300",
};

const ROW_ACCENT_STYLES: Record<Exclude<LogFilterId, "all">, string> = {
  error: "before:bg-red-500",
  warning: "before:bg-amber-500",
  success: "before:bg-emerald-500",
  activity: "before:bg-blue-500",
  info: "before:bg-slate-400",
};

const formatIdentifier = (value?: string) => {
  if (!value) return undefined;
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const formatDetailValue = (value: MetaMcpLogDetailValue) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
};

const hasDetails = (log: MetaMcpLogEntry) =>
  Boolean(
    log.error ||
      log.details ||
      log.sessionId ||
      log.namespaceUuid ||
      log.serverUuid,
  );

export default function LiveLogsPage() {
  const { t } = useTranslations();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<LogFilterId>("all");
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>(
    {},
  );
  const {
    logs,
    isLoading,
    isAutoRefreshing,
    totalCount,
    lastFetch,
    fetchLogs,
    clearLogs,
    setAutoRefresh,
  } = useLogsStore();

  useEffect(() => {
    setExpandedLogIds((current) => {
      const activeIds = new Set(logs.map((log) => log.id));
      let hasChanges = false;
      const next: Record<string, boolean> = {};

      for (const [logId, isExpanded] of Object.entries(current)) {
        if (activeIds.has(logId)) {
          next[logId] = isExpanded;
          continue;
        }

        hasChanges = true;
      }

      return hasChanges ? next : current;
    });
  }, [logs]);

  const handleClearLogs = async () => {
    try {
      await clearLogs();
      toast.success(t("logs:logsClearSuccess"));
      setShowClearDialog(false);
    } catch (_error) {
      toast.error(t("logs:logsClearError"));
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchLogs();
      toast.success(t("logs:refreshSuccess"));
    } catch (_error) {
      toast.error(t("logs:refreshError"));
    }
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!isAutoRefreshing);
    if (!isAutoRefreshing) {
      toast.success(t("logs:autoRefreshEnabled"));
    } else {
      toast.info(t("logs:autoRefreshDisabled"));
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        serializeLogsForClipboard(visibleLogs),
      );
      toast.success(t("logs:copyJsonSuccess"));
    } catch (_error) {
      toast.error(t("logs:copyJsonError"));
    }
  };

  const toggleDetails = (logId: string) => {
    setExpandedLogIds((current) => ({
      ...current,
      [logId]: !current[logId],
    }));
  };

  const formatTimestamp = (timestamp: Date) =>
    new Date(timestamp).toLocaleString();

  const getLevelLabel = (level: MetaMcpLogEntry["level"]) => {
    switch (level) {
      case "error":
        return t("logs:error");
      case "warn":
        return t("logs:warning");
      case "info":
      default:
        return t("logs:info");
    }
  };

  const getFilterLabel = (filterId: LogFilterId) => {
    switch (filterId) {
      case "all":
        return t("logs:all");
      case "error":
        return t("logs:error");
      case "warning":
        return t("logs:warning");
      case "success":
        return t("logs:success");
      case "activity":
        return t("logs:activity");
      case "info":
      default:
        return t("logs:info");
    }
  };

  const filterCounts = getLogFilterCounts(logs);
  const visibleLogs = filterLogsByCategory(logs, selectedFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <FileTerminal className="mt-1 h-6 w-6 text-muted-foreground" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{t("logs:title")}</h1>
              {isAutoRefreshing && (
                <Badge variant="secondary" className="text-xs">
                  {t("logs:live")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("logs:subtitle")}
            </p>
            {lastFetch && (
              <p className="text-xs text-muted-foreground">
                {t("logs:lastUpdated", {
                  timestamp: formatTimestamp(lastFetch),
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("logs:totalLogs", { count: totalCount })}
          </Badge>
          <Badge variant="outline">
            {selectedFilter === "all"
              ? t("logs:logsCount", { count: visibleLogs.length })
              : t("logs:filteredLogsCount", {
                  count: visibleLogs.length,
                  total: logs.length,
                })}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleToggleAutoRefresh}>
            {isAutoRefreshing
              ? t("logs:stopAutoRefresh")
              : t("logs:startAutoRefresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            {t("logs:refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={visibleLogs.length === 0}
          >
            <Copy className="h-4 w-4" />
            {t("logs:copyJson")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            disabled={isLoading || logs.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            {t("logs:clearLogs")}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("logs:consoleOutput")}
          </span>
          {LOG_FILTER_IDS.map((filterId) => {
            const isActive = selectedFilter === filterId;

            return (
              <button
                key={filterId}
                type="button"
                onClick={() => setSelectedFilter(filterId)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? ACTIVE_FILTER_STYLES[filterId]
                    : FILTER_STYLES[filterId],
                )}
              >
                <span>{getFilterLabel(filterId)}</span>
                <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {filterCounts[filterId]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[720px] overflow-y-auto rounded-xl border border-border/60 bg-card/40">
          {visibleLogs.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              {logs.length === 0
                ? isLoading
                  ? t("logs:loadingLogs")
                  : t("logs:noLogsDisplay")
                : t("logs:noLogsInFilter")}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visibleLogs.map((log) => {
                const isExpanded = expandedLogIds[log.id] ?? false;
                const detailEntries = Object.entries(log.details || {});
                const canExpand = hasDetails(log);
                const filterId = getLogFilterId(log);
                const summaryBadge = log.status
                  ? {
                      label: `${t("logs:statusLabel")}: ${log.status}`,
                      className:
                        STATUS_STYLES[log.status] ||
                        "border-border/60 bg-background/60 text-foreground",
                    }
                  : log.category
                    ? {
                        label: `${t("logs:categoryLabel")}: ${log.category}`,
                        className:
                          CATEGORY_STYLES[log.category] ||
                          "border-border/60 bg-background/60 text-foreground",
                      }
                    : null;

                const headerContent = (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center text-muted-foreground">
                      {canExpand ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-border" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span title={formatTimestamp(new Date(log.timestamp))}>
                          {formatTimestamp(new Date(log.timestamp))}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-2 py-0 text-[11px]",
                            LEVEL_STYLES[log.level],
                          )}
                        >
                          {getLevelLabel(log.level)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-background/60 px-2 py-0 text-[11px] text-foreground"
                        >
                          {log.serverName}
                        </Badge>
                        {summaryBadge && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "border px-2 py-0 text-[11px]",
                              summaryBadge.className,
                            )}
                          >
                            {summaryBadge.label}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <p className="min-w-0 flex-1 text-sm leading-6 text-foreground">
                          {log.message}
                        </p>
                        {canExpand && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {isExpanded
                              ? t("logs:hideDetails")
                              : t("logs:showDetails")}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {log.category && (
                          <span>{`${t("logs:categoryLabel")}: ${log.category}`}</span>
                        )}
                        {log.event && (
                          <span>{`${t("logs:eventLabel")}: ${log.event}`}</span>
                        )}
                        {log.toolName && (
                          <span>{`${t("logs:toolLabel")}: ${log.toolName}`}</span>
                        )}
                        {typeof log.durationMs === "number" && (
                          <span>{`${t("logs:durationLabel")}: ${log.durationMs}ms`}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "relative bg-background/40 transition-colors hover:bg-accent/20 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-0.5 before:rounded-full",
                      ROW_ACCENT_STYLES[filterId],
                    )}
                  >
                    {canExpand ? (
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-left"
                        onClick={() => toggleDetails(log.id)}
                      >
                        {headerContent}
                      </button>
                    ) : (
                      <div className="px-4 py-3">{headerContent}</div>
                    )}

                    {canExpand && isExpanded && (
                      <div className="border-t border-border/50 bg-muted/20 px-4 py-3">
                        <div className="space-y-3 text-sm">
                          {log.error && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-300">
                                {t("logs:errorLabel")}
                              </div>
                              <pre className="overflow-x-auto rounded-lg border border-red-500/15 bg-red-500/5 p-3 font-mono text-[12px] leading-5 text-red-700 dark:text-red-200">
                                {log.error}
                              </pre>
                            </div>
                          )}

                          {(log.sessionId ||
                            log.namespaceUuid ||
                            log.serverUuid) && (
                            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                              {log.sessionId && (
                                <div
                                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                  title={log.sessionId}
                                >
                                  <span className="font-medium text-foreground">
                                    {`${t("logs:sessionLabel")}: `}
                                  </span>
                                  <span className="font-mono">
                                    {formatIdentifier(log.sessionId)}
                                  </span>
                                </div>
                              )}
                              {log.namespaceUuid && (
                                <div
                                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                  title={log.namespaceUuid}
                                >
                                  <span className="font-medium text-foreground">
                                    {`${t("logs:namespaceLabel")}: `}
                                  </span>
                                  <span className="font-mono">
                                    {formatIdentifier(log.namespaceUuid)}
                                  </span>
                                </div>
                              )}
                              {log.serverUuid && (
                                <div
                                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                  title={log.serverUuid}
                                >
                                  <span className="font-medium text-foreground">
                                    {`${t("logs:serverUuidLabel")}: `}
                                  </span>
                                  <span className="font-mono">
                                    {formatIdentifier(log.serverUuid)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {detailEntries.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("logs:detailsLabel")}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {detailEntries.map(([key, value]) => (
                                  <div
                                    key={`${log.id}-${key}`}
                                    className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                  >
                                    <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                      {key}
                                    </div>
                                    <div className="break-words text-[13px] leading-5 text-foreground">
                                      {formatDetailValue(value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {logs.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedFilter === "all"
            ? t("logs:showingLogs", {
                count: visibleLogs.length,
                total: totalCount,
              })
            : t("logs:filteredLogsCount", {
                count: visibleLogs.length,
                total: logs.length,
              })}
        </div>
      )}

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("logs:clearAllLogs")}</DialogTitle>
            <DialogDescription>{t("logs:clearLogsConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearLogs}
              disabled={isLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("logs:clearLogs")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
