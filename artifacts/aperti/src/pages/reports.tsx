import { useState } from "react";
import {
  useListAttendance,
  useAutoMarkAbsence,
  useExportAttendance,
  getListAttendanceQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, CheckSquare, XSquare, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return format(d, 'yyyy-MM-dd');
  });

  const { data: records, isLoading } = useListAttendance(
    { weekStart },
    { query: { queryKey: getListAttendanceQueryKey({ weekStart }) } }
  );

  const autoMarkMutation = useAutoMarkAbsence({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ weekStart }) });
        toast({ title: "Auto-mark Complete", description: res.message });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const exportMutation = useExportAttendance({
    mutation: {
      onSuccess: (blob) => {
        // Assume blob is the string content of CSV (since customFetch might return text for CSV or just handle it)
        // If it's a blob, we'd need to create a URL. Let's assume it's raw text based on standard setup, or a Blob.
        const url = window.URL.createObjectURL(new Blob([blob as any]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${weekStart}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      },
      onError: (err: any) => toast({ title: "Export Failed", description: err.message, variant: "destructive" })
    }
  });

  const handleAutoMark = () => {
    if(confirm('Auto-mark all unrecorded students as Absent for this week?')) {
      autoMarkMutation.mutate({ data: { weekStart } });
    }
  };

  const handleExport = () => {
    exportMutation.mutate({ weekStart });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">View records, mark absences, and export data.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-end justify-between space-y-0 pb-4 border-b border-border/50 bg-muted/10">
          <div className="space-y-1">
            <Label>Filter by Week (Sunday)</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                className="w-40" 
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleAutoMark}
              disabled={autoMarkMutation.isPending}
            >
              <Wand2 className="h-4 w-4 text-primary" />
              {autoMarkMutation.isPending ? "Processing..." : "Auto-Mark Absences"}
            </Button>
            <Button 
              className="gap-2" 
              onClick={handleExport}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading records...</div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Student Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Lesson</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No records found for this week.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records?.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(new Date(record.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono">{record.studentCode}</TableCell>
                        <TableCell>{record.studentName}</TableCell>
                        <TableCell>Lesson {record.lessonNumber}</TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                            record.status === 'Present' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {record.status === 'Present' ? <CheckSquare className="h-3 w-3" /> : <XSquare className="h-3 w-3" />}
                            {record.status}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
