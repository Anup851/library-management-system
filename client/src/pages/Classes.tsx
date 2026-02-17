import { Sidebar } from "@/components/Sidebar";
import { useClasses, useCreateClass } from "@/hooks/use-sms";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClassSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, School, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Classes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: classes, isLoading } = useClasses();
  const createClass = useCreateClass();

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
                      {cls.teacher ? cls.teacher.name : "Not Assigned"}
                    </p>
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
