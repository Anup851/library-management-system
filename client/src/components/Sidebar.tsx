import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  Wallet,
  LogOut,
  GraduationCap,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { logoutMutation, user, role, isAdmin } = useAuth();
  const displayName = user?.name || user?.username || "User";
  const displayInitial = displayName.charAt(0).toUpperCase();

  const adminMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Users, label: "Students", href: "/students" },
    { icon: School, label: "Classes", href: "/classes" },
    { icon: BookOpen, label: "Subjects", href: "/subjects" },
    { icon: CalendarCheck, label: "Attendance", href: "/attendance" },
    { icon: FileSpreadsheet, label: "Exams & Marks", href: "/exams" },
    { icon: Wallet, label: "Fees", href: "/fees" },
  ];

  const studentMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/portal" },
    { icon: CalendarCheck, label: "My Attendance", href: "/my-attendance" },
    { icon: Wallet, label: "My Fees", href: "/my-fees" },
    { icon: FileSpreadsheet, label: "My Marks", href: "/my-marks" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  const parentMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/portal" },
    { icon: CalendarCheck, label: "Child Attendance", href: "/child-attendance" },
    { icon: Wallet, label: "Child Fees", href: "/child-fees" },
    { icon: FileSpreadsheet, label: "Child Marks", href: "/child-marks" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  const menuItems = isAdmin ? adminMenuItems : role === "parent" ? parentMenuItems : studentMenuItems;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-30 hidden md:flex shadow-xl shadow-blue-900/5">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <GraduationCap className="text-primary-foreground w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-foreground">EduMaster</h1>
            <p className="text-xs text-muted-foreground font-medium">SMS Portal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-6 px-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Main Menu</p>
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border/50 bg-secondary/30">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold shadow-md">
            {displayInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{role}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-colors"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
