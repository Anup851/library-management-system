import { Sidebar } from "@/components/Sidebar";
import { useFees, useCreateFee, useStudents } from "@/hooks/use-sms";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeeSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function Fees() {
  const { isAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: fees, isLoading } = useFees();
  const { data: students } = useStudents();
  const createFee = useCreateFee();

  const form = useForm<z.infer<typeof insertFeeSchema>>({
    resolver: zodResolver(insertFeeSchema),
    defaultValues: {
      studentId: undefined,
      amount: undefined,
      method: "CASH",
      receiptNo: "",
      description: ""
    }
  });

  const onSubmit = (data: z.infer<typeof insertFeeSchema>) => {
    createFee.mutate({
      ...data,
      amount: data.amount.toString() as any // Handling decimal/string conversion for schema
    }, {
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
            <h1 className="text-3xl font-bold text-foreground font-display">Fees Collection</h1>
            <p className="text-muted-foreground mt-1">Track payments and manage fee records</p>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && <Badge variant="secondary">Read-only</Badge>}
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4 mr-2" />
                    Collect Fee
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>New Fee Payment</DialogTitle>
                    <DialogDescription>Record a fee payment for a student.</DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="studentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student</FormLabel>
                            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Student" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {students?.data.map((student: any) => (
                                  <SelectItem key={student.id} value={student.id.toString()}>
                                    {student.name} ({student.rollNo})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="method"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="CASH">Cash</SelectItem>
                                  <SelectItem value="ONLINE">Online</SelectItem>
                                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="receiptNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt No</FormLabel>
                            <FormControl><Input placeholder="R-1001" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Input placeholder="Monthly Tuition Fee" {...field} value={field.value || ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={createFee.isPending}>
                        {createFee.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Record Payment
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-lg shadow-black/5 overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Receipt No</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8">Loading...</TableCell></TableRow>
              ) : fees?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">No records found</TableCell></TableRow>
              ) : (
                fees?.map((fee: any) => (
                  <TableRow key={fee.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{fee.receiptNo}</TableCell>
                    <TableCell className="font-medium">{fee.student?.name}</TableCell>
                    <TableCell>{fee.description}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-secondary rounded text-xs font-semibold">{fee.method}</span>
                    </TableCell>
                    <TableCell>{format(new Date(fee.paymentDate!), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      ${Number(fee.amount).toFixed(2)}
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
