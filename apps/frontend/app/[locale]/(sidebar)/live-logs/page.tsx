"use client";

import type { MetaMcpLogDetailValue, MetaMcpLogEntry } from "@repo/zod-types";
import {
  ChevronDown,
  ChevronRight,
  FileTerminal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "@/hooks/useTranslations";
import { useLogsStore } from "@/lib/stores/logs-store";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<MetaMcpLogEntry["level"], string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-100",
};

const CATEGORY_STYLES: Record<string, string> = {
  server: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  session: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  tool: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  system: "border-slate-500/30 bg-slate-500/10 text-slate-100",
};

const STATUS_STYLES: Record<string, string> = {
  started: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  error: "border-red-500/30 bg-red-500/10 text-red-100",
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

  const toggleDetails = (logId: string) => {
    setExpandedLogIds((current) => ({
      ...current,
      [logId]: !current[logId],
    }));
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileTerminal className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">{t("logs:title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("logs:subtitle")}
              {lastFetch && (
                <span className="ml-2">
                  (
                  {t("logs:lastUpdated", {
                    timestamp: formatTimestamp(lastFetch),
                  })}
                  )
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {t("logs:totalLogs", { count: totalCount })}
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
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {t("logs:refresh")}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{t("logs:consoleOutput")}</span>
            {isAutoRefreshing && (
              <Badge variant="secondary" className="text-xs">
                {t("logs:live")}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[720px] overflow-y-auto rounded-lg bg-black p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                {isLoading ? t("logs:loadingLogs") : t("logs:noLogsDisplay")}
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isExpanded =
                    expandedLogIds[log.id] ?? log.level === "error";
                  const detailEntries = Object.entries(log.details || {});

                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-gray-200 transition-colors hover:border-white/20 hover:bg-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="whitespace-nowrap text-gray-500">
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
                          className="border-white/15 bg-white/5 px-2 py-0 text-[11px] text-blue-200"
                        >
                          [{log.serverName}]
                        </Badge>
                        {log.category && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "border px-2 py-0 text-[11px]",
                              CATEGORY_STYLES[log.category] ||
                                "border-white/15 bg-white/5 text-gray-200",
                            )}
                          >
                            {`${t("logs:categoryLabel")}: ${log.category}`}
                          </Badge>
                        )}
                        {log.status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "border px-2 py-0 text-[11px]",
                              STATUS_STYLES[log.status] ||
                                "border-white/15 bg-white/5 text-gray-200",
                            )}
                          >
                            {`${t("logs:statusLabel")}: ${log.status}`}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 text-sm leading-6 text-gray-100">
                        {log.message}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
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

                      {hasDetails(log) && (
                        <div className="mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                            onClick={() => toggleDetails(log.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="mr-1 h-4 w-4" />
                            ) : (
                              <ChevronRight className="mr-1 h-4 w-4" />
                            )}
                            {isExpanded
                              ? t("logs:hideDetails")
                              : t("logs:showDetails")}
                          </Button>

                          {isExpanded && (
                            <div className="mt-3 space-y-3 rounded-md border border-white/10 bg-black/30 p-3 text-xs">
                              {log.error && (
                                <div>
                                  <div className="mb-1 text-red-300">
                                    {t("logs:errorLabel")}
                                  </div>
                                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-red-200">
                                    {log.error}
                                  </pre>
                                </div>
                              )}

                              {(log.sessionId ||
                                log.namespaceUuid ||
                                log.serverUuid) && (
                                <div className="grid gap-2 text-gray-300 sm:grid-cols-2">
                                  {log.sessionId && (
                                    <div title={log.sessionId}>
                                      <span className="text-gray-500">
                                        {`${t("logs:sessionLabel")}: `}
                                      </span>
                                      <span>
                                        {formatIdentifier(log.sessionId)}
                                      </span>
                                    </div>
                                  )}
                                  {log.namespaceUuid && (
                                    <div title={log.namespaceUuid}>
                                      <span className="text-gray-500">
                                        {`${t("logs:namespaceLabel")}: `}
                                      </span>
                                      <span>
                                        {formatIdentifier(log.namespaceUuid)}
                                      </span>
                                    </div>
                                  )}
                                  {log.serverUuid && (
                                    <div title={log.serverUuid}>
                                      <span className="text-gray-500">
                                        {`${t("logs:serverUuidLabel")}: `}
                                      </span>
                                      <span>
                                        {formatIdentifier(log.serverUuid)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {detailEntries.length > 0 && (
                                <div>
                                  <div className="mb-2 text-gray-400">
                                    {t("logs:detailsLabel")}
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {detailEntries.map(([key, value]) => (
                                      <div
                                        key={`${log.id}-${key}`}
                                        className="rounded border border-white/8 bg-white/5 px-2 py-2 text-gray-200"
                                      >
                                        <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                                          {key}
                                        </div>
                                        <div className="break-words text-[12px] leading-5">
                                          {formatDetailValue(value)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {t("logs:showingLogs", { count: logs.length, total: totalCount })}
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
