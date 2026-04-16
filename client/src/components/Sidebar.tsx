import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  Bot,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

type SidebarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

function SidebarNav({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const [location, setLocation] = useLocation();
  const { isAdmin, isLibrarian } = useAuth();

  const menu = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Library, label: "Catalog", href: "/catalog" },
    ...(isAdmin || isLibrarian ? [{ icon: Library, label: "Circulation", href: "/circulation" }] : []),
    { icon: Sparkles, label: "Recommendations", href: "/recommendations" },
    { icon: Bot, label: "AI Assistant", href: "/assistant" },
    ...(isAdmin ? [{ icon: Users, label: "Members", href: "/members" }] : []),
    ...(isAdmin ? [{ icon: ShieldCheck, label: "Admin", href: "/admin" }] : []),
  ];

  return (
    <nav className="space-y-1">
      {menu.map((item) => {
        const Icon = item.icon;
        const active = location === item.href;
        const content = (
          <div
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
              active
                ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
              mobile && !active && "border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </div>
        );

        if (mobile) {
          return (
            <button
              key={item.href}
              type="button"
              className="block w-full text-left"
              onClick={() => {
                setLocation(item.href);
                onNavigate?.();
              }}
            >
              {content}
            </button>
          );
        }

        return (
          <Link key={item.href} href={item.href}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarShell({
  theme,
  onToggleTheme,
  mobile = false,
  onNavigate,
}: SidebarProps & { mobile?: boolean; onNavigate?: () => void }) {
  const { logoutMutation } = useAuth();

  return (
    <>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-950/40">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight">LibraryHub</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Modern Library Management</p>
        </div>
      </div>

      <SidebarNav mobile={mobile} onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <SunMedium className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start border-slate-200 bg-transparent text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
          onClick={() => {
            logoutMutation.mutate();
            onNavigate?.();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );
}

export function MobileSidebar({ theme, onToggleTheme }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 flex items-center justify-start rounded-[1.5rem] border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/90 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[84vw] border-r border-slate-200/80 bg-white/85 p-6 text-slate-900 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-100">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Open app sections</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarShell theme={theme} onToggleTheme={onToggleTheme} mobile onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/85 px-4 py-6 text-slate-900 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-100 md:flex">
      <SidebarShell theme={theme} onToggleTheme={onToggleTheme} />
    </aside>
  );
}
