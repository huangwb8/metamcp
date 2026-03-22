CREATE TYPE "public"."mcp_server_health_status" AS ENUM('UNKNOWN', 'HEALTHY', 'UNHEALTHY');--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "health_status" "mcp_server_health_status" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "last_health_check_error" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "last_health_check_latency_ms" integer;--> statement-breakpoint
CREATE INDEX "mcp_servers_health_status_idx" ON "mcp_servers" USING btree ("health_status");