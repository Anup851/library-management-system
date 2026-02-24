import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, type Role } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  role: Role;
  isAdmin: boolean;
  isStudent: boolean;
  isParent: boolean;
  canWrite: boolean;
  isLoading: boolean;
  error: Error | null;
  loginMutation: any;
  logoutMutation: any;
  registerMutation: any;
};

const AuthContext = createContext<AuthContextType | null>(null);
const rawAuthBase = (import.meta.env.VITE_XANO_AUTH_URL as string | undefined) || "/api";
const normalizedAuthBase = rawAuthBase.replace(/\/$/, "").replace(/\/?api:/, "/api:");
const XANO_AUTH_BASE_URL = normalizedAuthBase;
const authUrl = (path: string) => `${XANO_AUTH_BASE_URL}${path}`;
let authRateLimitedUntil = 0;
const TOKEN_STORAGE_KEY = "token";
const ROLE_STORAGE_KEY = "role";

const VALID_ROLES: Role[] = ["admin", "student", "parent"];

function normalizeRole(value: unknown): Role {
  if (!value) return "student";
  const raw = String(value).trim().toLowerCase();
  if (VALID_ROLES.includes(raw as Role)) return raw as Role;
  if (raw === "teacher") return "admin";
  if (raw === "student") return "student";
  if (raw === "parent") return "parent";
  if (raw === "admin") return "admin";
  if (raw === "administrator") return "admin";
  if (raw === "guardian") return "parent";
  return "student";
}

function setStoredRole(role: Role) {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

export function getRole(): Role {
  return normalizeRole(localStorage.getItem(ROLE_STORAGE_KEY));
}

export function canWrite(): boolean {
  return getRole() === "admin";
}

export function getRoleHome(role?: Role): string {
  const normalized = normalizeRole(role ?? getRole());
  return normalized === "admin" ? "/" : "/portal";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<User | null, Error>({
    queryKey: [authUrl("/auth/me")],
    queryFn: async () => {
      if (Date.now() < authRateLimitedUntil) {
        throw new Error("Auth temporarily rate-limited. Please wait and retry.");
      }
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return null;
      
      const res = await fetch(authUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 429) {
        authRateLimitedUntil = Date.now() + 60000;
        throw new Error("Too many auth requests. Please wait 1 minute.");
      }
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(ROLE_STORAGE_KEY);
        return null;
      }
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
    onSuccess: (data) => {
      if (data) {
        setStoredRole(normalizeRole((data as any)?.role));
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      if (Date.now() < authRateLimitedUntil) {
        throw new Error("Too many login attempts. Wait 1 minute and try again.");
      }
      const email = credentials.email.trim();
      const password = credentials.password;
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }
      console.log("[auth] sending login payload", { email, password: "***" });
      const res = await fetch(authUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          authRateLimitedUntil = Date.now() + 60000;
          throw new Error("Too many login attempts. Wait 1 minute and try again.");
        }
        let message = `Login failed (${res.status})`;
        try {
          const parsed = await res.json();
          message = parsed?.message || parsed?.error || parsed?.error_message || message;
        } catch {
          const raw = await res.text();
          if (raw) message = raw;
        }
        throw new Error(message);
      }
      const payload = await res.json();
      return payload;
    },
    onSuccess: (payload: any) => {
      const token = payload?.authToken || payload?.token;
      if (!token) {
        throw new Error("Login succeeded but no auth token was returned");
      }
      if (payload?.user) {
        queryClient.setQueryData([authUrl("/auth/me")], payload.user);
      }
      const role = normalizeRole(payload?.user?.role ?? payload?.role);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setStoredRole(role);
      refetch();
      setLocation(getRoleHome(role));
      toast({
        title: "Welcome back!",
        description: "You are now signed in.",
      });
    },
    onError: (error: Error) => {
      const isRateLimit = /429|rate limit|too many/i.test(error.message);
      toast({
        title: "Login failed",
        description: isRateLimit
          ? "Too many login attempts. Wait 1-2 minutes, then try again."
          : error.message,
        variant: "destructive",
      });
    },
  });

  type RegisterPayload = {
    name: string;
    email: string;
    password: string;
    role: Role;
    studentId?: number;
    childIds?: number[];
  };

  const registerMutation = useMutation({
    mutationFn: async (newUser: RegisterPayload) => {
      const res = await fetch(authUrl("/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          username: newUser.email,
          password: newUser.password,
          role: newUser.role,
          student_id: newUser.studentId,
          child_ids: newUser.childIds,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "You can now login with your credentials",
      });
      setLocation("/auth/login");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      // No backend call needed for JWT/localStorage auth
    },
    onSuccess: () => {
      refetch(); // Will return null
      setLocation("/auth/login");
      toast({
        title: "Logged out",
        description: "See you soon!",
      });
    },
  });

  const role = normalizeRole((user as any)?.role ?? localStorage.getItem(ROLE_STORAGE_KEY));
  const isAdmin = role === "admin";
  const isStudent = role === "student";
  const isParent = role === "parent";
  const canWriteFlag = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        role,
        isAdmin,
        isStudent,
        isParent,
        canWrite: canWriteFlag,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
