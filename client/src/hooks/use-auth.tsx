import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: any;
  logoutMutation: any;
  registerMutation: any;
};

const AuthContext = createContext<AuthContextType | null>(null);
const XANO_AUTH_BASE_URL = (import.meta.env.VITE_XANO_AUTH_URL as string | undefined)?.replace(/\/$/, "") || "/api";
const authUrl = (path: string) => `${XANO_AUTH_BASE_URL}${path}`;
let authRateLimitedUntil = 0;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
      const token = localStorage.getItem("token");
      if (!token) return null;
      
      const res = await fetch(authUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 429) {
        authRateLimitedUntil = Date.now() + 60000;
        throw new Error("Too many auth requests. Please wait 1 minute.");
      }
      if (res.status === 401) {
        localStorage.removeItem("token");
        return null;
      }
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      if (Date.now() < authRateLimitedUntil) {
        throw new Error("Too many login attempts. Wait 1 minute and try again.");
      }
      const res = await fetch(authUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        if (res.status === 429) {
          authRateLimitedUntil = Date.now() + 60000;
          throw new Error("Too many login attempts. Wait 1 minute and try again.");
        }
        const raw = await res.text();
        let message = `Login failed (${res.status})`;
        try {
          const parsed = JSON.parse(raw);
          message =
            parsed?.message ||
            parsed?.error ||
            parsed?.error_message ||
            message;
        } catch {
          if (raw) message = raw;
        }
        throw new Error(message);
      }
      return await res.json();
    },
    onSuccess: (data) => {
      const token = data?.authToken || data?.token;
      if (!token) {
        throw new Error("Login succeeded but no auth token was returned");
      }
      localStorage.setItem("token", token);
      refetch();
      setLocation("/");
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

  const registerMutation = useMutation({
    mutationFn: async (newUser: InsertUser) => {
      const res = await fetch(authUrl("/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.username,
          password: newUser.password,
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
      localStorage.removeItem("token");
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

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
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
