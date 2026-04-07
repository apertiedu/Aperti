import { useState } from "react";
import {
  useListSessions,
  useCreateSession,
  useDeleteSession,
  getListSessionsQueryKey,
  CreateSessionBodyLessonNumber
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Sessions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [newSession, setNewSession] = useState({ 
    lessonNumber: 1 as CreateSessionBodyLessonNumber, 
    date: format(new Date(), 'yyyy-MM-dd'), 
    timeSlot: "Morning" 
  });

  const { data: sessions, isLoading } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() }
  });

  const createSessionMutation = useCreateSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setIsAddOpen(false);
        toast({ title: "Session created" });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const deleteSessionMutation = useDeleteSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        toast({ title: "Session deleted" });
      }
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createSessionMutation.mutate({ data: newSession });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Session Setup</h1>
          <p className="text-muted-foreground">Configure classes to enable attendance tracking.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input 
                  type="date"
                  id="date" 
                  value={newSession.date} 
                  onChange={e => setNewSession({...newSession, date: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson">Lesson Number</Label>
                <Select 
                  value={newSession.lessonNumber.toString()} 
                  onValueChange={v => setNewSession({...newSession, lessonNumber: parseInt(v, 10) as CreateSessionBodyLessonNumber})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Lesson 1</SelectItem>
                    <SelectItem value="2">Lesson 2</SelectItem>
                    <SelectItem value="3">Lesson 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot">Time Slot</Label>
                <Select value={newSession.timeSlot} onValueChange={v => setNewSession({...newSession, timeSlot: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createSessionMutation.isPending}>
                {createSessionMutation.isPending ? "Saving..." : "Create Session"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading sessions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Lesson</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No sessions found. Create one to start taking attendance.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(session.date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>Lesson {session.lessonNumber}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {session.timeSlot}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if(confirm('Delete session? This removes related attendance records.')) {
                              deleteSessionMutation.mutate({ id: session.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
