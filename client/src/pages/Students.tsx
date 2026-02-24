import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useStudents, useCreateStudent, useClasses, useDeleteStudent } from "@/hooks/use-sms";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudentSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Filter, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function Students() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: studentsData, isLoading } = useStudents({ 
    search: search || undefined,
    classId: classFilter !== "all" ? Number(classFilter) : undefined 
  });
  
  const { data: classes } = useClasses();
  const createStudent = useCreateStudent();
  const deleteStudent = useDeleteStudent();
  const classOptions = (classes || [])
    .map((cls: any) => ({
      id: Number(cls?.id),
      name: cls?.name || cls?.className || "Class",
      section: cls?.section || cls?.classSection || "",
    }))
    .filter((cls) => Number.isFinite(cls.id) && cls.id > 0);

  const form = useForm<z.infer<typeof insertStudentSchema>>({
    resolver: zodResolver(insertStudentSchema),
    defaultValues: {
      name: "",
      rollNo: "",
      email: "",
      phone: "",
      classId: undefined,
      gender: "Male",
      status: "ACTIVE"
    }
  });

  const onSubmit = (data: z.infer<typeof insertStudentSchema>) => {
    createStudent.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-display">Students</h1>
            <p className="text-muted-foreground mt-1">Manage student enrollment and details</p>
          </div>
          
          <div className="flex items-center gap-3">
            {!isAdmin && <Badge variant="secondary">Read-only</Badge>}
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Enroll New Student</DialogTitle>
                    <DialogDescription>Enter student details and assign a class to create a new record.</DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="rollNo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Roll No</FormLabel>
                              <FormControl><Input placeholder="S-101" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input type="email" placeholder="john@example.com" {...field} value={field.value || ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
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
                                  {classOptions.map((cls: any) => (
                                    <SelectItem key={cls.id} value={cls.id.toString()}>
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
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gender</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "Male"}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Gender" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Male">Male</SelectItem>
                                  <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={createStudent.isPending}>
                        {createStudent.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Student
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or roll number..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id.toString()}>
                    {cls.name} - {cls.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-lg shadow-black/5 overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                </TableRow>
              ) : studentsData?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                studentsData?.data.map((student: any) => (
                  <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium font-mono text-xs">{student.rollNo || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {(student.name || "U").charAt(0)}
                        </div>
                        <span className="font-medium">{student.name || "Unknown Student"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.class?.name || "-"} {student.class?.section ? `(${student.class.section})` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{student.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"} className={student.status === "ACTIVE" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={deleteStudent.isPending}
                          onClick={() => {
                            if (!confirm(`Delete student "${student.name || "Unknown Student"}"?`)) return;
                            deleteStudent.mutate(Number(student.id));
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
