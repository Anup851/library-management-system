
import { db } from "./db";
import {
  users, students, classes, subjects, attendance, exams, marks, fees,
  type InsertUser, type InsertStudent, type InsertClass, 
  type InsertSubject, type InsertAttendance, type InsertExam, 
  type InsertMark, type InsertFee,
  type User, type Student, type Class, type Subject, type Attendance, type Exam, type Mark, type Fee
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Students
  getStudents(params?: { classId?: number, status?: string, search?: string, page?: number, limit?: number }): Promise<{ data: (Student & { class: Class })[], total: number }>;
  getStudent(id: number): Promise<(Student & { class: Class }) | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student>;
  deleteStudent(id: number): Promise<void>;

  // Classes
  getClasses(): Promise<(Class & { teacher: User | null })[]>;
  createClass(cls: InsertClass): Promise<Class>;

  // Subjects
  getSubjects(classId?: number): Promise<(Subject & { class: Class })[]>;
  createSubject(subject: InsertSubject): Promise<Subject>;

  // Attendance
  markAttendance(records: InsertAttendance[]): Promise<void>;
  getAttendance(classId: number, date: string): Promise<(Attendance & { student: Student })[]>;

  // Exams
  getExams(classId?: number): Promise<(Exam & { class: Class })[]>;
  createExam(exam: InsertExam): Promise<Exam>;

  // Marks
  updateMarks(marks: InsertMark[]): Promise<void>;
  getMarksByStudent(studentId: number): Promise<(Mark & { exam: Exam, subject: Subject })[]>;

  // Fees
  createFee(fee: InsertFee): Promise<Fee>;
  getFees(): Promise<(Fee & { student: Student })[]>;
  
  // Dashboard
  getDashboardStats(): Promise<{ totalStudents: number; presentToday: number; feesCollected: number }>;
}

export class DatabaseStorage implements IStorage {
  // === Users ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // === Students ===
  async getStudents(params: { classId?: number, status?: string, search?: string, page?: number, limit?: number } = {}): Promise<{ data: (Student & { class: Class })[], total: number }> {
    const conditions = [];
    if (params.classId) conditions.push(eq(students.classId, params.classId));
    if (params.status) conditions.push(eq(students.status, params.status as any));
    // Simple search implementation
    
    const limit = params.limit || 100;
    const offset = ((params.page || 1) - 1) * limit;

    const baseQuery = db.select({
      student: students,
      class: classes
    }).from(students).leftJoin(classes, eq(students.classId, classes.id));
    
    // Apply filters
    if (conditions.length > 0) {
      // @ts-ignore
      baseQuery.where(and(...conditions));
    }
    
    const results = await baseQuery.limit(limit).offset(offset);
    
    // Get total count
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(students); // simplified count

    return {
      data: results.map(r => ({ ...r.student, class: r.class! })),
      total: Number(countResult.count)
    };
  }

