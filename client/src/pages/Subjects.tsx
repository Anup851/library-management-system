import { Sidebar } from "@/components/Sidebar";
import { useClasses, useCreateSubject, useDeleteSubject, useSubjects } from "@/hooks/use-sms";
import { useXanoMyTeamMembers } from "@/hooks/use-xano-account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema, type InsertSubject } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const createSubjectFormSchema = insertSubjectSchema.extend({
  subjectTeacherId: z.number().optional(),
});

export default function Subjects() {
  const { isAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: subjects, isLoading } = useSubjects();
  const { data: classes } = useClasses();
  const createSubject = useCreateSubject();
  const deleteSubject = useDeleteSubject();
  const { data: teamMembersRaw } = useXanoMyTeamMembers();
  const teamMembers = Array.isArray(teamMembersRaw) ? (teamMembersRaw as any[]) : [];

  const form = useForm<z.infer<typeof createSubjectFormSchema>>({
    resolver: zodResolver(createSubjectFormSchema),
    defaultValues: {
      name: "",
      code: "",
      classId: undefined,
      subjectTeacherId: undefined,
    },
  });

  const onSubmit = (data: z.infer<typeof createSubjectFormSchema>) => {
    createSubject.mutate(data as InsertSubject & { subjectTeacherId?: number }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">Subjects</h1>
            <p className="text-muted-foreground mt-1">Manage subject records</p>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && <Badge variant="secondary">Read-only</Badge>}
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Subject</DialogTitle>
                    <DialogDescription>Add subject name, code, and class mapping.</DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Mathematics" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject Code</FormLabel>
                            <FormControl>
                              <Input placeholder="MATH-101" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="classId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Class</FormLabel>
                            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Class" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {classes?.map((cls: any) => (
                                  <SelectItem key={cls.id} value={String(cls.id)}>
                                    {cls.name} - {cls.section}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="subjectTeacherId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teacher</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(val === "none" ? undefined : Number(val))}
                              value={field.value ? String(field.value) : "none"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Teacher" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Not Assigned</SelectItem>
                                {teamMembers.map((member: any) => (
                                  <SelectItem key={member.id} value={String(member.id)}>
                                    {member.name || member.email || `User #${member.id}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createSubject.isPending}>
                        {createSubject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Subject
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : !subjects || subjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No subjects found</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject: any) => (
              <Card key={subject.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{subject.name || "Untitled Subject"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Code: {subject.code || "-"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Class ID: {subject.classId || subject.class || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Teacher:{" "}
                    {subject.subjectTeacherName ||
                      teamMembers.find((m: any) => Number(m.id) === Number(subject.subjectTeacherId))?.name ||
                      "Not Assigned"}
                  </p>
                  <div className="mt-4">
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={deleteSubject.isPending}
                        onClick={() => {
                          if (!confirm(`Delete subject "${subject.name || "Untitled Subject"}"?`)) return;
                          deleteSubject.mutate(Number(subject.id));
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
