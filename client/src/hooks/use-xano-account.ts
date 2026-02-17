import { useMutation, useQuery } from "@tanstack/react-query";

type XanoResponse = Record<string, unknown>;
type XanoPayload = Record<string, unknown>;

const XANO_ACCOUNT_BASE_URL =
  (import.meta.env.VITE_XANO_ACCOUNT_URL as string | undefined)?.replace(/\/$/, "") || "";

const xanoAccountUrl = (path: string) => `${XANO_ACCOUNT_BASE_URL}${path}`;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function requestXano(
  method: "GET" | "POST" | "PATCH",
  path: string,
  payload?: XanoPayload,
): Promise<XanoResponse> {
  const res = await fetch(xanoAccountUrl(path), {
    method,
    headers: getAuthHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Xano request failed (${res.status})`);
  }

  return await res.json();
}

function buildQueryString(params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

// POST /account
export function useXanoCreateAccount() {
  return useMutation({
    mutationFn: (payload: XanoPayload) => requestXano("POST", "/account", payload),
  });
}

// GET /account/details (supports optional query params for the single input)
export function useXanoAccountDetails(
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  const query = buildQueryString(params);
  return useQuery({
    queryKey: ["xano-account", "details", params],
    queryFn: () => requestXano("GET", `/account/details${query}`),
    enabled: !!XANO_ACCOUNT_BASE_URL,
  });
}

// GET /account/my_team_members
export function useXanoMyTeamMembers() {
  return useQuery({
    queryKey: ["xano-account", "my_team_members"],
    queryFn: () => requestXano("GET", "/account/my_team_members"),
    enabled: !!XANO_ACCOUNT_BASE_URL,
  });
}

// POST /admin/user_role
export function useXanoUpdateUserRole() {
  return useMutation({
    mutationFn: (payload: XanoPayload) => requestXano("POST", "/admin/user_role", payload),
  });
}

// PATCH /user/edit_profile
export function useXanoEditProfile() {
  return useMutation({
    mutationFn: (payload: XanoPayload) => requestXano("PATCH", "/user/edit_profile", payload),
  });
}

// POST /user/join_account
export function useXanoJoinAccount() {
  return useMutation({
    mutationFn: (payload: XanoPayload) => requestXano("POST", "/user/join_account", payload),
  });
}
