import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useAuth, getRoleHome } from "@/hooks/use-auth";
import type { Role } from "@shared/schema";

type RoleGuardProps = {
  allow: Role[];
  children: ReactNode;
};

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { role } = useAuth();
  const [, setLocation] = useLocation();

  if (!allow.includes(role)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4 border-none shadow-xl">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold font-display">Not Authorized</h1>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              You do not have access to this page.
            </p>

            <div className="mt-8 flex justify-end">
              <Button onClick={() => setLocation(getRoleHome(role))}>Back to Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
