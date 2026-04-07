import { useState } from "react";
import {
  useListStudents,
  useCreateStudent,
  useDeleteStudent,
  useBulkCreateStudents,
  getListStudentsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus, Upload, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function Students() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  
  const [newStudent, setNewStudent] = useState({ studentCode: "", studentName: "", timeSlot: "Morning" });
  const [bulkData, setBulkData] = useState("");

  const { data: students, isLoading } = useListStudents({
    query: { queryKey: getListStudentsQueryKey() }
  });

  const createStudentMutation = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsAddOpen(false);
        setNewStudent({ studentCode: "", studentName: "", timeSlot: "Morning" });
        toast({ title: "Student added" });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const bulkCreateMutation = useBulkCreateStudents({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsBulkOpen(false);
        setBulkData("");
        toast({ title: "Bulk import complete", description: `Added ${res.added}, Skipped ${res.skipped}` });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const deleteStudentMutation = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student deleted" });
      }
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createStudentMutation.mutate({ data: newStudent });
  };

  const handleBulkImport = () => {
    try {
      const lines = bulkData.split('\n').filter(l => l.trim() !== '');
      const parsed = lines.map(line => {
        const [code, name, slot] = line.split(',').map(s => s.trim());
        return { studentCode: code, studentName: name, timeSlot: slot || 'Morning' };
      });
      bulkCreateMutation.mutate({ data: { students: parsed } });
    } catch (e) {
      toast({ title: "Invalid format", variant: "destructive" });
    }
  };

  const filteredStudents = students?.filter(s => 
    s.studentName.toLowerCase().includes(search.toLowerCase()) || 
    s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Student Database</h1>
          <p className="text-muted-foreground">Manage enrolled students and time slots.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">Format: StudentCode, StudentName, TimeSlot (one per line)</p>
                <Textarea 
                  placeholder="S1001, John Doe, Morning&#10;S1002, Jane Smith, Afternoon"
                  className="min-h-[200px] font-mono text-sm"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />
                <Button onClick={handleBulkImport} className="w-full" disabled={bulkCreateMutation.isPending || !bulkData.trim()}>
                  {bulkCreateMutation.isPending ? "Importing..." : "Import CSV Data"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Student Code</Label>
                  <Input 
                    id="code" 
                    value={newStudent.studentCode} 
                    onChange={e => setNewStudent({...newStudent, studentCode: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input 
                    id="name" 
                    value={newStudent.studentName} 
                    onChange={e => setNewStudent({...newStudent, studentName: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot">Time Slot</Label>
                  <Select value={newStudent.timeSlot} onValueChange={v => setNewStudent({...newStudent, timeSlot: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Afternoon">Afternoon</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createStudentMutation.isPending}>
                  {createStudentMutation.isPending ? "Saving..." : "Save Student"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-9 bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading students...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[150px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents?.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono font-medium">{student.studentCode}</TableCell>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {student.timeSlot}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if(confirm('Delete student?')) {
                              deleteStudentMutation.mutate({ id: student.id });
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
