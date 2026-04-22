import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Bell, BookOpen, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { motion } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { MobileSidebar, Sidebar } from "@/components/Sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useBootstrap, useLibraryActions } from "@/hooks/use-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabaseBrowser } from "@/lib/supabase-browser";

type ThemeMode = "light" | "dark" | "futuristic";
type BaseTheme = "light" | "dark";

const scrollReveal = {
  hidden: { opacity: 0, y: 40, rotateX: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.3H12Z" />
      <path fill="#34A853" d="M2.5 12c0 1.7.4 3.3 1.3 4.6l3.6-2.8c-.2-.5-.4-1.2-.4-1.8s.1-1.2.4-1.8L3.8 7.4A9.4 9.4 0 0 0 2.5 12Z" />
      <path fill="#FBBC05" d="M12 21.5c2.7 0 4.9-.9 6.5-2.5l-3.1-2.4c-.8.6-1.9 1-3.4 1-2.5 0-4.6-1.7-5.4-4l-3.7 2.9A9.5 9.5 0 0 0 12 21.5Z" />
      <path fill="#4285F4" d="M21.1 12.9c.1-.4.1-.8.1-1.3s0-.9-.1-1.3H12v3.9h5.4c-.3 1.4-1.1 2.5-2 3.3l3.1 2.4c1.8-1.7 2.6-4.1 2.6-7Z" />
    </svg>
  );
}