  async getStudent(id: number): Promise<(Student & { class: Class }) | undefined> {
    const [result] = await db.select({
      student: students,
      class: classes
    }).from(students).leftJoin(classes, eq(students.classId, classes.id)).where(eq(students.id, id));
    
    if (!result) return undefined;
    return { ...result.student, class: result.class! };
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async updateStudent(id: number, updates: Partial<InsertStudent>): Promise<Student> {
    const [updated] = await db.update(students).set(updates).where(eq(students.id, id)).returning();
    return updated;
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  // === Classes ===
  async getClasses(): Promise<(Class & { teacher: User | null })[]> {
    const results = await db.select({
      class: classes,
      teacher: users
    }).from(classes).leftJoin(users, eq(classes.classTeacherId, users.id));
    
    return results.map(r => ({ ...r.class, teacher: r.teacher }));
  }

  async createClass(cls: InsertClass): Promise<Class> {
    const [newClass] = await db.insert(classes).values(cls).returning();
    return newClass;
  }

  // === Subjects ===
  async getSubjects(classId?: number): Promise<(Subject & { class: Class })[]> {
    const baseQuery = db.select({
      subject: subjects,
      class: classes
    }).from(subjects).leftJoin(classes, eq(subjects.classId, classes.id));

    if (classId) {
      baseQuery.where(eq(subjects.classId, classId));
    }

    const results = await baseQuery;
    return results.map(r => ({ ...r.subject, class: r.class! }));
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject).returning();
    return newSubject;
  }

  // === Attendance ===
  async markAttendance(records: InsertAttendance[]): Promise<void> {
    // Upsert logic would be better here, but for now insert
    // In production: check if exists for date/student and update, else insert
    for (const record of records) {
      await db.insert(attendance).values(record).returning();
    }
  }

  async getAttendance(classId: number, date: string): Promise<(Attendance & { student: Student })[]> {
    const results = await db.select({
      attendance: attendance,
      student: students
    }).from(attendance)
      .leftJoin(students, eq(attendance.studentId, students.id))
      .where(and(eq(attendance.classId, classId), eq(attendance.date, date)));
      
    return results.map(r => ({ ...r.attendance, student: r.student! }));
  }

  // === Exams ===
  async getExams(classId?: number): Promise<(Exam & { class: Class })[]> {
    const baseQuery = db.select({
      exam: exams,
      class: classes
    }).from(exams).leftJoin(classes, eq(exams.classId, classes.id));
    
    if (classId) {
      baseQuery.where(eq(exams.classId, classId));
    }
    
    const results = await baseQuery;
    return results.map(r => ({ ...r.exam, class: r.class! }));
  }

  async createExam(exam: InsertExam): Promise<Exam> {
    const [newExam] = await db.insert(exams).values(exam).returning();
    return newExam;
  }

  // === Marks ===
  async updateMarks(markRecords: InsertMark[]): Promise<void> {
    for (const mark of markRecords) {
      // Upsert-like behavior: delete existing if any, then insert
      await db.delete(marks).where(and(
        eq(marks.examId, mark.examId),
        eq(marks.studentId, mark.studentId),
        eq(marks.subjectId, mark.subjectId)
      ));
      await db.insert(marks).values(mark);
    }
  }

  async getMarksByStudent(studentId: number): Promise<(Mark & { exam: Exam, subject: Subject })[]> {
    const results = await db.select({
      mark: marks,
      exam: exams,
      subject: subjects
    }).from(marks)
      .leftJoin(exams, eq(marks.examId, exams.id))
      .leftJoin(subjects, eq(marks.subjectId, subjects.id))
      .where(eq(marks.studentId, studentId));
      
    return results.map(r => ({ ...r.mark, exam: r.exam!, subject: r.subject! }));
  }

  // === Fees ===
  async createFee(fee: InsertFee): Promise<Fee> {
    const [newFee] = await db.insert(fees).values(fee).returning();
    return newFee;
  }

  async getFees(): Promise<(Fee & { student: Student })[]> {
    const results = await db.select({
      fee: fees,
      student: students
    }).from(fees).leftJoin(students, eq(fees.studentId, students.id)).orderBy(desc(fees.paymentDate));
    
    return results.map(r => ({ ...r.fee, student: r.student! }));
  }

  // === Dashboard ===
  async getDashboardStats(): Promise<{ totalStudents: number; presentToday: number; feesCollected: number }> {
    const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
    const [attendanceCount] = await db.select({ count: sql<number>`count(*)` })
      .from(attendance)
      .where(and(
        eq(attendance.date, new Date().toISOString().split('T')[0]),
        eq(attendance.status, "PRESENT")
      ));
    
    // Sum fees for current month
    // Simplified: just total fees for now
    const [feesResult] = await db.select({ total: sql<number>`sum(amount)` }).from(fees);

    return {
      totalStudents: Number(studentCount?.count || 0),
      presentToday: Number(attendanceCount?.count || 0),
      feesCollected: Number(feesResult?.total || 0),
    };
  }
}

export const storage = new DatabaseStorage();
