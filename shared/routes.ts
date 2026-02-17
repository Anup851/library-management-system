
import { z } from 'zod';
import { 
  insertUserSchema, insertStudentSchema, insertClassSchema, 
  insertSubjectSchema, insertAttendanceSchema, insertExamSchema, 
  insertMarkSchema, insertFeeSchema,
  users, students, classes, subjects, attendance, exams, marks, fees
} from './schema';

// === ERROR SCHEMAS ===
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// === API CONTRACT ===
export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        username: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          token: z.string(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    }
  },
  
  students: {
    list: {
      method: 'GET' as const,
      path: '/api/students' as const,
      input: z.object({
        classId: z.coerce.number().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        search: z.string().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.object({
          data: z.array(z.custom<typeof students.$inferSelect & { class: typeof classes.$inferSelect }>()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/students/:id' as const,
      responses: {
        200: z.custom<typeof students.$inferSelect & { class: typeof classes.$inferSelect }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/students' as const,
      input: insertStudentSchema,
      responses: {
        201: z.custom<typeof students.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/students/:id' as const,
      input: insertStudentSchema.partial(),
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/students/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  classes: {
    list: {
      method: 'GET' as const,
      path: '/api/classes' as const,
      responses: {
        200: z.array(z.custom<typeof classes.$inferSelect & { teacher: typeof users.$inferSelect | null }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/classes' as const,
      input: insertClassSchema,
      responses: {
        201: z.custom<typeof classes.$inferSelect>(),
      },
    },
  },

  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects' as const,
      input: z.object({ classId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof subjects.$inferSelect & { class: typeof classes.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects' as const,
      input: insertSubjectSchema,
      responses: {
        201: z.custom<typeof subjects.$inferSelect>(),
      },
    },
  },

  attendance: {
    mark: {
      method: 'POST' as const,
      path: '/api/attendance' as const,
      input: z.object({
        classId: z.number(),
        date: z.string(), // YYYY-MM-DD
        records: z.array(z.object({
          studentId: z.number(),
          status: z.enum(["PRESENT", "ABSENT", "LATE"]),
        })),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    getReport: {
      method: 'GET' as const,
      path: '/api/attendance/report' as const,
      input: z.object({
        classId: z.coerce.number(),
        date: z.string(),
      }),
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect & { student: typeof students.$inferSelect }>()),
      },
    },
  },

  exams: {
    list: {
      method: 'GET' as const,
      path: '/api/exams' as const,
      input: z.object({ classId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof exams.$inferSelect & { class: typeof classes.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/exams' as const,
      input: insertExamSchema,
      responses: {
        201: z.custom<typeof exams.$inferSelect>(),
      },
    },
  },

  marks: {
    update: {
      method: 'POST' as const,
      path: '/api/marks' as const,
      input: z.object({
        examId: z.number(),
        subjectId: z.number(),
        marks: z.array(z.object({
          studentId: z.number(),
          score: z.number(),
          maxScore: z.number().default(100),
        })),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    getByStudent: {
      method: 'GET' as const,
      path: '/api/students/:id/marks' as const,
      responses: {
        200: z.array(z.custom<typeof marks.$inferSelect & { exam: typeof exams.$inferSelect, subject: typeof subjects.$inferSelect }>()),
      },
    },
  },
  
  fees: {
    create: {
      method: 'POST' as const,
      path: '/api/fees' as const,
      input: insertFeeSchema,
      responses: {
        201: z.custom<typeof fees.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/fees' as const,
      responses: {
        200: z.array(z.custom<typeof fees.$inferSelect & { student: typeof students.$inferSelect }>()),
      },
    },
  },

  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats' as const,
      responses: {
        200: z.object({
          totalStudents: z.number(),
          presentToday: z.number(),
          feesCollected: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
