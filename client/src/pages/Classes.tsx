import { Sidebar } from "@/components/Sidebar";
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass } from "@/hooks/use-sms";
import { useXanoMyTeamMembers } from "@/hooks/use-xano-account";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClassSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, School, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Classes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTeacherByClass, setSelectedTeacherByClass] = useState<Record<number, string>>({});
  const { data: classes, isLoading } = useClasses();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const { data: teamMembersRaw } = useXanoMyTeamMembers();
  const teamMembers = Array.isArray(teamMembersRaw) ? teamMembersRaw as any[] : [];

  const form = useForm<z.infer<typeof insertClassSchema>>({
    resolver: zodResolver(insertClassSchema),
    defaultValues: {
      name: "",
      section: "",
      classTeacherId: undefined
    }
  });

  const onSubmit = (data: z.infer<typeof insertClassSchema>) => {
    createClass.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  const getTeacherIdFromClass = (cls: any) =>
    Number(cls?.classTeacherId || cls?.class_teacher_id || cls?.teacherId || 0) || undefined;

  const getTeacherName = (cls: any) => {
    const teacherId = getTeacherIdFromClass(cls);
    const matched = teamMembers.find((m) => Number(m?.id) === teacherId);
    return matched?.name || cls?.classTeacherName || cls?.teacher_name || (teacherId ? `User #${teacherId}` : "Not Assigned");
  };

  const assignTeacher = (cls: any) => {
    const rawValue = selectedTeacherByClass[Number(cls.id)] ?? String(getTeacherIdFromClass(cls) || "none");
    const teacherId = rawValue === "none" ? undefined : Number(rawValue);

    updateClass.mutate({
      id: Number(cls.id),
      classTeacherId: teacherId,
    } as any);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">Classes</h1>
            <p className="text-muted-foreground mt-1">Manage class sections and teachers</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white shadow-lg shadow-primary/25">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>Provide class name and section to add a new class.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class Name</FormLabel>
                        <FormControl><Input placeholder="Class 10" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="section"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Section</FormLabel>
                        <FormControl><Input placeholder="A" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                      )}
                    />
                  <FormField
                    control={form.control}
                    name="classTeacherId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class Teacher</FormLabel>
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
                  <Button type="submit" className="w-full" disabled={createClass.isPending}>
                    {createClass.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Class
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes?.map((cls: any) => (
              <Card key={cls.id} className="border-none shadow-md hover:shadow-xl transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xl font-display">{cls.name}</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <span className="font-bold">{cls.section}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <School className="w-4 h-4" />
                    <span>Section {cls.section}</span>
                  </div>
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Class Teacher</p>
                    <p className="text-sm font-medium mt-1">
                      {getTeacherName(cls)}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Select
                        value={selectedTeacherByClass[Number(cls.id)] ?? String(getTeacherIdFromClass(cls) || "none")}
                        onValueChange={(val) =>
                          setSelectedTeacherByClass((prev) => ({ ...prev, [Number(cls.id)]: val }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Assign teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not Assigned</SelectItem>
                          {teamMembers.map((member: any) => (
                            <SelectItem key={member.id} value={String(member.id)}>
                              {member.name || member.email || `User #${member.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateClass.isPending}
                        onClick={() => assignTeacher(cls)}
                      >
                        {updateClass.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={deleteClass.isPending}
                        onClick={() => {
                          if (!confirm(`Delete class "${cls.name}"?`)) return;
                          deleteClass.mutate(Number(cls.id));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