function LoginScreen() {
  const { loginMutation, registerMutation, startGoogleAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [selectedRole, setSelectedRole] = useState<"Admin" | "Librarian" | "Student">("Student");
  const presets: Array<{
    role: "Admin" | "Librarian" | "Student";
    note: string;
  }> = [
    {
      role: "Admin",
      note: "Can add books and assign roles.",
    },
    {
      role: "Librarian",
      note: "Can issue and return books.",
    },
    {
      role: "Student",
      note: "Can reserve books and add reviews.",
    },
  ];

  const applyPreset = (preset: (typeof presets)[number]) => {
    setMode("login");
    setSelectedRole(preset.role);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#164e63_0%,#0f172a_38%,#020617_100%)] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="order-2 lg:order-1">
          <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 backdrop-blur">
            LibraryHub
          </p>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Modern Library Management System
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Clean, fast, and easy to use for admins, librarians, and students across desktop and mobile.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {["Responsive UI", "Quick Access", "Role Ready"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-slate-200 backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => (
              <motion.button
                key={preset.role}
                type="button"
                variants={scrollReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                whileHover={{ y: -4, rotateX: 4, rotateY: -4 }}
                className="scroll-depth rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left shadow-lg shadow-slate-950/20 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                onClick={() => applyPreset(preset)}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">{preset.role}</p>
                <p className="mt-3 text-sm text-slate-300">{preset.note}</p>
                <p className="mt-4 text-sm text-cyan-300">Continue as {preset.role.toLowerCase()}</p>
              </motion.button>
            ))}
          </div>
        </div>
        <motion.div
          variants={scrollReveal}
          initial="hidden"
          animate="visible"
          className="order-1 rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6 lg:order-2"
        >
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/30 p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${mode === "login" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${mode === "signup" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
              onClick={() => setMode("signup")}
            >
              Student signup
            </button>
          </div>
          {mode === "login" ? (
            <>
              <h2 className="mt-6 text-3xl font-semibold">Sign in</h2>
              <p className="mt-2 text-sm text-slate-300">
                Selected role: <span className="font-medium text-cyan-300">{selectedRole}</span>. Sign in with your real account credentials.
              </p>
              <div className="mt-6 space-y-4">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-white/10 bg-slate-950/60 text-white" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border-white/10 bg-slate-950/60 text-white" />
                <Button
                  className="w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  disabled={loginMutation.isPending || !email || !password}
                  onClick={() => loginMutation.mutate({ email, password })}
                >
                  {loginMutation.isPending ? "Signing in..." : "Open workspace"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => startGoogleAuth("login")}
                >
                  <span className="flex items-center justify-center gap-3">
                    <GoogleLogo />
                    Continue with Google
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-3xl font-semibold">Create student account</h2>
              <p className="mt-2 text-sm text-slate-300">Self-signup is only for students. Admin and librarian accounts stay controlled by staff.</p>
              <div className="mt-6 space-y-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="border-white/10 bg-slate-950/60 text-white" />
                <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="Registration number" className="border-white/10 bg-slate-950/60 text-white" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-white/10 bg-slate-950/60 text-white" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border-white/10 bg-slate-950/60 text-white" />
                <Button
                  className="w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  disabled={registerMutation.isPending || !name || !registrationNumber || !email || !password}
                  onClick={() => registerMutation.mutate({ name, email, password, registrationNumber, role: "student" })}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create student account"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                  disabled={!registrationNumber.trim()}
                  onClick={() => startGoogleAuth("signup", registrationNumber.trim())}
                >
                  <span className="flex items-center justify-center gap-3">
                    <GoogleLogo />
                    Sign up with Google
                  </span>
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function AuthCallbackScreen() {
  const { googleAuthMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("Finishing Google sign-in...");
  const hasProcessedAuth = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const completeGoogleAuth = async () => {
      if (hasProcessedAuth.current) {
        return;
      }
      hasProcessedAuth.current = true;

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const queryError = searchParams.get("error_description") || searchParams.get("error");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessTokenFromHash = hashParams.get("access_token");
      const refreshTokenFromHash = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      const registrationNumber = sessionStorage.getItem("google-auth-registration-number") || undefined;

      let accessToken = "";

      if (queryError || hashError) {
        setStatus(queryError || hashError || "Unable to complete Google sign-in.");
        return;
      }

      if (code) {
        const { data, error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
        if (data.session?.access_token) {
          accessToken = data.session.access_token;
        } else {
          const { data: sessionData } = await supabaseBrowser.auth.getSession();
          if (sessionData.session?.access_token) {
            accessToken = sessionData.session.access_token;
          } else {
            setStatus(error?.message || "Unable to complete Google sign-in.");
            return;
          }
        }
      } else if (accessTokenFromHash && refreshTokenFromHash) {
        const { data, error } = await supabaseBrowser.auth.setSession({
          access_token: accessTokenFromHash,
          refresh_token: refreshTokenFromHash,
        });
        if (data.session?.access_token) {
          accessToken = data.session.access_token;
        } else {
          const { data: sessionData } = await supabaseBrowser.auth.getSession();
          if (sessionData.session?.access_token) {
            accessToken = sessionData.session.access_token;
          } else {
            setStatus(error?.message || "Unable to complete Google sign-in.");
            return;
          }
        }
      } else if (accessTokenFromHash) {
        accessToken = accessTokenFromHash;
      } else {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        if (sessionData.session?.access_token) {
          accessToken = sessionData.session.access_token;
        } else {
          setStatus("Google did not return a usable session.");
          return;
        }
      }

      if (!accessToken) {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        if (sessionData.session?.access_token) {
          accessToken = sessionData.session.access_token;
        }
      }

      if (!accessToken) {
        setStatus("Google did not return a usable session.");
        return;
      }

      window.history.replaceState({}, document.title, "/auth/callback");

      try {
        await googleAuthMutation.mutateAsync({
          accessToken,
          registrationNumber,
        });
        sessionStorage.removeItem("google-auth-intent");
        sessionStorage.removeItem("google-auth-registration-number");
        await supabaseBrowser.auth.signOut();
        if (!cancelled) {
          setLocation("/");
        }
      } catch (mutationError) {
        hasProcessedAuth.current = false;
        if (!cancelled) {
          setStatus(mutationError instanceof Error ? mutationError.message : "Unable to complete Google sign-in.");
        }
      }
    };

    void completeGoogleAuth();

    return () => {
      cancelled = true;
    };
  }, [googleAuthMutation, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Lib Connect</p>
        <h1 className="mt-4 text-3xl font-semibold">Google authentication</h1>
        <p className="mt-3 text-sm text-slate-300">{status}</p>
      </div>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <motion.section
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.22 }}
      className="scroll-depth scroll-shadow rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 sm:rounded-[2rem] sm:p-6"
    >
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{text}</p>
      <div className="mt-4 sm:mt-5">{children}</div>
    </motion.section>
  );
}

type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  kind: "section" | "book" | "member" | "shortcut";
  query?: string;
};

function AnimatedHeaderLogo() {
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIntro(false);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {intro ? (
        <>
          <div className="header-logo-swoosh" aria-hidden="true" />
          <div className="header-logo-orbit" aria-hidden="true">
            <span className="header-logo-orbit-dot" />
            <span className="header-logo-orbit-dot header-logo-orbit-dot--small" />
          </div>
        </>
      ) : null}
      <div className={`flex flex-col items-center justify-center text-center ${intro ? "header-logo-copy--reveal" : ""}`}>
        <div className={`header-logo-title-block ${intro ? "header-logo-title-block--reveal" : ""}`}>
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300 sm:text-xs">Library Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[2.1rem]">Lib Connect Portal</h1>
        </div>
      </div>
    </div>
  );
}

function AppSearchBar({
  data,
  nav,
  onNavigate,
  placeholder = "Search books, members, categories, or sections",
  compact = false,
}: {
  data: any;
  nav: Array<{ href: string; label: string }>;
  onNavigate: (route: string, query?: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const availableRoutes = useMemo(() => new Set(nav.map((item) => item.href)), [nav]);

  const shortcutResults = useMemo(
    () =>
      [
        {
          id: "shortcut-digital",
          title: "Digital books",
          subtitle: "Jump to catalog results for eBooks and online reading",
          route: "/catalog",
          kind: "shortcut" as const,
          query: "digital ebook online",
        },
        {
          id: "shortcut-overdue",
          title: "Overdue activity",
          subtitle: "Open circulation and review overdue records quickly",
          route: "/circulation",
          kind: "shortcut" as const,
          query: "overdue",
        },
        {
          id: "shortcut-students",
          title: "Student members",
          subtitle: "Jump to member management for student accounts",
          route: "/members",
          kind: "shortcut" as const,
          query: "student",
        },
      ].filter((item) => availableRoutes.has(item.route)),
    [availableRoutes],
  );

  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    const sectionResults: GlobalSearchResult[] = nav
      .filter((item) => item.label.toLowerCase().includes(normalizedQuery))
      .map((item) => ({
        id: `section-${item.href}`,
        title: item.label,
        subtitle: "Open app section",
        route: item.href,
          kind: "section",
        }));

    const matchingShortcutResults: GlobalSearchResult[] = shortcutResults
      .filter((item) => item.title.toLowerCase().includes(normalizedQuery) || item.subtitle.toLowerCase().includes(normalizedQuery));

    const bookResults: GlobalSearchResult[] = data.books
      .filter((book: any) =>
        `${book.title} ${book.author} ${book.category} ${book.isbn} ${book.tags?.join(" ") || ""}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 5)
      .map((book: any) => ({
        id: `book-${book._id}`,
        title: book.title,
        subtitle: `${book.author} - ${book.category} - ${book.availableCopies}/${book.totalCopies} available`,
        route: "/catalog",
        kind: "book",
        query: book.title,
      }));

    const memberResults: GlobalSearchResult[] = (data.users || [])
      .filter(() => availableRoutes.has("/members"))
      .filter((user: any) =>
        `${user.name} ${user.email} ${user.registrationNumber || ""} ${user.role}`.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 4)
      .map((user: any) => ({
        id: `member-${user._id}`,
        title: user.name,
        subtitle: `${user.role} - ${user.registrationNumber || user.email}`,
        route: "/members",
        kind: "member",
        query: user.name,
      }));

    return [...sectionResults, ...matchingShortcutResults, ...bookResults, ...memberResults].slice(0, 8);
  }, [data.books, data.users, nav, normalizedQuery, shortcutResults]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const runSearch = (result?: GlobalSearchResult) => {
    const nextRoute = result?.route || "/catalog";
    const nextQuery = result?.query || query.trim();

    if (!nextQuery && nextRoute === "/catalog") {
      onNavigate(nextRoute);
      setOpen(false);
      return;
    }

    onNavigate(nextRoute, nextQuery || undefined);
    setOpen(false);
  };

  const iconForResult = (kind: GlobalSearchResult["kind"]) => {
    if (kind === "member") return <Users className="h-4 w-4" />;
    return <BookOpen className="h-4 w-4" />;
  };

  return (
    <div ref={containerRef} className={`relative w-full ${open ? "z-[90]" : "z-10"} ${compact ? "max-w-none" : "max-w-2xl"}`}>
      <div className={`flex w-full items-center gap-3 rounded-[1.5rem] bg-white/90 px-4 shadow-sm backdrop-blur dark:bg-slate-950/85 ${compact ? "py-2.5" : "py-3"}`}>
        <Search className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
          }}
          placeholder={placeholder}
          className={`h-auto w-full border-0 bg-transparent px-0 py-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent ${compact ? "text-sm" : "text-sm sm:text-base"}`}
        />
        <Button
          size="sm"
          className={`rounded-xl ${compact ? "px-3" : "px-4"}`}
          disabled={!query.trim()}
          onClick={() => runSearch()}
        >
          {compact ? "Go" : "Search"}
        </Button>
      </div>

      {open && !!normalizedQuery ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-[70] overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
          {results.length > 0 ? (
            <div className="max-h-[22rem] overflow-y-auto p-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-[1.1rem] px-3 py-3 text-left transition hover:bg-cyan-50 dark:hover:bg-white/5"
                  onClick={() => runSearch(result)}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-200">
                    {iconForResult(result.kind)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium sm:text-[15px]">{result.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{result.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
              No direct matches yet. Press Enter to search the catalog for "{query.trim()}".
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatTimeLeft(dueDate: string) {
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diff = due - now;
  const absDiff = Math.abs(diff);
  const totalHours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (diff < 0) {
    if (days > 0) return `${days} day${days === 1 ? "" : "s"} overdue`;
    return `${Math.max(hours, 1)} hour${hours === 1 ? "" : "s"} overdue`;
  }

  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  return `${Math.max(hours, 1)} hour${hours === 1 ? "" : "s"} left`;
}

function getAutoLoanAlerts(transactions: any[], books: any[]) {
  return transactions
    .filter((transaction) => transaction.status !== "RETURNED")
    .map((transaction) => {
      const book = books.find((candidate: any) => candidate._id === transaction.bookId);
      const due = new Date(transaction.dueDate).getTime();
      const remaining = due - Date.now();
      const isOverdue = transaction.status === "OVERDUE" || remaining < 0;
      const isDueSoon = !isOverdue && remaining <= 2 * 24 * 60 * 60 * 1000;

      if (!isOverdue && !isDueSoon) return null;

      return {
        id: `loan-${transaction._id}`,
        title: isOverdue ? "Overdue book" : "Return due soon",
        message: isOverdue
          ? `${book?.title || "Borrowed book"} is overdue. Please return it soon.`
          : `${book?.title || "Borrowed book"} is due in ${formatTimeLeft(transaction.dueDate)}.`,
        meta: `Due ${new Date(transaction.dueDate).toLocaleDateString()}`,
        variant: isOverdue ? "overdue" : "warning",
      };
    })
    .filter(Boolean);
}

function NotificationBell({ data, actions }: { data: any; actions: any }) {
  const { isStudent } = useAuth();
  const [open, setOpen] = useState(false);
  const [seenAlertIds, setSeenAlertIds] = useState<string[]>([]);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const autoAlerts = useMemo(() => getAutoLoanAlerts(data.transactions, data.books), [data.transactions, data.books]);
  const manualAlerts = useMemo(() => data.notifications.map((notification: any) => ({
    id: notification._id,
    notificationId: notification._id,
    title: notification.title,
    message: notification.message,
    meta: new Date(notification.createdAt).toLocaleString(),
    variant: "info",
    isPersisted: true,
  })), [data.notifications]);
  const alerts = useMemo(() => [...autoAlerts, ...manualAlerts].slice(0, 6), [autoAlerts, manualAlerts]);
  const alertIds = useMemo(() => alerts.map((alert: any) => alert.id), [alerts]);
  const unseenAlerts = alerts.filter((alert: any) => !seenAlertIds.includes(alert.id));

  useEffect(() => {
    if (!open || alertIds.length === 0) return;
    setSeenAlertIds((current) => {
      const next = Array.from(new Set([...current, ...alertIds]));
      return next.length === current.length ? current : next;
    });
  }, [open, alertIds]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = bellRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12));

      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width: panelWidth,
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  if (!isStudent) return null;

  return (
    <div ref={bellRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Open notifications"
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
        {unseenAlerts.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
            {unseenAlerts.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div style={panelStyle} className="z-30 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Automatic reminders and updates</p>
            </div>
            {autoAlerts.length > 0 ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-200">
                {autoAlerts.length} due soon
              </span>
            ) : null}
          </div>

          <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {alerts.length > 0 ? alerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`rounded-2xl border p-3 ${
                  alert.variant === "overdue"
                    ? "border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10"
                    : alert.variant === "warning"
                      ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10"
                      : "border-slate-200/80 bg-slate-50/80 dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {alert.variant === "overdue" ? "Urgent" : alert.variant === "warning" ? "Soon" : "Info"}
                    </span>
                    {alert.isPersisted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actions.deleteNotification.isPending}
                        onClick={() => actions.deleteNotification.mutate(alert.notificationId)}
                      >
                        {actions.deleteNotification.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{alert.meta}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No notifications right now.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Dashboard({ data, actions }: { data: any; actions: any }) {
  const { isStudent, user } = useAuth();
  const activeLoans = data.transactions.filter((transaction: any) => transaction.status !== "RETURNED");
  const overdueLoans = activeLoans.filter((transaction: any) => transaction.status === "OVERDUE");
  const nextDueLoan = [...activeLoans].sort(
    (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )[0];
  const topReader = data.dashboard.topReaderReward;
  const isTopReader = Boolean(isStudent && user && topReader?.userId === user._id);
  const myReturnRequests = data.returnRequests || [];

  if (isStudent) {
    return (
      <div className="space-y-6">
        <DashboardHeroSlider />
        <div className={`rounded-[1.75rem] border p-5 sm:p-6 ${
          isTopReader
            ? "border-amber-300/70 bg-amber-50/90 dark:border-amber-400/30 dark:bg-amber-500/10"
            : "border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5"
        }`}>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">Student Reward</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {isTopReader ? "You earned the Top Reader Award" : topReader ? `${topReader.name} leads this month` : "Reward board is warming up"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {topReader
              ? `${topReader.name} has borrowed ${topReader.borrowCount} book${topReader.borrowCount === 1 ? "" : "s"} and currently holds the ${topReader.rewardTitle}.`
              : "Once students start borrowing books, the most active reader will be highlighted here."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            ["Borrowed Books", activeLoans.length],
            ["Overdue", overdueLoans.length],
            ["Reservations", data.reservations.length],
            ["Next Return", nextDueLoan ? formatTimeLeft(nextDueLoan.dueDate) : "No active loans"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[1.25rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 sm:rounded-[1.5rem] sm:p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{label}</p>
              <p className="mt-2 text-xl font-semibold sm:mt-3 sm:text-3xl">{value}</p>
            </div>
          ))}
        </div>

        <Card title="My Borrowed Books" text="Track every active book and its return timeline.">
          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[38rem] sm:space-y-4">
            {activeLoans.length > 0 ? activeLoans.map((transaction: any) => {
              const book = data.books.find((candidate: any) => candidate._id === transaction.bookId);
              const branch = data.branches.find((candidate: any) => candidate._id === transaction.branchId);
              const overdue = transaction.status === "OVERDUE";
              const returnRequest = myReturnRequests
                .filter((request: any) => request.transactionId === transaction._id)
                .sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];

              return (
                <div
                  key={transaction._id}
                  className={`rounded-[1.25rem] border p-4 sm:rounded-[1.5rem] sm:p-5 ${
                    overdue
                      ? "border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10"
                      : "border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">
                          {book?.category || "Borrowed book"}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold sm:text-xl">{book?.title || "Unknown title"}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                          {book?.author || "Unknown author"}{branch ? ` | ${branch.name}` : ""}
                        </p>
                      </div>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm ${
                      overdue
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                        : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                    }`}>
                      {formatTimeLeft(transaction.dueDate)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3 sm:gap-3 sm:text-sm">
                    <div className="rounded-xl bg-slate-100/80 px-3 py-2.5 dark:bg-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Issued</p>
                      <p className="mt-2 font-medium">{new Date(transaction.issuedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100/80 px-3 py-2.5 dark:bg-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Return By</p>
                      <p className="mt-2 font-medium">{new Date(transaction.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100/80 px-3 py-2.5 dark:bg-slate-950/40 sm:rounded-2xl sm:px-4 sm:py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fine</p>
                      <p className="mt-2 font-medium">${transaction.fineAmount}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {returnRequest ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Return request: {returnRequest.status.toLowerCase()}
                        {returnRequest.reviewedAt ? ` on ${new Date(returnRequest.reviewedAt).toLocaleDateString()}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Send a return request and wait for staff approval.
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={actions.requestReturn.isPending || returnRequest?.status === "PENDING"}
                      onClick={() => actions.requestReturn.mutate({ transactionId: transaction._id })}
                    >
                      {returnRequest?.status === "PENDING"
                        ? "Request pending"
                        : actions.requestReturn.isPending
                          ? "Sending..."
                          : "Request return"}
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300/80 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                You do not have any borrowed books right now.
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeroSlider />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          ["Books", data.dashboard.totals.books],
          ["Active Loans", data.dashboard.totals.activeLoans],
          ["Overdue", data.dashboard.totals.overdueBooks],
          ["Fine Revenue", `$${data.dashboard.totals.fineRevenue}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.25rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 sm:rounded-[1.5rem] sm:p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{label}</p>
            <p className="mt-2 text-xl font-semibold sm:mt-3 sm:text-3xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top Reader Reward" text="Recognize the student who has borrowed the most books.">
          {topReader ? (
            <div className="rounded-[1.5rem] border border-amber-300/60 bg-amber-50/90 p-5 dark:border-amber-400/20 dark:bg-amber-500/10">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-700 dark:text-amber-200">{topReader.rewardTitle}</p>
              <h3 className="mt-3 text-2xl font-semibold">{topReader.name}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Borrowed {topReader.borrowCount} book{topReader.borrowCount === 1 ? "" : "s"}
                {topReader.registrationNumber ? ` | Reg No. ${topReader.registrationNumber}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No student reward winner yet.
            </div>
          )}
        </Card>
        <Card title="Most Borrowed" text="Trending books across branches.">
          <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
            {data.dashboard.mostBorrowedBooks.map((item: any) => (
              <div key={item.bookId} className="flex items-center justify-between rounded-2xl bg-slate-100/80 px-4 py-3 dark:bg-white/5">
                <span>{item.title}</span>
                <span>{item.borrowCount} borrows</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Overdue Snapshot" text="Books requiring follow-up.">
          <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
            {data.dashboard.overdueItems.map((item: any) => {
              const book = data.books.find((candidate: any) => candidate._id === item.bookId);
              return (
                <div key={item._id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
                  <p className="font-medium">{book?.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Due {new Date(item.dueDate).toLocaleDateString()} • Fine ${item.fineAmount}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardHeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = [
    {
      image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=80",
      tone: "from-cyan-500/30 via-sky-500/15 to-blue-950/80",
    },
    {
      image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=80",
      tone: "from-indigo-500/30 via-blue-500/10 to-slate-950/80",
    },
    {
      image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1400&q=80",
      tone: "from-amber-400/30 via-orange-400/10 to-slate-950/80",
    },
    {
      image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1400&q=80",
      tone: "from-emerald-400/25 via-teal-500/10 to-slate-950/80",
    },
  ];

  useEffect(() => {
    if (slides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  const slide = slides[activeIndex];

  return (
    <motion.section
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      className="scroll-depth relative overflow-hidden rounded-[1.75rem] text-white shadow-[0_25px_70px_-35px_rgba(15,23,42,0.75)]"
    >
      <div className="relative scroll-float">
        <div className="relative overflow-hidden rounded-[1.75rem]">
          <img src={slide.image} alt={`Library slide ${activeIndex + 1}`} className="h-[260px] w-full object-cover sm:h-[340px] lg:h-[420px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/18 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => setActiveIndex((current) => (current - 1 + slides.length) % slides.length)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/90 transition hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-center gap-2">
              {slides.map((item, index) => (
                <button
                  key={item.image}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-8 bg-white" : "w-2.5 bg-white/55 hover:bg-white/80"}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => setActiveIndex((current) => (current + 1) % slides.length)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/90 transition hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Catalog({ data, canWrite, actions }: { data: any; canWrite: boolean; actions: any }) {
  const [search, setSearch] = useState(() => sessionStorage.getItem("catalog-search") || "");
  const [form, setForm] = useState({
    title: "",
    author: "",
    category: "",
    isbn: "",
    barcode: "",
    description: "",
    coverImage: "",
    ebookUrl: "",
    publishedYear: new Date().getFullYear(),
    language: "English",
    format: "hybrid",
    tags: "",
    branchIds: data.branches.map((branch: any) => branch._id),
    totalCopies: 1,
    availableCopies: 1,
  });
  useEffect(() => {
    if (sessionStorage.getItem("catalog-search")) {
      sessionStorage.removeItem("catalog-search");
    }
  }, []);

  const filtered = data.books.filter((book: any) =>
    `${book.title} ${book.author} ${book.category} ${book.isbn} ${book.tags?.join(" ") || ""} ${book.description || ""} ${book.format || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <Card title="Catalog" text="Search books, manage inventory, and access digital resources.">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, ISBN, tags, category" />
            {search ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear
              </Button>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300 sm:text-sm">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mt-4 max-h-[38rem] overflow-y-auto pr-1 sm:mt-5 sm:max-h-[42rem]">
          <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((book: any) => (
            <div key={book._id} className="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-white/10 sm:rounded-[1.5rem] sm:p-5">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">{book.category}</p>
                  <h3 className="mt-2 text-lg font-semibold sm:text-xl">{book.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{book.author}</p>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs sm:px-3 sm:text-sm">{book.availableCopies}/{book.totalCopies}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{book.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                <Button variant="outline" disabled={actions.reserveBook.isPending} onClick={() => actions.reserveBook.mutate(book._id)}>
                  {actions.reserveBook.isPending ? "Reserving..." : "Reserve"}
                </Button>
                {book.ebookUrl ? <a href={book.ebookUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm">Read eBook</a> : null}
                {canWrite ? (
                  <Button
                    variant="outline"
                    disabled={actions.updateBook.isPending}
                    onClick={() => actions.updateBook.mutate({
                      bookId: book._id,
                      updates: {
                        totalCopies: book.totalCopies + 1,
                        availableCopies: Math.min(book.totalCopies + 1, book.availableCopies + 1),
                      },
                    })}
                  >
                    {actions.updateBook.isPending ? "Adding..." : "Add copy"}
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button variant="destructive" disabled={actions.deleteBook.isPending} onClick={() => actions.deleteBook.mutate(book._id)}>
                    {actions.deleteBook.isPending ? "Deleting..." : "Delete"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300/80 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No books matched your search. Try a title, author, category, tag, or ISBN.
            </div>
          ) : null}
        </div>
      </Card>
      {canWrite ? (
        <Card title="Add Book" text="Capture both physical and digital catalog details.">
          <div className="grid gap-4 md:grid-cols-2">
            {["title", "author", "category", "isbn", "barcode", "coverImage", "ebookUrl", "language"].map((key) => (
              <Input key={key} placeholder={key} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            ))}
            <Input type="number" value={form.publishedYear} onChange={(e) => setForm({ ...form, publishedYear: Number(e.target.value) })} />
            <Input
              type="number"
              value={form.totalCopies}
              onChange={(e) => {
                const totalCopies = Math.max(0, Number(e.target.value));
                setForm({ ...form, totalCopies, availableCopies: Math.min(form.availableCopies, totalCopies) });
              }}
            />
            <Input
              type="number"
              value={form.availableCopies}
              onChange={(e) => {
                const availableCopies = Math.max(0, Number(e.target.value));
                setForm({ ...form, availableCopies: Math.min(availableCopies, form.totalCopies) });
              }}
            />
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as any })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              <option value="physical">physical</option>
              <option value="digital">digital</option>
              <option value="hybrid">hybrid</option>
            </select>
            <Textarea className="md:col-span-2" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button
            className="mt-5"
            disabled={actions.createBook.isPending}
            onClick={() => actions.createBook.mutate({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) })}
          >
            {actions.createBook.isPending ? "Adding..." : "Add to catalog"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function Circulation({ data, actions }: { data: any; actions: any }) {
  const [issue, setIssue] = useState({
    userId: data.users.find((user: any) => user.role === "student")?._id || "",
    branchId: data.branches[0]?._id || "",
    bookId: data.books[0]?._id || "",
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [scanCode, setScanCode] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(data.users.find((user: any) => user.role === "student")?._id || "");
  const activeLoans = data.transactions.filter((transaction: any) => transaction.status !== "RETURNED");
  const memberLoans = activeLoans.filter((transaction: any) => transaction.userId === selectedMemberId);
  const reservationRequests = data.reservations.filter((reservation: any) => reservation.status === "WAITING");
  const returnRequests = (data.returnRequests || []).filter((request: any) => request.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2 sm:gap-6">
        <Card title="Issue Book" text="Use role-aware circulation with due dates and member selection.">
          <div className="grid gap-4">
            <select value={issue.userId} onChange={(e) => setIssue({ ...issue, userId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.users.filter((user: any) => user.role === "student").map((user: any) => <option key={user._id} value={user._id}>{user.name}</option>)}
            </select>
            <select value={issue.branchId} onChange={(e) => setIssue({ ...issue, branchId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.branches.map((branch: any) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
            <select value={issue.bookId} onChange={(e) => setIssue({ ...issue, bookId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.books.map((book: any) => <option key={book._id} value={book._id}>{book.title}</option>)}
            </select>
            <Input type="date" value={issue.dueDate} onChange={(e) => setIssue({ ...issue, dueDate: e.target.value })} />
            <Button disabled={actions.issueBook.isPending} onClick={() => actions.issueBook.mutate({ ...issue, dueDate: new Date(issue.dueDate).toISOString() })}>
              {actions.issueBook.isPending ? "Issuing..." : "Issue now"}
            </Button>
          </div>
        </Card>
        <Card title="Return Book" text="Return by barcode or directly from a member's active borrowed books.">
          <div className="grid gap-4">
            <Input value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Barcode or ISBN" />
            <Button disabled={actions.returnBook.isPending || !scanCode} onClick={() => actions.returnBook.mutate({ scanCode })}>
              {actions.returnBook.isPending ? "Processing..." : "Process return"}
            </Button>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">Return from member list</p>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950"
              >
                {data.users.filter((user: any) => user.role === "student").map((user: any) => (
                  <option key={user._id} value={user._id}>{user.name}</option>
                ))}
              </select>
              <div className="mt-4 max-h-[16rem] space-y-3 overflow-y-auto pr-1">
                {memberLoans.length > 0 ? memberLoans.map((transaction: any) => {
                  const book = data.books.find((candidate: any) => candidate._id === transaction.bookId);
                  return (
                    <div key={transaction._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 dark:border-white/10 dark:bg-white/5">
                      <div>
                        <p className="font-medium">{book?.title || "Unknown title"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Due {new Date(transaction.dueDate).toLocaleDateString()} | {transaction.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="rounded-xl"
                        disabled={actions.returnBook.isPending}
                        onClick={() => actions.returnBook.mutate({ transactionId: transaction._id })}
                      >
                        Return
                      </Button>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-300/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No active borrowed books for this member.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Reservation Requests" text="Approve or decline student requests with live updates for staff and members.">
        <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[28rem]">
          {reservationRequests.length > 0 ? reservationRequests.map((reservation: any) => {
            const book = data.books.find((candidate: any) => candidate._id === reservation.bookId);
            const user = data.users.find((candidate: any) => candidate._id === reservation.userId);
            return (
              <div key={reservation._id} className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">Reservation request</p>
                    <h3 className="mt-2 text-lg font-semibold">{book?.title || "Unknown title"}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {user?.name || "Unknown member"} | Queue position {reservation.position}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={actions.approveReservation.isPending || actions.declineReservation.isPending}
                      onClick={() => actions.approveReservation.mutate(reservation._id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={actions.approveReservation.isPending || actions.declineReservation.isPending}
                      onClick={() => actions.declineReservation.mutate(reservation._id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300/80 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No pending reservation requests right now.
            </div>
          )}
        </div>
      </Card>
      <Card title="Return Requests" text="Review return requests sent by students before completing the book return.">
        <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[28rem]">
          {returnRequests.length > 0 ? returnRequests.map((request: any) => {
            const book = data.books.find((candidate: any) => candidate._id === request.bookId);
            const user = data.users.find((candidate: any) => candidate._id === request.userId);
            const transaction = data.transactions.find((candidate: any) => candidate._id === request.transactionId);
            return (
              <div key={request._id} className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">Return request</p>
                    <h3 className="mt-2 text-lg font-semibold">{book?.title || "Unknown title"}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {user?.name || "Unknown member"} | Requested {new Date(request.requestedAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Due {transaction ? new Date(transaction.dueDate).toLocaleDateString() : "N/A"} | Fine ${transaction?.fineAmount ?? 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={actions.approveReturnRequest.isPending || actions.declineReturnRequest.isPending}
                      onClick={() => actions.approveReturnRequest.mutate(request._id)}
                    >
                      Approve return
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={actions.approveReturnRequest.isPending || actions.declineReturnRequest.isPending}
                      onClick={() => actions.declineReturnRequest.mutate(request._id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300/80 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No pending return requests right now.
            </div>
          )}
        </div>
      </Card>
      <Card title="Transaction Ledger" text="Track issues, returns, overdue items, and fines.">
        <div className="max-h-[24rem] overflow-auto sm:max-h-[30rem]">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="pb-3">Book</th>
                <th className="pb-3">Member</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Due</th>
                <th className="pb-3">Fine</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((transaction: any) => {
                const book = data.books.find((candidate: any) => candidate._id === transaction.bookId);
                const user = data.users.find((candidate: any) => candidate._id === transaction.userId);
                return (
                  <tr key={transaction._id} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="py-3">{book?.title}</td>
                    <td className="py-3">{user?.name}</td>
                    <td className="py-3">{transaction.status}</td>
                    <td className="py-3">{new Date(transaction.dueDate).toLocaleDateString()}</td>
                    <td className="py-3">${transaction.fineAmount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Recommendations({ data, actions }: { data: any; actions: any }) {
  const [bookId, setBookId] = useState(data.recommendations[0]?._id || data.books[0]?._id || "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("Helpful, well-structured, and worth recommending.");

  return (
    <div className="space-y-6">
      <Card title="Recommendations" text="Borrowing history, category affinity, and ratings guide these suggestions.">
        <div className="max-h-[28rem] overflow-y-auto pr-1 sm:max-h-[32rem]">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {data.recommendations.map((book: any) => (
              <div key={book._id} className="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-white/10 sm:rounded-[1.5rem] sm:p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">{book.category}</p>
                <h3 className="mt-3 text-base font-semibold sm:text-lg">{book.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{book.author}</p>
                <p className="mt-3 line-clamp-4 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{book.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2 sm:gap-6">
        <Card title="Review & Rating" text="Feedback powers discovery and catalog quality signals.">
          <div className="grid gap-3 sm:gap-4">
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.books.map((book: any) => <option key={book._id} value={book._id}>{book.title}</option>)}
            </select>
            <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button disabled={actions.addReview.isPending} onClick={() => actions.addReview.mutate({ bookId, rating, comment })}>
              {actions.addReview.isPending ? "Publishing..." : "Publish review"}
            </Button>
          </div>
        </Card>
        <Card title="Recent Reviews" text="Community feedback across physical and digital titles.">
          <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[28rem]">
            {data.reviews.map((review: any) => {
              const book = data.books.find((candidate: any) => candidate._id === review.bookId);
              const canDeleteReview = data.user?.role === "admin" || review.userId === data.user?._id;
              return (
                <div key={review._id} className="rounded-xl bg-slate-100/80 p-3 dark:bg-white/5 sm:rounded-2xl sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{book?.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{review.rating}/5</p>
                    </div>
                    {canDeleteReview ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actions.deleteReview.isPending}
                        onClick={() => actions.deleteReview.mutate(review._id)}
                      >
                        {actions.deleteReview.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{review.comment}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

function Assistant({ data, actions }: { data: any; actions: any }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Hi, how can I help you? I can guide you through the whole app, including availability, borrowed books, due dates, reservations, circulation, notifications, and recommendations.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const quickPrompts = [
    "Is Clean Code available?",
    "Show my overdue books",
    "How do reservations work?",
    "How do I use this app?",
    "Recommend software engineering books",
    "Which digital books are available?",
  ];

  useEffect(() => {
    if (!actions.askAssistant.data) return;
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: actions.askAssistant.data.reply,
      },
    ]);
  }, [actions.askAssistant.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, actions.askAssistant.isPending]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || actions.askAssistant.isPending) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      },
    ]);
    setMessage("");
    actions.askAssistant.mutate(trimmed);
  };

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(255,255,255,0.92),rgba(16,185,129,0.08))] p-5 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(8,145,178,0.2),rgba(15,23,42,0.92),rgba(16,185,129,0.12))] sm:p-6">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">AI Assistant</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Ask with AI</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
          Get stronger help for the entire app, including library tasks, personal loans, reservations, digital access, staff workflows, and smart reading suggestions.
        </p>
        <div className="mt-5">
          <a
            href="https://chatwithgenie.netlify.app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
          >
            Learn with AI
          </a>
        </div>
      </div>

      <Card title="Conversation" text="Ask naturally and the assistant will answer using your live library data.">
        <div className="grid gap-4 sm:gap-5">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200 sm:px-4 sm:py-2 sm:text-sm"
              onClick={() => sendMessage(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="max-h-[26rem] min-h-[19rem] space-y-3 overflow-y-auto rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/40 sm:max-h-[30rem] sm:min-h-[24rem] sm:space-y-4 sm:rounded-[1.75rem] sm:p-4"
        >
          {messages.map((entry) => (
            <div
              key={entry.id}
              className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-[1.25rem] px-3 py-2.5 text-xs leading-6 shadow-sm sm:max-w-[85%] sm:rounded-[1.5rem] sm:px-4 sm:py-3 sm:text-sm sm:leading-7 ${
                  entry.role === "user"
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-slate-200/80 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                }`}
              >
                <div className="whitespace-pre-line">{entry.content}</div>
              </div>
            </div>
          ))}
          {actions.askAssistant.isPending ? (
            <div className="flex justify-start">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Thinking...
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 sm:rounded-[1.75rem]">
          <div className="grid gap-3">
            <Textarea
              rows={3}
              value={message}
              placeholder="Ask with AI"
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(message);
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Press Enter to send.
              </p>
              <Button className="rounded-2xl" disabled={actions.askAssistant.isPending || !message.trim()} onClick={() => sendMessage(message)}>
                {actions.askAssistant.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
        </div>
      </Card>
    </section>
  );
}

function Members({ data, actions }: { data: any; actions: any }) {
  return (
    <Card title="Members & Roles" text="Manage admins, librarians, students, and branch access.">
      <div className="max-h-[34rem] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Registration No.</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Branch</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user: any) => (
              <tr key={user._id} className="border-t border-slate-200/70 dark:border-white/10">
                <td className="py-3">{user.name}</td>
                <td className="py-3">{user.email}</td>
                <td className="py-3">{user.registrationNumber || "Not set"}</td>
                <td className="py-3 capitalize">{user.role}</td>
                <td className="py-3">{data.branches.find((branch: any) => branch._id === user.branchId)?.name || "Unassigned"}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    {["student", "librarian", "admin"].map((role) => (
                      <Button
                        key={role}
                        size="sm"
                        variant="outline"
                        disabled={actions.updateRole.isPending}
                        onClick={() => actions.updateRole.mutate({ userId: user._id, role: role as "admin" | "librarian" | "student", branchId: user.branchId })}
                      >
                        {actions.updateRole.isPending ? "Updating..." : role}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RegistrationNumberPrompt() {
  const { user, updateRegistrationNumberMutation } = useAuth();
  const [registrationNumber, setRegistrationNumber] = useState(user?.registrationNumber || "");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student onboarding</p>
        <h1 className="mt-4 text-3xl font-semibold">Add your registration number</h1>
        <p className="mt-3 text-sm text-slate-300">
          We need your student registration number before opening the library workspace.
        </p>
        <div className="mt-6 space-y-4">
          <Input
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
            placeholder="Registration number"
            className="border-white/10 bg-slate-950/60 text-white"
          />
          <Button
            className="w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
            disabled={updateRegistrationNumberMutation.isPending || !registrationNumber.trim()}
            onClick={() => updateRegistrationNumberMutation.mutate({ registrationNumber: registrationNumber.trim() })}
          >
            {updateRegistrationNumberMutation.isPending ? "Saving..." : "Continue to dashboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Admin({ data, actions }: { data: any; actions: any }) {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <Card title="Notifications" text="Email, SMS, and in-app updates generated by due dates and reservations.">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.notifications.length} notification{data.notifications.length === 1 ? "" : "s"}
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={actions.deleteAllNotifications.isPending || data.notifications.length === 0}
            onClick={() => actions.deleteAllNotifications.mutate()}
          >
            {actions.deleteAllNotifications.isPending ? "Deleting..." : "Delete all"}
          </Button>
        </div>
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {data.notifications.map((notification: any) => (
            <div key={notification._id} className="rounded-2xl bg-slate-100/80 p-4 dark:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{notification.channel}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actions.deleteNotification.isPending}
                  onClick={() => actions.deleteNotification.mutate(notification._id)}
                >
                  {actions.deleteNotification.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
            </div>
          ))}
          {data.notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No notifications found.
            </div>
          ) : null}
        </div>
      </Card>
      {isAdmin ? (
      <Card title="Audit Trail" text="Track catalog actions, circulation, and role changes.">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {data.auditLogs.map((log: any) => (
            <div key={log._id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
              <p className="font-medium">{log.action}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{log.entity} • {new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
      ) : null}
    </div>
  );
}

function Workspace() {
  const { user, isLoading, canWrite, isAdmin, isLibrarian, isStudent } = useAuth();
  const bootstrap = useBootstrap(!!user);
  const actions = useLibraryActions();
  const [baseTheme, setBaseTheme] = useState<BaseTheme>(() => {
    const savedBaseTheme = localStorage.getItem("base-theme");
    return savedBaseTheme === "dark" ? "dark" : "light";
  });
  const [isFuturistic, setIsFuturistic] = useState(() => localStorage.getItem("theme-mode") === "futuristic");
  const [location, setLocation] = useLocation();
  const theme: ThemeMode = isFuturistic ? "futuristic" : baseTheme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isFuturistic || baseTheme === "dark");
    document.documentElement.classList.toggle("futuristic", isFuturistic);
    localStorage.setItem("base-theme", baseTheme);
    localStorage.setItem("theme-mode", isFuturistic ? "futuristic" : "classic");
    localStorage.setItem("theme", theme);
  }, [baseTheme, isFuturistic, theme]);

  useEffect(() => {
    if (location === "/auth/login") setLocation("/");
  }, [location, setLocation]);

  const navigateWithSearch = (route: string, query?: string) => {
    if (route === "/catalog") {
      if (query) {
        sessionStorage.setItem("catalog-search", query);
      } else {
        sessionStorage.removeItem("catalog-search");
      }
    }

    setLocation(route);
  };

  if (location === "/auth/callback") return <AuthCallbackScreen />;
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>;
  if (!user) return <LoginScreen />;
  if (isStudent && !user.registrationNumber) return <RegistrationNumberPrompt />;
  if (bootstrap.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-2xl border border-red-400/30 bg-slate-900/80 p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-red-300">Bootstrap Error</p>
          <h1 className="mt-3 text-2xl font-semibold">Library data could not be loaded</h1>
          <p className="mt-3 text-sm text-slate-300">{bootstrap.error.message}</p>
        </div>
      </div>
    );
  }
  if (bootstrap.isLoading || !bootstrap.data) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading library data...</div>;

  const data = bootstrap.data;
  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/catalog", label: "Catalog" },
    ...(isAdmin || isLibrarian ? [{ href: "/circulation", label: "Circulation" }] : []),
    ...(isStudent ? [{ href: "/recommendations", label: "Recommendations" }] : []),
    { href: "/assistant", label: "Assistant" },
    ...(isAdmin ? [{ href: "/members", label: "Members" }] : []),
    ...(isAdmin || isLibrarian ? [{ href: "/admin", label: isAdmin ? "Admin" : "Notifications" }] : []),
  ];

  return (
    <div
      className={`min-h-screen ${
        theme === "futuristic"
          ? "bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.18),_transparent_28%),radial-gradient(circle_at_80%_12%,_rgba(244,114,182,0.14),_transparent_24%),linear-gradient(135deg,#030712,#0f172a,#111827,#1e1b4b)] text-slate-100"
          : "bg-[linear-gradient(135deg,#f8fafc,#eef2ff,#ecfeff)] text-slate-950 dark:bg-[linear-gradient(135deg,#020617,#0f172a,#111827)] dark:text-white"
      }`}
    >
      <main className="min-h-screen p-3 sm:p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            variants={scrollReveal}
            initial="hidden"
            animate="visible"
            className="mb-4 flex flex-col gap-3 md:mb-6 md:gap-4"
          >
            <div className="relative z-20 md:hidden">
              <div className="relative z-20 flex items-start gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
                <MobileSidebar
                  theme={theme}
                  baseTheme={baseTheme}
                  isFuturistic={isFuturistic}
                  onToggleBaseTheme={() => setBaseTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
                  onToggleFuturistic={() => setIsFuturistic((currentTheme) => !currentTheme)}
                />
                <div className="min-w-0 flex-1">
                  {location === "/" ? (
                    <AppSearchBar
                      data={data}
                      nav={nav}
                      onNavigate={navigateWithSearch}
                      placeholder="Search books or sections"
                      compact
                    />
                  ) : null}
                </div>
                <NotificationBell data={data} actions={actions} />
              </div>
              <div className="relative z-0 mt-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <AnimatedHeaderLogo />
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-[auto_1fr_auto] md:items-start md:gap-6">
              <div className="flex items-start gap-3">
                <div>
                  <Sidebar
                    theme={theme}
                    baseTheme={baseTheme}
                    isFuturistic={isFuturistic}
                    onToggleBaseTheme={() => setBaseTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
                    onToggleFuturistic={() => setIsFuturistic((currentTheme) => !currentTheme)}
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <AnimatedHeaderLogo />
              </div>
              <div className="flex justify-end">
                <NotificationBell data={data} actions={actions} />
              </div>
            </div>

            {location === "/" ? (
              <div className="hidden md:flex md:justify-center">
                <AppSearchBar data={data} nav={nav} onNavigate={navigateWithSearch} />
              </div>
            ) : null}
          </motion.div>

          <Switch>
            <Route path="/"><Dashboard data={data} actions={actions} /></Route>
            <Route path="/catalog"><Catalog data={data} canWrite={canWrite} actions={actions} /></Route>
            {isAdmin || isLibrarian ? <Route path="/circulation"><Circulation data={data} actions={actions} /></Route> : null}
            {isStudent ? <Route path="/recommendations"><Recommendations data={data} actions={actions} /></Route> : null}
            <Route path="/assistant"><Assistant data={data} actions={actions} /></Route>
            {isAdmin ? <Route path="/members"><Members data={data} actions={actions} /></Route> : null}
            {isAdmin || isLibrarian ? <Route path="/admin"><Admin data={data} actions={actions} /></Route> : null}
            <Route>
              <motion.div
                variants={scrollReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                className="scroll-depth scroll-shadow rounded-[2rem] border border-slate-200/80 bg-white/80 p-8 dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-lg font-semibold">{isStudent ? "This section is only available to admin and librarian users." : "Page not found."}</p>
                <div className="mt-4 flex gap-4">
                  <Link href="/">Dashboard</Link>
                  <Link href="/catalog">Catalog</Link>
                </div>
              </motion.div>
            </Route>
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Workspace />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
