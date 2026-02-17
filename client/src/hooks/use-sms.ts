import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InsertClass,
  InsertExam,
  InsertFee,
  InsertStudent,
  InsertSubject,
} from "@shared/schema";
import { z } from "zod";
import { api } from "@shared/routes";

type AnyRecord = Record<string, any>;
type Resource = "student" | "class" | "subject" | "attendance" | "exam" | "mark" | "fee";

const XANO_SMS_BASE_URL =
  (import.meta.env.VITE_XANO_SMS_URL as string | undefined)?.replace(/\/$/, "") || "";

function getAuthHeaders(includeJson = false) {
  const headers: Record<string, string> = {};
  if (includeJson) headers["Content-Type"] = "application/json";

  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function xanoRequest(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const res = await fetch(`${XANO_SMS_BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(Boolean(body)),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());

function normalizeRecord(record: AnyRecord): AnyRecord {
  return Object.entries(record).reduce<AnyRecord>((acc, [k, v]) => {
    acc[snakeToCamel(k)] = v;
    return acc;
  }, {});
}

async function list(resource: Resource): Promise<AnyRecord[]> {
  const data = await xanoRequest("GET", `/${resource}`);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeRecord);
}

async function getById(resource: Resource, id: number): Promise<AnyRecord | null> {
  const data = await xanoRequest("GET", `/${resource}/${id}`);
  if (!data || typeof data !== "object") return null;
  return normalizeRecord(data as AnyRecord);
}

function firstDefined<T = any>(obj: AnyRecord, keys: string[], fallback?: T): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

// === STUDENTS ===
export function useStudents(params?: { classId?: number; search?: string }) {
  return useQuery({
    queryKey: ["xano", "students", params],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const [studentsRaw, classesRaw] = await Promise.all([list("student"), list("class")]);

      const classesById = new Map<number, AnyRecord>();
      for (const c of classesRaw) {
        const classId = Number(firstDefined(c, ["id", "classId"], 0));
        if (classId) classesById.set(classId, c);
      }

      const filtered = studentsRaw
        .filter((s) => {
          const studentClassId = Number(firstDefined(s, ["classId", "class"], 0));
          const name = String(firstDefined(s, ["name"], "") || "").toLowerCase();
          const rollNo = String(firstDefined(s, ["rollNo", "rollno"], "") || "").toLowerCase();

          const classOk = !params?.classId || studentClassId === params.classId;
          const searchText = params?.search?.toLowerCase();
          const searchOk = !searchText || name.includes(searchText) || rollNo.includes(searchText);
          return classOk && searchOk;
        })
        .map((s) => {
          const studentClassId = Number(firstDefined(s, ["classId", "class"], 0));
          const cls = classesById.get(studentClassId);
          return {
            ...s,
            classId: studentClassId,
            rollNo: firstDefined(s, ["rollNo", "rollno"], ""),
            class: cls
              ? {
                  id: Number(firstDefined(cls, ["id", "classId"], 0)),
                  name: firstDefined(cls, ["name"], ""),
                  section: firstDefined(cls, ["section"], ""),
                }
              : { id: studentClassId, name: "-", section: "-" },
          };
        });

      return { data: filtered, total: filtered.length };
    },
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: ["xano", "student", id],
    enabled: !!XANO_SMS_BASE_URL && !!id,
    queryFn: async () => getById("student", id),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStudent) => xanoRequest("POST", "/student", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "students"] }),
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertStudent>) =>
      xanoRequest("PATCH", `/student/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "students"] }),
  });
}

// === CLASSES ===
export function useClasses() {
  return useQuery({
    queryKey: ["xano", "classes"],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const classesRaw = await list("class");
      return classesRaw.map((cls) => ({
        ...cls,
        teacher: null,
      }));
    },
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertClass) => xanoRequest("POST", "/class", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "classes"] }),
  });
}

