
import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Enums ===
export const userRoles = ["ADMIN", "TEACHER", "STUDENT"] as const;
export const studentStatus = ["ACTIVE", "INACTIVE"] as const;
export const attendanceStatus = ["PRESENT", "ABSENT", "LATE"] as const;
export const feePaymentMethod = ["CASH", "ONLINE", "CHEQUE"] as const;

// === USERS (Auth) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // email
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("STUDENT"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CLASSES ===
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Class 10"
  section: text("section").notNull(), // e.g., "A"
  classTeacherId: integer("class_teacher_id").references(() => users.id),
});

// === STUDENTS ===
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Link to user for login
  rollNo: text("roll_no").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gender: text("gender"),
  dob: date("dob"),
  address: text("address"),
  classId: integer("class_id").references(() => classes.id).notNull(),
  admissionDate: date("admission_date").defaultNow(),
  status: text("status", { enum: studentStatus }).default("ACTIVE"),
});

// === SUBJECTS ===
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(),
});

// === ATTENDANCE ===
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  date: date("date").notNull(),
  status: text("status", { enum: attendanceStatus }).notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(), // Denormalized for easier querying
});

// === EXAMS ===
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., "Midterm 2024"
  classId: integer("class_id").references(() => classes.id).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
});

// === MARKS ===
export const marks = pgTable("marks", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").references(() => exams.id).notNull(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  score: decimal("score").notNull(),
  maxScore: decimal("max_score").notNull().default("100"),
});

// === FEES ===
export const fees = pgTable("fees", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  amount: decimal("amount").notNull(),
  paymentDate: date("payment_date").defaultNow(),
  method: text("method", { enum: feePaymentMethod }).notNull(),
  receiptNo: text("receipt_no").notNull().unique(),
  description: text("description"), // e.g. "Tuition Fee March"
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ one, many }) => ({
  teacherClass: one(classes, {
    fields: [users.id],
    references: [classes.classTeacherId],
  }),
  studentProfile: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classes.classTeacherId],
    references: [users.id],
  }),
  students: many(students),
  subjects: many(subjects),
  exams: many(exams),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  attendance: many(attendance),
  marks: many(marks),
  fees: many(fees),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  class: one(classes, {
    fields: [exams.classId],
    references: [classes.id],
  }),
  marks: many(marks),
}));

// === ZOD SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export const insertExamSchema = createInsertSchema(exams).omit({ id: true });
export const insertMarkSchema = createInsertSchema(marks).omit({ id: true });
export const insertFeeSchema = createInsertSchema(fees).omit({ id: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Mark = typeof marks.$inferSelect;
export type InsertMark = z.infer<typeof insertMarkSchema>;
export type Fee = typeof fees.$inferSelect;
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Role = "admin" | "student" | "parent";
