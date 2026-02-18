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
const RESOURCE_CACHE_TTL_MS = 15000;
const RESOURCE_CACHE = new Map<string, { ts: number; data: AnyRecord[] }>();
let smsRateLimitedUntil = 0;

function getAuthHeaders(includeJson = false) {
  const headers: Record<string, string> = {};
  if (includeJson) headers["Content-Type"] = "application/json";

  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

function withSnakeAliases(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withSnakeAliases);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      const normalizedValue = withSnakeAliases(v);
      out[key] = normalizedValue;
      const snake = camelToSnake(key);
      if (!(snake in out)) {
        out[snake] = normalizedValue;
      }
    }
    return out;
  }
  return value;
}

async function xanoRequest(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  if (Date.now() < smsRateLimitedUntil) {
    throw new Error("Rate limited by Xano. Please wait a moment and retry.");
  }

  const payload = body ? withSnakeAliases(body) : undefined;
  const res = await fetch(`${XANO_SMS_BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(Boolean(body)),
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    if (res.status === 429) {
      smsRateLimitedUntil = Date.now() + 60000;
      throw new Error("Rate limited by Xano. Please wait 1 minute and try again.");
    }
    const raw = await res.text();
    throw new Error(raw || `Request failed (${res.status})`);
  }

  if (method !== "GET") {
    RESOURCE_CACHE.clear();
  }

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
  const cacheKey = `${XANO_SMS_BASE_URL}:${resource}`;
  const cached = RESOURCE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < RESOURCE_CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await xanoRequest("GET", `/${resource}`);
  let rows: AnyRecord[] = [];

  if (Array.isArray(data)) {
    rows = data as AnyRecord[];
  } else if (data && typeof data === "object") {
    const wrapped = data as AnyRecord;
    const candidates = [
      wrapped.items,
      wrapped.data,
      wrapped.result,
      wrapped.records,
      wrapped[resource],
    ];
    const firstArray = candidates.find((c) => Array.isArray(c));
    if (Array.isArray(firstArray)) rows = firstArray as AnyRecord[];
  }

  const normalized = rows.map(normalizeRecord);
  RESOURCE_CACHE.set(cacheKey, { ts: Date.now(), data: normalized });
  return normalized;
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

function toNumericId(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object") {
    const nested = firstDefined(value as AnyRecord, [
      "id",
      "classId",
      "studentId",
      "subjectId",
      "examId",
      "markId",
      "feeId",
      "attendanceId",
      "class_id",
      "student_id",
      "subject_id",
      "exam_id",
      "mark_id",
      "fee_id",
      "attendance_id",
    ]);
    return toNumericId(nested);
  }
  return 0;
}

function readId(obj: AnyRecord, keys: string[]): number {
  return toNumericId(firstDefined(obj, keys));
}

function getRollNo(obj: AnyRecord): string {
  const value = firstDefined(obj, ["rollNo", "rollno", "rollNumber", "roll_number", "roll", "admissionNo"], "");
  return String(value || "");
}

function getStudentName(obj: AnyRecord): string {
  const value = firstDefined(obj, ["name", "fullName", "full_name", "studentName", "student_name"], "");
  return String(value || "");
}

function normalizeDateOnly(value: unknown): string {
  const str = String(value || "");
  if (!str) return "";
  if (str.includes("T")) return str.slice(0, 10);
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
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
        const classId = readId(c, ["id", "classId", "class", "class_id"]);
        if (classId) classesById.set(classId, c);
      }

      const filtered = studentsRaw
        .filter((s) => {
          const studentClassId = readId(s, ["classId", "class", "class_id"]);
          const name = getStudentName(s).toLowerCase();
          const rollNo = getRollNo(s).toLowerCase();

          const classOk = !params?.classId || studentClassId === params.classId;
          const searchText = params?.search?.toLowerCase();
          const searchOk = !searchText || name.includes(searchText) || rollNo.includes(searchText);
          return classOk && searchOk;
        })
        .map((s) => {
          const studentClassId = readId(s, ["classId", "class", "class_id"]);
          const cls = classesById.get(studentClassId);
          return {
            ...s,
            name: getStudentName(s),
            classId: studentClassId,
            rollNo: getRollNo(s),
            class: cls
              ? {
                  id: readId(cls, ["id", "classId", "class", "class_id"]),
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
    mutationFn: async (data: InsertStudent) =>
      xanoRequest("POST", "/student", {
        ...data,
        name: data.name,
        fullName: data.name,
        full_name: data.name,
        rollNo: (data as AnyRecord).rollNo,
        roll_no: (data as AnyRecord).rollNo,
        roll_number: (data as AnyRecord).rollNo,
        classId: (data as AnyRecord).classId,
        class_id: (data as AnyRecord).classId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "students"] }),
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertStudent>) =>
      xanoRequest("PATCH", `/student/${id}`, {
        ...data,
        name: (data as AnyRecord).name,
        fullName: (data as AnyRecord).name,
        full_name: (data as AnyRecord).name,
        rollNo: (data as AnyRecord).rollNo,
        roll_no: (data as AnyRecord).rollNo,
        roll_number: (data as AnyRecord).rollNo,
        classId: (data as AnyRecord).classId,
        class_id: (data as AnyRecord).classId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "students"] }),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/student/${id}`),
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
        id: readId(cls, ["id", "classId", "class", "class_id"]),
        name: String(firstDefined(cls, ["name", "className", "title"], "") || ""),
        section: String(firstDefined(cls, ["section", "classSection"], "") || ""),
        classTeacherId: readId(cls, ["classTeacherId", "class_teacher_id", "teacherId", "teacher_id"]),
        classTeacherName: String(
          firstDefined(cls, ["classTeacherName", "class_teacher_name", "teacherName", "teacher_name"], "") || "",
        ),
        teacher: null,
      })).filter((cls) => cls.id > 0);
    },
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertClass) =>
      xanoRequest("POST", "/class", {
        ...data,
        classTeacherId: (data as AnyRecord).classTeacherId,
        class_teacher_id: (data as AnyRecord).classTeacherId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "classes"] }),
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertClass>) =>
      xanoRequest("PATCH", `/class/${id}`, {
        ...data,
        classTeacherId: (data as AnyRecord).classTeacherId,
        class_teacher_id: (data as AnyRecord).classTeacherId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "classes"] }),
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/class/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xano", "classes"] });
      queryClient.invalidateQueries({ queryKey: ["xano", "students"] });
      queryClient.invalidateQueries({ queryKey: ["xano", "subjects"] });
      queryClient.invalidateQueries({ queryKey: ["xano", "exams"] });
    },
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
        studentsById.set(readId(s, ["id", "studentId", "student", "student_id"]), s);
      }

      const classStudents = studentsRaw
        .filter((s) => readId(s, ["classId", "class", "class_id"]) === classId)
        .map((s) => ({
          id: readId(s, ["id", "studentId", "student", "student_id"]),
          name: getStudentName(s),
          rollNo: getRollNo(s),
        }));

      const reportMap = new Map<number, AnyRecord>();
      const selectedDate = normalizeDateOnly(date);
      for (const rec of attendanceRaw) {
        const recDate = normalizeDateOnly(firstDefined(rec, ["date", "attendanceDate", "attendance_date", "day"], ""));
        const recClass = readId(rec, ["classId", "class", "class_id"]);
        if (recDate !== selectedDate || recClass !== classId) continue;
        const sid = readId(rec, ["studentId", "student", "student_id"]);
        const st = studentsById.get(sid);
        reportMap.set(sid, {
          ...rec,
          student: {
            id: sid,
            name: getStudentName(st || {}),
            rollNo: getRollNo(st || {}),
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
    mutationFn: async (data: {
      classId: number;
      date: string;
      records: Array<{
        studentId: number;
        status: "PRESENT" | "ABSENT" | "LATE";
        id?: number | string;
      }>;
    }) => {
      await Promise.all(
        data.records.map((record) => {
          const attendanceId = toNumericId(record.id);
          if (attendanceId > 0) {
            return xanoRequest("PATCH", `/attendance/${attendanceId}`, {
              classId: data.classId,
              studentId: record.studentId,
              status: record.status,
              date: data.date,
            });
          }
          return xanoRequest("POST", "/attendance", {
            classId: data.classId,
            studentId: record.studentId,
            status: record.status,
            date: data.date,
          });
        }),
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

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/attendance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xano", "attendance"] });
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
      return exams.filter((exam) => readId(exam, ["classId", "class", "class_id"]) === classId);
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

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/exam/${id}`),
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
        studentsById.set(readId(s, ["id", "studentId", "student", "student_id"]), s);
      }

      return feesRaw.map((fee) => {
        const studentId = readId(fee, ["studentId", "student", "student_id"]);
        const student = studentsById.get(studentId);
        return {
          ...fee,
          studentId,
          paymentDate: firstDefined(
            fee,
            ["paymentDate", "payment_date", "date", "paidOn", "paid_on", "paymentDay", "day", "createdAt", "created_at"],
            null,
          ),
          student: student
            ? {
                id: studentId,
                name: getStudentName(student),
                rollNo: getRollNo(student),
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

export function useDeleteFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/fee/${id}`),
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
    staleTime: 60000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [students, attendance, fees] = await Promise.all([list("student"), list("attendance"), list("fee")]);
      const now = new Date();
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const todayUtc = now.toISOString().slice(0, 10);

      const presentToday = attendance.filter((a) => {
        const rawDate = firstDefined(a, ["date", "attendanceDate", "attendance_date", "day", "createdAt", "created_at"], "");
        const date = normalizeDateOnly(rawDate);
        const status = String(firstDefined(a, ["status", "attendanceStatus", "attendance_status"], "")).trim().toUpperCase();
        const isPresent = status === "PRESENT" || status === "P" || status === "1" || status === "TRUE";
        return isPresent && (date === todayLocal || date === todayUtc);
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
      const subjectsRaw = await list("subject");
      const subjects = subjectsRaw.map((s) => ({
        ...s,
        id: readId(s, ["id", "subjectId", "subject", "subject_id"]),
        classId: readId(s, ["classId", "class", "class_id"]),
        subjectTeacherId: readId(s, [
          "subjectTeacherId",
          "subject_teacher_id",
          "teacherId",
          "teacher_id",
          "facultyId",
          "faculty_id",
        ]),
        subjectTeacherName: String(
          firstDefined(
            s,
            ["subjectTeacherName", "subject_teacher_name", "teacherName", "teacher_name", "facultyName", "faculty_name"],
            "",
          ) || "",
        ),
      }));
      if (!classId) return subjects;
      return subjects.filter((s) => s.classId === classId);
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSubject & { subjectTeacherId?: number }) =>
      xanoRequest("POST", "/subject", {
        ...data,
        subjectTeacherId: (data as AnyRecord).subjectTeacherId,
        subject_teacher_id: (data as AnyRecord).subjectTeacherId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "subjects"] }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => xanoRequest("DELETE", `/subject/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["xano", "subjects"] }),
  });
}
