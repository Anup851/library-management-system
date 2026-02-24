import { Sidebar } from "@/components/Sidebar";
import { useDeleteExam, useExams } from "@/hooks/use-sms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function Exams() {
  const { isAdmin } = useAuth();
  const { data: exams, isLoading } = useExams();
  const deleteExam = useDeleteExam();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-display">Exams & Marks</h1>
              <p className="text-muted-foreground mt-1">Manage exam records and marks</p>
            </div>
            {!isAdmin && <Badge variant="secondary">Read-only</Badge>}
          </div>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : !exams || exams.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No exams found</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam: any) => (
              <Card key={exam.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{exam.title || "Untitled Exam"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Class ID: {exam.classId || exam.class || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Date: {exam.startDate || exam.date || "-"}
                  </p>
                  <div className="mt-4">
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={deleteExam.isPending}
                        onClick={() => {
                          if (!confirm(`Delete exam "${exam.title || "Untitled Exam"}"?`)) return;
                          deleteExam.mutate(Number(exam.id));
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
