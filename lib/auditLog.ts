/**
 * Audit log helper – record admin/teacher actions for accountability and oversight.
 * Use in API routes or server actions. Requires supabaseAdmin for inserts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActorType = "admin" | "teacher";

export interface AuditLogEntry {
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
}

export async function writeAuditLog(
  client: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  await client.from("audit_logs").insert({
    actor_type: entry.actor_type,
    actor_id: entry.actor_id ?? null,
    action: entry.action,
    resource_type: entry.resource_type ?? null,
    resource_id: entry.resource_id ?? null,
    details: entry.details ?? null,
    ip_address: entry.ip_address ?? null,
  });
}
