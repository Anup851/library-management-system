import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useStudentAttendance, useStudents } from "@/hooks/use-sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type AttendanceMode = "student" | "parent";

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getStudentIdFromUser(user: any): number | null {
  return (
    toNumber(user?.student_id) ??
    toNumber(user?.studentId) ??
    toNumber(user?.student?.id) ??
    null
  );
}

function getChildIdsFromUser(user: any): number[] {
  const raw = user?.child_ids ?? user?.childIds ?? user?.children ?? user?.students ?? [];
  const ids = Array.isArray(raw) ? raw : [raw];
  return ids.map((id) => toNumber(id)).filter((id): id is number => Boolean(id));
}

export default function MyAttendance({ mode = "student" }: { mode?: AttendanceMode }) {
  const { user } = useAuth();
  const childIds = getChildIdsFromUser(user);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(childIds[0] || null);

  const studentId = mode === "parent" ? selectedChildId : getStudentIdFromUser(user);
  const { data: attendance, isLoading } = useStudentAttendance(studentId || undefined);
  const { data: studentsData } = useStudents();

  const childOptions = useMemo(() => {
    if (!studentsData?.data) return [];
    const byId = new Map(studentsData.data.map((s: any) => [Number(s.id), s]));
    return childIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((student: any) => ({
        id: Number(student.id),
        name: student.name || `Student #${student.id}`,
        rollNo: student.rollNo || "",
      }));
  }, [studentsData, childIds]);

  useEffect(() => {
    if (!selectedChildId && childIds.length > 0) {
      setSelectedChildId(childIds[0]);
    }
  }, [childIds, selectedChildId]);

  const title = mode === "parent" ? "Child Attendance" : "My Attendance";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">{title}</h1>
            <p className="text-muted-foreground mt-1">View attendance records</p>
          </div>
          <Badge variant="secondary">Read-only</Badge>
        </div>

        {mode === "parent" && (
          <Card className="mb-6 border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Select Child</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedChildId ? String(selectedChildId) : ""}
                onValueChange={(value) => setSelectedChildId(Number(value))}
              >
                <SelectTrigger className="w-full md:w-[320px]">
                  <SelectValue placeholder="Select Child" />
                </SelectTrigger>
                <SelectContent>
                  {childOptions.map((child) => (
                    <SelectItem key={child.id} value={String(child.id)}>
                      {child.name} {child.rollNo ? `(${child.rollNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {!studentId ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No student profile is linked to this account.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div>Loading...</div>
        ) : !attendance || attendance.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No attendance records found.
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-lg shadow-black/5 overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((record: any) => (
                  <TableRow key={record.id ?? `${record.date}-${record.status}`}>
                    <TableCell>
                      {record.date ? format(new Date(record.date), "MMM dd, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={record.status === "PRESENT" ? "default" : "secondary"}
                        className={record.status === "PRESENT" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.class?.name || "-"} {record.class?.section ? `(${record.class.section})` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
