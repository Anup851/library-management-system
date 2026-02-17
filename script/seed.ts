
import { storage } from "../server/storage";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("Seeding database...");

  // 1. Admin
  const adminEmail = "admin@sms.com";
  let admin = await storage.getUserByUsername(adminEmail);
  if (!admin) {
    console.log("Creating admin...");
    admin = await storage.createUser({
      username: adminEmail,
      password: await hash("Admin@123"),
      name: "System Admin",
      role: "ADMIN"
    });
  } else {
    console.log("Admin already exists.");
  }

  // 2. Classes
  const classes = await storage.getClasses();
  if (classes.length === 0) {
    console.log("Creating classes...");
    const class10A = await storage.createClass({ name: "Class 10", section: "A" });
    const class10B = await storage.createClass({ name: "Class 10", section: "B" });

    // 3. Subjects
    console.log("Creating subjects...");
    await storage.createSubject({ name: "Mathematics", code: "MATH101", classId: class10A.id });
    await storage.createSubject({ name: "Science", code: "SCI101", classId: class10A.id });
    await storage.createSubject({ name: "English", code: "ENG101", classId: class10A.id });
    
    await storage.createSubject({ name: "Mathematics", code: "MATH101", classId: class10B.id });
    await storage.createSubject({ name: "Science", code: "SCI101", classId: class10B.id });

    // 4. Students
    console.log("Creating students...");
    // 5 students for 10A
    for (let i = 1; i <= 5; i++) {
      // Create user first
      const studentEmail = `studentA${i}@sms.com`;
      let user = await storage.getUserByUsername(studentEmail);
      if (!user) {
        user = await storage.createUser({
          username: studentEmail,
          password: await hash("Student@123"),
          name: `Student A${i}`,
          role: "STUDENT"
        });
      }

      await storage.createStudent({
        userId: user.id,
        rollNo: `10A0${i}`,
        name: `Student A${i}`,
        classId: class10A.id,
        status: "ACTIVE",
        email: studentEmail,
        phone: "1234567890",
        address: "123 School Lane"
      });
    }

    // 5 students for 10B
    for (let i = 1; i <= 5; i++) {
       // Create user first
      const studentEmail = `studentB${i}@sms.com`;
      let user = await storage.getUserByUsername(studentEmail);
      if (!user) {
        user = await storage.createUser({
          username: studentEmail,
          password: await hash("Student@123"),
          name: `Student B${i}`,
          role: "STUDENT"
        });
      }

      await storage.createStudent({
        userId: user.id,
        rollNo: `10B0${i}`,
        name: `Student B${i}`,
        classId: class10B.id,
        status: "ACTIVE",
        email: studentEmail,
        phone: "1234567890",
        address: "456 School Lane"
      });
    }
  } else {
    console.log("Classes already exist, skipping seed.");
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