// === ATTENDANCE ===
export function useAttendanceReport(classId: number, date: string) {
  return useQuery({
    queryKey: ["xano", "attendance", "report", classId, date],
    enabled: !!XANO_SMS_BASE_URL && !!classId && !!date,
    queryFn: async () => {
      const [attendanceRaw, studentsRaw] = await Promise.all([list("attendance"), list("student")]);
      const studentsById = new Map<number, AnyRecord>();

      for (const s of studentsRaw) {
        studentsById.set(Number(firstDefined(s, ["id", "studentId"], 0)), s);
      }

      const classStudents = studentsRaw
        .filter((s) => Number(firstDefined(s, ["classId", "class"], 0)) === classId)
        .map((s) => ({
          id: Number(firstDefined(s, ["id", "studentId"], 0)),
          name: String(firstDefined(s, ["name"], "")),
          rollNo: String(firstDefined(s, ["rollNo", "rollno"], "")),
        }));

      const reportMap = new Map<number, AnyRecord>();
      for (const rec of attendanceRaw) {
        const recDate = String(firstDefined(rec, ["date", "attendanceDate"], ""));
        const recClass = Number(firstDefined(rec, ["classId", "class"], 0));
        if (recDate !== date || recClass !== classId) continue;
        const sid = Number(firstDefined(rec, ["studentId", "student"], 0));
        const st = studentsById.get(sid);
        reportMap.set(sid, {
          ...rec,
          student: {
            id: sid,
            name: String(firstDefined(st || {}, ["name"], "")),
            rollNo: String(firstDefined(st || {}, ["rollNo", "rollno"], "")),
          },
          status: String(firstDefined(rec, ["status"], "ABSENT")),
        });
      }

      return classStudents.map((student) => {
        const existing = reportMap.get(student.id);
        if (existing) return existing;
        return {
          id: `virtual-${student.id}`,
          classId,
          date,
          studentId: student.id,
          status: "ABSENT",
          student,
        };
      });
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.attendance.mark.input>) => {
      await Promise.all(
        data.records.map((record) =>
          xanoRequest("POST", "/attendance", {
            classId: data.classId,
            studentId: record.studentId,
            status: record.status,
            date: data.date,
          }),
        ),
      );
      return { message: "Attendance marked" };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["xano", "attendance", "report", variables.classId, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ["xano", "dashboard", "stats"] });
    },
  });
}

// === EXAMS & MARKS ===
export function useExams(classId?: number) {
  return useQuery({
    queryKey: ["xano", "exams", classId],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const exams = await list("exam");
      if (!classId) return exams;
      return exams.filter((exam) => Number(firstDefined(exam, ["classId", "class"], 0)) === classId);
    },
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertExam) => xanoRequest("POST", "/exam", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "exams"] }),
  });
}

export function useUpdateMarks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.marks.update.input>) => {
      await Promise.all(
        data.marks.map((m) =>
          xanoRequest("POST", "/mark", {
            examId: data.examId,
            subjectId: data.subjectId,
            studentId: m.studentId,
            score: m.score,
            maxScore: m.maxScore,
          }),
        ),
      );
      return { message: "Marks updated" };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "marks"] }),
  });
}

// === FEES ===
export function useFees() {
  return useQuery({
    queryKey: ["xano", "fees"],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const [feesRaw, studentsRaw] = await Promise.all([list("fee"), list("student")]);
      const studentsById = new Map<number, AnyRecord>();
      for (const s of studentsRaw) {
        studentsById.set(Number(firstDefined(s, ["id", "studentId"], 0)), s);
      }

      return feesRaw.map((fee) => {
        const studentId = Number(firstDefined(fee, ["studentId", "student"], 0));
        const student = studentsById.get(studentId);
        return {
          ...fee,
          studentId,
          paymentDate: firstDefined(fee, ["paymentDate", "date"], null),
          student: student
            ? {
                id: studentId,
                name: firstDefined(student, ["name"], ""),
                rollNo: firstDefined(student, ["rollNo", "rollno"], ""),
              }
            : null,
        };
      });
    },
  });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFee) => xanoRequest("POST", "/fee", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xano", "fees"] });
      queryClient.invalidateQueries({ queryKey: ["xano", "dashboard", "stats"] });
    },
  });
}

// === DASHBOARD ===
export function useDashboardStats() {
  return useQuery({
    queryKey: ["xano", "dashboard", "stats"],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const [students, attendance, fees] = await Promise.all([list("student"), list("attendance"), list("fee")]);
      const today = new Date().toISOString().slice(0, 10);

      const presentToday = attendance.filter((a) => {
        const date = String(firstDefined(a, ["date", "attendanceDate"], ""));
        const status = String(firstDefined(a, ["status"], "")).toUpperCase();
        return date === today && status === "PRESENT";
      }).length;

      const feesCollected = fees.reduce((sum, fee) => sum + Number(firstDefined(fee, ["amount"], 0) || 0), 0);

      return {
        totalStudents: students.length,
        presentToday,
        feesCollected,
      };
    },
  });
}

// === SUBJECTS ===
export function useSubjects(classId?: number) {
  return useQuery({
    queryKey: ["xano", "subjects", classId],
    enabled: !!XANO_SMS_BASE_URL,
    queryFn: async () => {
      const subjects = await list("subject");
      if (!classId) return subjects;
      return subjects.filter((s) => Number(firstDefined(s, ["classId", "class"], 0)) === classId);
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSubject) => xanoRequest("POST", "/subject", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "subjects"] }),
  });
}
