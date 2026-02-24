import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/RoleGuard";
import NotFound from "@/pages/not-found";
import AuthLogin from "@/pages/AuthLogin";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Classes from "@/pages/Classes";
import Attendance from "@/pages/Attendance";
import Fees from "@/pages/Fees";
import Subjects from "@/pages/Subjects";
import Exams from "@/pages/Exams";
import PortalDashboard from "@/pages/PortalDashboard";
import MyAttendance from "@/pages/MyAttendance";
import MyFees from "@/pages/MyFees";
import MyMarks from "@/pages/MyMarks";
import Profile from "@/pages/Profile";
import ChildAttendance from "@/pages/ChildAttendance";
import ChildFees from "@/pages/ChildFees";
import ChildMarks from "@/pages/ChildMarks";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function HomeRoute() {
  const { role } = useAuth();
  return role === "admin" ? <Dashboard /> : <PortalDashboard />;
}

function PortalRoute() {
  const { role } = useAuth();
  return role === "admin" ? <Dashboard /> : <PortalDashboard />;
}

function AdminStudents() {
  return (
    <RoleGuard allow={["admin"]}>
      <Students />
    </RoleGuard>
  );
}

function AdminClasses() {
  return (
    <RoleGuard allow={["admin"]}>
      <Classes />
    </RoleGuard>
  );
}

function AdminAttendance() {
  return (
    <RoleGuard allow={["admin"]}>
      <Attendance />
    </RoleGuard>
  );
}

function AdminSubjects() {
  return (
    <RoleGuard allow={["admin"]}>
      <Subjects />
    </RoleGuard>
  );
}

function AdminExams() {
  return (
    <RoleGuard allow={["admin"]}>
      <Exams />
    </RoleGuard>
  );
}

function AdminFees() {
  return (
    <RoleGuard allow={["admin"]}>
      <Fees />
    </RoleGuard>
  );
}

function StudentAttendance() {
  return (
    <RoleGuard allow={["student"]}>
      <MyAttendance />
    </RoleGuard>
  );
}

function StudentFees() {
  return (
    <RoleGuard allow={["student"]}>
      <MyFees />
    </RoleGuard>
  );
}

function StudentMarks() {
  return (
    <RoleGuard allow={["student"]}>
      <MyMarks />
    </RoleGuard>
  );
}

function ParentAttendance() {
  return (
    <RoleGuard allow={["parent"]}>
      <ChildAttendance />
    </RoleGuard>
  );
}

function ParentFees() {
  return (
    <RoleGuard allow={["parent"]}>
      <ChildFees />
    </RoleGuard>
  );
}

function ParentMarks() {
  return (
    <RoleGuard allow={["parent"]}>
      <ChildMarks />
    </RoleGuard>
  );
}

function ProfileRoute() {
  return (
    <RoleGuard allow={["student", "parent"]}>
      <Profile />
    </RoleGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth/login" component={AuthLogin} />
      <Route path="/">
        <ProtectedRoute component={HomeRoute} />
      </Route>
      <Route path="/portal">
        <ProtectedRoute component={PortalRoute} />
      </Route>
      <Route path="/students">
        <ProtectedRoute component={AdminStudents} />
      </Route>
      <Route path="/classes">
        <ProtectedRoute component={AdminClasses} />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={AdminAttendance} />
      </Route>
      <Route path="/subjects">
        <ProtectedRoute component={AdminSubjects} />
      </Route>
      <Route path="/exams">
        <ProtectedRoute component={AdminExams} />
      </Route>
      <Route path="/fees">
        <ProtectedRoute component={AdminFees} />
      </Route>
      <Route path="/my-attendance">
        <ProtectedRoute component={StudentAttendance} />
      </Route>
      <Route path="/my-fees">
        <ProtectedRoute component={StudentFees} />
      </Route>
      <Route path="/my-marks">
        <ProtectedRoute component={StudentMarks} />
      </Route>
      <Route path="/child-attendance">
        <ProtectedRoute component={ParentAttendance} />
      </Route>
      <Route path="/child-fees">
        <ProtectedRoute component={ParentFees} />
      </Route>
      <Route path="/child-marks">
        <ProtectedRoute component={ParentMarks} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfileRoute} />
      </Route>
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
