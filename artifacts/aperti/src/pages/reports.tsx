import { useState } from "react";
import {
  useListAttendance,
  useAutoMarkAbsence,
  getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, CheckSquare, XSquare, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return format(d, "yyyy-MM-dd");
}

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [exporting, setExporting] = useState(false);

  const { data: records, isLoading } = useListAttendance(
    { weekStart },
    { query: { queryKey: getListAttendanceQueryKey({ weekStart }) } }
  );

  const autoMarkMutation = useAutoMarkAbsence({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ weekStart }) });
        toast({ title: "Auto-mark complete", description: res.message });
      },
      onError: (err: any) =>
        toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" }),
    },
  });

  const handleAutoMark = () => {
    if (confirm("Auto-mark all students with no attendance record this week as Absent?")) {
      autoMarkMutation.mutate({ data: { weekStart } });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = weekStart ? `?weekStart=${weekStart}` : "";
      const res = await fetch(`/api/attendance/export${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${weekStart || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not download the CSV file", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">View weekly attendance, mark absences, and export records.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-end justify-between flex-wrap gap-4 pb-4 border-b border-border/50 bg-muted/10">
          <div className="space-y-1.5">
            <Label>Week starting (Monday)</Label>
            <Input
              type="date"
              className="w-44"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
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
            <Button className="gap-2" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Downloading..." : "Export CSV"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading records...</div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Lesson</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!records || records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No records for this week.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(new Date(record.date + "T00:00:00"), "EEE, MMM d")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{record.studentCode}</TableCell>
                        <TableCell>{record.studentName}</TableCell>
                        <TableCell>Lesson {record.lessonNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{record.dayOfWeek}</TableCell>
                        <TableCell>
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                              record.status === "Present"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {record.status === "Present" ? (
                              <CheckSquare className="h-3 w-3" />
                            ) : (
                              <XSquare className="h-3 w-3" />
                            )}
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
