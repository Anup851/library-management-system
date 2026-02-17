import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  Student, Class, Subject, Exam, Mark, Fee, Attendance, 
  InsertStudent, InsertClass, InsertSubject, InsertExam, InsertFee
} from "@shared/schema";
import { z } from "zod";

// === STUDENTS ===
export function useStudents(params?: { classId?: number; search?: string }) {
  return useQuery({
    queryKey: [api.students.list.path, params],
    queryFn: async () => {
      const url = buildUrl(api.students.list.path);
      const searchParams = new URLSearchParams();
      if (params?.classId) searchParams.append("classId", params.classId.toString());
      if (params?.search) searchParams.append("search", params.search);
      
      const res = await fetch(`${url}?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return await res.json(); // Validated by Zod in component or assumed safe for MVP
    },
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: [api.students.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.students.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch student");
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStudent) => {
      const res = await fetch(api.students.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create student");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.students.list.path] }),
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertStudent>) => {
      const url = buildUrl(api.students.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update student");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.students.get.path] });
    },
  });
}

// === CLASSES ===
export function useClasses() {
  return useQuery({
    queryKey: [api.classes.list.path],
    queryFn: async () => {
      const res = await fetch(api.classes.list.path);
      if (!res.ok) throw new Error("Failed to fetch classes");
      return await res.json();
    },
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertClass) => {
      const res = await fetch(api.classes.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create class");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.classes.list.path] }),
  });
}

// === ATTENDANCE ===
export function useAttendanceReport(classId: number, date: string) {
  return useQuery({
    queryKey: [api.attendance.getReport.path, classId, date],
    queryFn: async () => {
      const url = `${api.attendance.getReport.path}?classId=${classId}&date=${date}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return await res.json();
    },
    enabled: !!classId && !!date,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.attendance.mark.input>) => {
      const res = await fetch(api.attendance.mark.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.getReport.path, variables.classId, variables.date] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}

// === EXAMS & MARKS ===
export function useExams(classId?: number) {
  return useQuery({
    queryKey: [api.exams.list.path, classId],
    queryFn: async () => {
      const url = classId ? `${api.exams.list.path}?classId=${classId}` : api.exams.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch exams");
      return await res.json();
    },
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertExam) => {
      const res = await fetch(api.exams.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create exam");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.exams.list.path] }),
  });
}

export function useUpdateMarks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.marks.update.input>) => {
      const res = await fetch(api.marks.update.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update marks");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.marks.getByStudent.path] }),
  });
}

// === FEES ===
export function useFees() {
  return useQuery({
    queryKey: [api.fees.list.path],
    queryFn: async () => {
      const res = await fetch(api.fees.list.path);
      if (!res.ok) throw new Error("Failed to fetch fees");
      return await res.json();
    },
  });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFee) => {
      const res = await fetch(api.fees.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record fee");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fees.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}

// === DASHBOARD ===
export function useDashboardStats() {
  return useQuery({
    queryKey: [api.dashboard.stats.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.stats.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    },
  });
}

// === SUBJECTS ===
export function useSubjects(classId?: number) {
  return useQuery({
    queryKey: [api.subjects.list.path, classId],
    queryFn: async () => {
      const url = classId ? `${api.subjects.list.path}?classId=${classId}` : api.subjects.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return await res.json();
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSubject) => {
      const res = await fetch(api.subjects.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] }),
  });
}
