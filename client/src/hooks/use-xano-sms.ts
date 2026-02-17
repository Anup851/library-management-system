import { useMutation, useQuery } from "@tanstack/react-query";

type XanoResponse = Record<string, unknown> | Array<Record<string, unknown>> | null;
type XanoPayload = Record<string, unknown>;
type XanoSmsResource =
  | "attendance"
  | "class"
  | "exam"
  | "fee"
  | "mark"
  | "student"
  | "subject";

const XANO_SMS_BASE_URL =
  (import.meta.env.VITE_XANO_SMS_URL as string | undefined)?.replace(/\/$/, "") || "";

const xanoSmsUrl = (path: string) => `${XANO_SMS_BASE_URL}${path}`;

function getAuthHeaders(includeJsonContentType = false) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function requestXanoSms(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  payload?: XanoPayload,
): Promise<XanoResponse> {
  const res = await fetch(xanoSmsUrl(path), {
    method,
    headers: getAuthHeaders(!!payload),
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Xano SMS request failed (${res.status})`);
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

export function useXanoSmsList(resource: XanoSmsResource) {
  return useQuery({
    queryKey: ["xano-sms", resource, "list"],
    queryFn: () => requestXanoSms("GET", `/${resource}`),
    enabled: !!XANO_SMS_BASE_URL,
  });
}

export function useXanoSmsGetById(resource: XanoSmsResource, id?: number | string) {
  return useQuery({
    queryKey: ["xano-sms", resource, "get", id],
    queryFn: () => requestXanoSms("GET", `/${resource}/${id}`),
    enabled: !!XANO_SMS_BASE_URL && id !== undefined && id !== null,
  });
}

export function useXanoSmsCreate(resource: XanoSmsResource) {
  return useMutation({
    mutationFn: (payload: XanoPayload) => requestXanoSms("POST", `/${resource}`, payload),
  });
}

export function useXanoSmsUpdate(resource: XanoSmsResource) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: XanoPayload }) =>
      requestXanoSms("PATCH", `/${resource}/${id}`, data),
  });
}

export function useXanoSmsDelete(resource: XanoSmsResource) {
  return useMutation({
    mutationFn: (id: number | string) => requestXanoSms("DELETE", `/${resource}/${id}`),
  });
}

// Attendance
export const useXanoAttendanceList = () => useXanoSmsList("attendance");
export const useXanoAttendanceById = (id?: number | string) => useXanoSmsGetById("attendance", id);
export const useXanoCreateAttendance = () => useXanoSmsCreate("attendance");
export const useXanoUpdateAttendance = () => useXanoSmsUpdate("attendance");
export const useXanoDeleteAttendance = () => useXanoSmsDelete("attendance");

// Class
export const useXanoClassList = () => useXanoSmsList("class");
export const useXanoClassById = (id?: number | string) => useXanoSmsGetById("class", id);
export const useXanoCreateClassRecord = () => useXanoSmsCreate("class");
export const useXanoUpdateClassRecord = () => useXanoSmsUpdate("class");
export const useXanoDeleteClassRecord = () => useXanoSmsDelete("class");

// Exam
export const useXanoExamList = () => useXanoSmsList("exam");
export const useXanoExamById = (id?: number | string) => useXanoSmsGetById("exam", id);
export const useXanoCreateExamRecord = () => useXanoSmsCreate("exam");
export const useXanoUpdateExamRecord = () => useXanoSmsUpdate("exam");
export const useXanoDeleteExamRecord = () => useXanoSmsDelete("exam");

// Fee
export const useXanoFeeList = () => useXanoSmsList("fee");
export const useXanoFeeById = (id?: number | string) => useXanoSmsGetById("fee", id);
export const useXanoCreateFeeRecord = () => useXanoSmsCreate("fee");
export const useXanoUpdateFeeRecord = () => useXanoSmsUpdate("fee");
export const useXanoDeleteFeeRecord = () => useXanoSmsDelete("fee");

// Mark
export const useXanoMarkList = () => useXanoSmsList("mark");
export const useXanoMarkById = (id?: number | string) => useXanoSmsGetById("mark", id);
export const useXanoCreateMarkRecord = () => useXanoSmsCreate("mark");
export const useXanoUpdateMarkRecord = () => useXanoSmsUpdate("mark");
export const useXanoDeleteMarkRecord = () => useXanoSmsDelete("mark");

// Student
export const useXanoStudentList = () => useXanoSmsList("student");
export const useXanoStudentById = (id?: number | string) => useXanoSmsGetById("student", id);
export const useXanoCreateStudentRecord = () => useXanoSmsCreate("student");
export const useXanoUpdateStudentRecord = () => useXanoSmsUpdate("student");
export const useXanoDeleteStudentRecord = () => useXanoSmsDelete("student");

// Subject
export const useXanoSubjectList = () => useXanoSmsList("subject");
export const useXanoSubjectById = (id?: number | string) => useXanoSmsGetById("subject", id);
export const useXanoCreateSubjectRecord = () => useXanoSmsCreate("subject");
export const useXanoUpdateSubjectRecord = () => useXanoSmsUpdate("subject");
export const useXanoDeleteSubjectRecord = () => useXanoSmsDelete("subject");
