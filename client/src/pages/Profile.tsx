import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getChildIdsFromUser(user: any): number[] {
  const raw = user?.child_ids ?? user?.childIds ?? user?.children ?? user?.students ?? [];
  const ids = Array.isArray(raw) ? raw : [raw];
  return ids.map((id) => toNumber(id)).filter((id): id is number => Boolean(id));
}

export default function Profile() {
  const { user, role } = useAuth();
  const { data: studentsData } = useStudents();
  const childIds = getChildIdsFromUser(user);
  const studentsById = new Map(
    (studentsData?.data || []).map((student: any) => [Number(student.id), student]),
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">Profile</h1>
            <p className="text-muted-foreground mt-1">Account details</p>
          </div>
          <Badge variant="secondary">Read-only</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">User Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">{user?.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{user?.username || user?.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Role:</span>{" "}
                <span className="font-medium capitalize">{role}</span>
              </div>
            </CardContent>
          </Card>

          {role === "parent" && (
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader>
                <CardTitle className="text-lg">Linked Children</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {childIds.length === 0 ? (
                  <p className="text-muted-foreground">No linked children found.</p>
                ) : (
                  childIds.map((id) => {
                    const student = studentsById.get(id);
                    return (
                      <div key={id} className="flex items-center justify-between">
                        <span className="font-medium">
                          {student?.name || `Student #${id}`}
                        </span>
                        <span className="text-muted-foreground">{student?.rollNo || ""}</span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
