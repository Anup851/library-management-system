import { createContext, type ReactNode, useContext } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, Role, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "student";
};

type AuthContextType = {
  user: User | null;
  role: Role;
  isAdmin: boolean;
  isLibrarian: boolean;
  isStudent: boolean;
  canWrite: boolean;
  isLoading: boolean;
  error: Error | null;
  loginMutation: ReturnType<typeof useMutation<any, Error, LoginInput>>;
  registerMutation: ReturnType<typeof useMutation<any, Error, RegisterInput>>;
  logoutMutation: ReturnType<typeof useMutation<void, Error, void>>;
};

const TOKEN_STORAGE_KEY = "token";
const USER_QUERY_KEY = ["/api/auth/me"];

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeRole(value: unknown): Role {
  const raw = String(value || "student").trim().toLowerCase();
  if (raw === "admin") return "admin";
  if (raw === "librarian") return "librarian";
  return "student";
}

export function canWrite() {
  const role = normalizeRole(localStorage.getItem("role"));
  return role === "admin" || role === "librarian";
}

export function getRoleHome(_role?: Role) {
  return "/";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return null;

      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem("role");
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to load current user");
      }

      return response.json();
    },
  });

  const loginMutation = useMutation<any, Error, LoginInput>({
    mutationFn: async (credentials: LoginInput) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Unable to sign in");
      }

      return response.json();
    },
    onSuccess: (payload) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      localStorage.setItem("role", normalizeRole(payload.user?.role));
      queryClient.setQueryData(USER_QUERY_KEY, payload.user);
      setLocation("/");
      toast({
        title: "Signed in",
        description: "Your library workspace is ready.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<any, Error, RegisterInput>({
    mutationFn: async (payload: RegisterInput) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to create account");
      }

      return response.json();
    },
    onSuccess: (payload) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      localStorage.setItem("role", normalizeRole(payload.user?.role));
      queryClient.setQueryData(USER_QUERY_KEY, payload.user);
      setLocation("/");
      toast({
        title: "Account created",
        description: "Your library account is ready.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem("role");
    },
    onSuccess: () => {
      queryClient.setQueryData(USER_QUERY_KEY, null);
      setLocation("/");
      toast({
        title: "Signed out",
        description: "You have left the library workspace.",
      });
    },
  });

  const role = normalizeRole(user?.role ?? localStorage.getItem("role"));

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        role,
        isAdmin: role === "admin",
        isLibrarian: role === "librarian",
        isStudent: role === "student",
        canWrite: role === "admin" || role === "librarian",
        isLoading,
        error,
        loginMutation,
        registerMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
