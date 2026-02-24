import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useStudentMarks, useStudents } from "@/hooks/use-sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type MarksMode = "student" | "parent";

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

export default function MyMarks({ mode = "student" }: { mode?: MarksMode }) {
  const { user } = useAuth();
  const childIds = getChildIdsFromUser(user);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(childIds[0] || null);
  const studentId = mode === "parent" ? selectedChildId : getStudentIdFromUser(user);

  const { data: marks, isLoading } = useStudentMarks(studentId || undefined);
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

  const reportCards = useMemo(() => {
    if (!marks) return [];
    const byExam = new Map<string, { examTitle: string; total: number; max: number }>();
    for (const mark of marks) {
      const title = mark.exam?.title || "Exam";
      const entry = byExam.get(title) || { examTitle: title, total: 0, max: 0 };
      entry.total += Number(mark.score || 0);
      entry.max += Number(mark.maxScore || 0);
      byExam.set(title, entry);
    }
    return Array.from(byExam.values());
  }, [marks]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">
              {mode === "parent" ? "Child Marks" : "My Marks"}
            </h1>
            <p className="text-muted-foreground mt-1">View report card and subject scores</p>
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
        ) : !marks || marks.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No marks found.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border shadow-lg shadow-black/5 overflow-hidden mb-6">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marks.map((mark: any, idx: number) => (
                    <TableRow key={`${mark.examId}-${mark.subjectId}-${idx}`}>
                      <TableCell>{mark.exam?.title || "-"}</TableCell>
                      <TableCell>{mark.subject?.name || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{mark.score}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{mark.maxScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-lg shadow-black/5 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportCards.map((report) => (
                    <TableRow key={report.examTitle}>
                      <TableCell>{report.examTitle}</TableCell>
                      <TableCell className="text-right font-semibold">{report.total.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{report.max.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        {report.max > 0 ? ((report.total / report.max) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
