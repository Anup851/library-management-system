import { useQuery } from "@tanstack/react-query";

type XanoEventLog = Record<string, unknown>;

const XANO_LOGS_BASE_URL =
  (import.meta.env.VITE_XANO_LOGS_URL as string | undefined)?.replace(/\/$/, "") || "";

const xanoLogsUrl = (path: string) => `${XANO_LOGS_BASE_URL}${path}`;

async function fetchXanoLogs(path: string): Promise<XanoEventLog[]> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(xanoLogsUrl(path), { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.status}`);
  }

  return await res.json();
}

// Pull all event logs for the authenticated user.
export function useXanoMyEvents() {
  return useQuery({
    queryKey: ["xano-logs", "user", "my_events"],
    queryFn: () => fetchXanoLogs("/logs/user/my_events"),
    enabled: !!XANO_LOGS_BASE_URL,
  });
}

// Admin-only endpoint for account-level event logs.
export function useXanoAdminAccountEvents() {
  return useQuery({
    queryKey: ["xano-logs", "admin", "account_events"],
    queryFn: () => fetchXanoLogs("/logs/admin/account_events"),
    enabled: !!XANO_LOGS_BASE_URL,
  });
}
