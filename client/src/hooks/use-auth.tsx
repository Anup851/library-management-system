import { createContext, type ReactNode, useContext } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, Role, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/supabase-browser";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  registrationNumber: string;
  role: "student";
};

type GoogleAuthInput = {
  accessToken: string;
  registrationNumber?: string;
};

type RegistrationNumberInput = {
  registrationNumber: string;
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
  googleAuthMutation: ReturnType<typeof useMutation<any, Error, GoogleAuthInput>>;
  updateRegistrationNumberMutation: ReturnType<typeof useMutation<any, Error, RegistrationNumberInput>>;
  logoutMutation: ReturnType<typeof useMutation<void, Error, void>>;
  startGoogleAuth: (intent: "login" | "signup", registrationNumber?: string) => Promise<void>;
};

const TOKEN_STORAGE_KEY = "token";
const USER_QUERY_KEY = ["/api/auth/me"];

const AuthContext = createContext<AuthContextType | null>(null);

function getGoogleRedirectUrl() {
  const configured = String(import.meta.env.VITE_AUTH_REDIRECT_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return `${window.location.origin}/auth/callback`;
}

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

  const finalizeAuth = (payload: any, successTitle: string, successDescription: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    localStorage.setItem("role", normalizeRole(payload.user?.role));
    queryClient.setQueryData(USER_QUERY_KEY, payload.user);
    setLocation("/");
    toast({
      title: successTitle,
      description: successDescription,
    });
  };

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
    onSuccess: (payload) => finalizeAuth(payload, "Signed in", "Your library workspace is ready."),
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
    onSuccess: (payload) => finalizeAuth(payload, "Account created", "Your library account is ready."),
    onError: (error) => {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const googleAuthMutation = useMutation<any, Error, GoogleAuthInput>({
    mutationFn: async (payload: GoogleAuthInput) => {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to sign in with Google");
      }

      return response.json();
    },
    onSuccess: (payload) => finalizeAuth(payload, "Google account connected", "You are now signed in to LibraryHub."),
    onError: (error) => {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRegistrationNumberMutation = useMutation<any, Error, RegistrationNumberInput>({
    mutationFn: async (payload: RegistrationNumberInput) => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const response = await fetch("/api/auth/registration-number", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to save registration number");
      }

      return response.json();
    },
    onSuccess: (payload) => finalizeAuth(payload, "Profile updated", "Your registration number has been saved."),
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startGoogleAuth = async (intent: "login" | "signup", registrationNumber?: string) => {
    try {
      const redirectUrl = getGoogleRedirectUrl();
      sessionStorage.setItem("google-auth-intent", intent);
      sessionStorage.setItem("google-auth-redirect-url", redirectUrl);
      if (registrationNumber) {
        sessionStorage.setItem("google-auth-registration-number", registrationNumber);
      } else {
        sessionStorage.removeItem("google-auth-registration-number");
      }

      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      toast({
        title: "Google sign-in failed",
        description: error instanceof Error ? error.message : "Unable to start Google sign-in",
        variant: "destructive",
      });
    }
  };

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await supabaseBrowser.auth.signOut();
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
        googleAuthMutation,
        updateRegistrationNumberMutation,
        logoutMutation,
        startGoogleAuth,
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
