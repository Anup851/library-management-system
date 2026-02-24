import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, GraduationCap } from "lucide-react";
import { useState } from "react";
import type { Role } from "@shared/schema";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z
  .object({
    role: z.enum(["student", "parent"]),
    studentName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    parentEmail: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .superRefine((data, ctx) => {
    if (data.role === "student" && !data.studentName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Student name is required",
        path: ["studentName"],
      });
    }
  });

export default function AuthLogin() {
  const { loginMutation, registerMutation } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("admin");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupRole, setSignupRole] = useState<"student" | "parent">("student");
  const [signupStudentName, setSignupStudentName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    setLoginError(null);
    const email = data.email.trim();
    if (!email || !data.password) {
      setLoginError("Email and password are required.");
      return;
    }
    loginMutation.mutate(
      { email, password: data.password },
      {
        onError: (err: any) => {
          setLoginError(err?.message || "Login failed. Please try again.");
        },
      }
    );
  };

  const onSignupSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("[auth] signup submit", {
      role: signupRole,
      studentName: signupStudentName,
      email: signupEmail,
    });
    setSignupError(null);
    const parsed = signupSchema.safeParse({
      role: signupRole,
      studentName: signupStudentName,
      email: signupEmail,
      password: signupPassword,
    });
    if (!parsed.success) {
      setSignupError(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    const data = parsed.data;
    const derivedEmail = String(data.email).trim().toLowerCase();
    const derivedName =
      signupRole === "student"
        ? data.studentName?.trim() || "Student"
        : (derivedEmail.split("@")[0] || "Parent");

    registerMutation.mutate({
      name: derivedName,
      email: derivedEmail,
      password: data.password,
      role: data.role,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl shadow-blue-900/10">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 rotate-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display font-bold text-foreground">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? "Sign in to your EduMaster account" : "Register using Student ID"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </Button>
          </div>

          {mode === "login" ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6" autoComplete="off">
                <div className="space-y-2">
                  <FormLabel>Login as</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {(["admin", "student", "parent"] as Role[]).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={role === option ? "default" : "outline"}
                        className="h-10 capitalize"
                        onClick={() => setRole(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="admin@school.com"
                          className="h-11 bg-secondary/30"
                          autoComplete="email"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="********"
                          className="h-11 bg-secondary/30"
                          autoComplete="current-password"
                          onMouseEnter={() => setShowLoginPassword(true)}
                          onMouseLeave={() => setShowLoginPassword(false)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
                </Button>
                {loginError && (
                  <p className="text-sm font-medium text-destructive">{loginError}</p>
                )}
              </form>
            </Form>
          ) : (
            <form onSubmit={onSignupSubmit} className="space-y-5" autoComplete="off">
              <div className="space-y-2">
                <Label>Sign up as</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["student", "parent"] as Role[]).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={signupRole === option ? "default" : "outline"}
                      className="h-10 capitalize"
                      onClick={() => setSignupRole(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
              {signupRole === "student" && (
                <div className="space-y-2">
                  <Label>Student Name</Label>
                  <Input
                    placeholder="Student Name"
                    className="h-11 bg-secondary/30"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={signupStudentName}
                    onChange={(event) => setSignupStudentName(event.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  placeholder="you@example.com"
                  className="h-11 bg-secondary/30"
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="********"
                  className="h-11 bg-secondary/30"
                  autoComplete="new-password"
                  onMouseEnter={() => setShowSignupPassword(true)}
                  onMouseLeave={() => setShowSignupPassword(false)}
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                />
              </div>
              {signupError && (
                <p className="text-sm font-medium text-destructive">{signupError}</p>
              )}
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? Sign up above." : "Already have an account? Switch to Login."}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
