import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { Role, User } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "library-dev-secret";

export type SafeUser = User;

export function createPasswordHash(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: User) {
  return jwt.sign(
    {
      sub: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    role: Role;
  };
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: Role };
    req.auth = {
      userId: payload.sub,
      role: payload.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(allowed: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}
