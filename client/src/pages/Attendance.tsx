import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useClasses, useAttendanceReport, useMarkAttendance } from "@/hooks/use-sms";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function Attendance() {
  const { isAdmin } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>("");
  const { toast } = useToast();

  const { data: classes } = useClasses();
  const { data: attendanceReport, isLoading } = useAttendanceReport(
    selectedClass ? Number(selectedClass) : 0,
    format(date, "yyyy-MM-dd")
  );
  
  const markAttendance = useMarkAttendance();
  const [localStatuses, setLocalStatuses] = useState<Record<number, "PRESENT" | "ABSENT" | "LATE">>({});

  const handleStatusChange = (studentId: number, status: "PRESENT" | "ABSENT" | "LATE") => {
    setLocalStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = () => {
    if (!selectedClass) return;
    
    // Combine existing report data with local changes
    const records = attendanceReport?.map((record: any) => ({
      id: record.id,
      studentId: record.student.id,
      status: localStatuses[record.student.id] || record.status as "PRESENT" | "ABSENT" | "LATE"
    })) || [];

    markAttendance.mutate({
      classId: Number(selectedClass),
      date: format(date, "yyyy-MM-dd"),
      records
    }, {
      onSuccess: () => {
        toast({ title: "Attendance saved successfully" });
      },
      onError: () => {
        toast({ title: "Failed to save attendance", variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-display">Attendance</h1>
              <p className="text-muted-foreground mt-1">Mark and view daily attendance records</p>
            </div>
            {!isAdmin && <Badge variant="secondary">Read-only</Badge>}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 items-start">
          <Card className="w-full md:w-auto min-w-[300px] border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Select Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name} - {cls.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {selectedClass && (
            <div className="flex-1 w-full">
               <div className="bg-card rounded-xl border border-border shadow-lg p-6">
                 <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-bold">Student List</h2>
                   {isAdmin && (
                     <Button onClick={saveAttendance} disabled={markAttendance.isPending} className="bg-primary hover:bg-primary/90 text-white">
                       {markAttendance.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                       Save Attendance
                     </Button>
                   )}
                 </div>

                 {isLoading ? (
                   <div className="p-8 text-center">Loading...</div>
                 ) : !attendanceReport || attendanceReport.length === 0 ? (
                   <div className="p-8 text-center text-muted-foreground">No students found in this class</div>
                 ) : (
                   <div className="grid grid-cols-1 gap-4">
                     {attendanceReport.map((record: any) => {
                       const currentStatus = localStatuses[record.student.id] || record.status;
                       return (
                         <div key={record.student.id} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border border-border/50">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                               {record.student.name.charAt(0)}
                             </div>
                             <div>
                               <p className="font-bold text-foreground">{record.student.name}</p>
                               <p className="text-xs text-muted-foreground font-mono">{record.student.rollNo}</p>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <button
                               onClick={() => isAdmin && handleStatusChange(record.student.id, "PRESENT")}
                               disabled={!isAdmin}
                               className={cn(
                                 "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                 !isAdmin && "opacity-60 cursor-not-allowed",
                                 currentStatus === "PRESENT" 
                                   ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                   : "bg-background text-muted-foreground hover:bg-secondary"
                               )}
                             >
                               <CheckCircle2 className="w-4 h-4" /> Present
                             </button>
                             <button
                               onClick={() => isAdmin && handleStatusChange(record.student.id, "ABSENT")}
                               disabled={!isAdmin}
                               className={cn(
                                 "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                 !isAdmin && "opacity-60 cursor-not-allowed",
                                 currentStatus === "ABSENT" 
                                   ? "bg-red-500 text-white shadow-md shadow-red-500/20" 
                                   : "bg-background text-muted-foreground hover:bg-secondary"
                               )}
                             >
                               <XCircle className="w-4 h-4" /> Absent
                             </button>
                             <button
                               onClick={() => isAdmin && handleStatusChange(record.student.id, "LATE")}
                               disabled={!isAdmin}
                               className={cn(
                                 "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                 !isAdmin && "opacity-60 cursor-not-allowed",
                                 currentStatus === "LATE" 
                                   ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                                   : "bg-background text-muted-foreground hover:bg-secondary"
                               )}
                             >
                               <Clock className="w-4 h-4" /> Late
                             </button>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
