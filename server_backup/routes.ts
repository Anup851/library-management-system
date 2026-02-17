
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import cors from "cors";
import helmet from "helmet";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const scryptAsync = promisify(scrypt);

// Simple JWT-like implementation for Lite Build (no external auth provider)
// In production, use Replit Auth or a proper JWT library with secrets
const SESSIONS = new Map<string, number>(); // token -> userId

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(stored: string, supplied: string) {
  const [hashed, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashed, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Middleware
  app.use(cors());
  app.use(helmet());
  app.use((req, res, next) => {
    // Simple mock auth middleware
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const userId = SESSIONS.get(token);
      if (userId) {
        // @ts-ignore
        req.user = { id: userId };
      }
    }
    next();
  });

  // Swagger Setup
  const swaggerOptions = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Student Management System API",
        version: "1.0.0",
        description: "API documentation for the Student Management System",
      },
      servers: [
        {
          url: "/",
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    apis: ["./server/routes.ts"], 
  };

  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await comparePassword(user.password, password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const token = randomBytes(32).toString("hex");
      SESSIONS.set(token, user.id);
      
      res.json({ user, token });
    } catch (e) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) return res.status(400).json({ message: "Username exists" });

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      res.status(201).json(user);
    } catch (e) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    // @ts-ignore
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    // @ts-ignore
    const user = await storage.getUser(req.user.id);
    res.json(user);
  });

  // === STUDENTS ===
  app.get(api.students.list.path, async (req, res) => {
    const params = api.students.list.input?.parse(req.query) || {};
    const result = await storage.getStudents(params);
    res.json(result);
  });

  app.get(api.students.get.path, async (req, res) => {
    const student = await storage.getStudent(Number(req.params.id));
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  app.post(api.students.create.path, async (req, res) => {
    try {
      const input = api.students.create.input.parse(req.body);
      const student = await storage.createStudent(input);
      res.status(201).json(student);
    } catch (e) {
      if (e instanceof z.ZodError) res.status(400).json({ message: e.message });
      else res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.students.update.path, async (req, res) => {
    try {
      const input = api.students.update.input.parse(req.body);
      const student = await storage.updateStudent(Number(req.params.id), input);
      res.json(student);
    } catch (e) {
      res.status(400).json({ message: "Error updating student" });
    }
  });

  // === CLASSES ===
  app.get(api.classes.list.path, async (req, res) => {
    const classes = await storage.getClasses();
    res.json(classes);
  });

  app.post(api.classes.create.path, async (req, res) => {
    const input = api.classes.create.input.parse(req.body);
    const cls = await storage.createClass(input);
    res.status(201).json(cls);
  });

  // === SUBJECTS ===
  app.get(api.subjects.list.path, async (req, res) => {
    const params = api.subjects.list.input?.parse(req.query) || {};
    const subjects = await storage.getSubjects(params.classId);
    res.json(subjects);
  });

  app.post(api.subjects.create.path, async (req, res) => {
    const input = api.subjects.create.input.parse(req.body);
    const subject = await storage.createSubject(input);
    res.status(201).json(subject);
  });

  // === ATTENDANCE ===
  app.post(api.attendance.mark.path, async (req, res) => {
    const { date, records, classId } = api.attendance.mark.input.parse(req.body);
    await storage.markAttendance(records.map(r => ({ ...r, date, classId })));
    res.json({ message: "Attendance marked" });
  });

  app.get(api.attendance.getReport.path, async (req, res) => {
    const { classId, date } = api.attendance.getReport.input.parse(req.query);
    const report = await storage.getAttendance(classId, date);
    res.json(report);
  });

  // === EXAMS ===
  app.get(api.exams.list.path, async (req, res) => {
    const params = api.exams.list.input?.parse(req.query);
    const exams = await storage.getExams(params?.classId);
    res.json(exams);
  });

  app.post(api.exams.create.path, async (req, res) => {
    const input = api.exams.create.input.parse(req.body);
    const exam = await storage.createExam(input);
    res.status(201).json(exam);
  });

  // === MARKS ===
  app.post(api.marks.update.path, async (req, res) => {
    const { examId, subjectId, marks } = api.marks.update.input.parse(req.body);
    await storage.updateMarks(marks.map(m => ({ ...m, examId, subjectId })));
    res.json({ message: "Marks updated" });
  });

  app.get(api.marks.getByStudent.path, async (req, res) => {
    const marks = await storage.getMarksByStudent(Number(req.params.id));
    res.json(marks);
  });

  // === FEES ===
  app.get(api.fees.list.path, async (req, res) => {
    const fees = await storage.getFees();
    res.json(fees);
  });

  app.post(api.fees.create.path, async (req, res) => {
    const input = api.fees.create.input.parse(req.body);
    const fee = await storage.createFee(input);
    res.status(201).json(fee);
  });

  // === DASHBOARD ===
  app.get(api.dashboard.stats.path, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // === SEED DATA FUNCTION ===
  // Call this manually or on startup if needed
  async function seed() {
    const admin = await storage.getUserByUsername("admin@sms.com");
    if (!admin) {
      console.log("Seeding admin...");
      const hashedPassword = await hashPassword("Admin@123");
      await storage.createUser({
        username: "admin@sms.com",
        password: hashedPassword,
        name: "Super Admin",
        role: "ADMIN"
      });
    }
  }
  
  // Run seed on startup (async, don't await)
  seed().catch(console.error);

  return httpServer;
}
