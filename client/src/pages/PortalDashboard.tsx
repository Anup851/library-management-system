import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function PortalDashboard() {
  const { role, user } = useAuth();
  const displayName = user?.name || user?.username || "User";

  const cards =
    role === "parent"
      ? [
          { label: "Child Attendance", href: "/child-attendance" },
          { label: "Child Fees", href: "/child-fees" },
          { label: "Child Marks", href: "/child-marks" },
          { label: "Profile", href: "/profile" },
        ]
      : [
          { label: "My Attendance", href: "/my-attendance" },
          { label: "My Fees", href: "/my-fees" },
          { label: "My Marks", href: "/my-marks" },
          { label: "Profile", href: "/profile" },
        ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground font-display">Welcome, {displayName}</h1>
          <p className="text-muted-foreground mt-1 capitalize">Portal access for {role}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <Card key={card.href} className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={card.href}>
                  <Button className="w-full">Open</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
