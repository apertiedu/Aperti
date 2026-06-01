// grade-flow.tsx — Teacher's Grading View for an Exam
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Sparkles, Eye } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

export default function GradeFlow() {
  const examId = 0;
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["exam", examId, "submissions"],
    queryFn: async () => {
      const res = await fetch(`${API}/exams/${examId}/submissions`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
  });

  const gradeMutation = useMutation({
    mutationFn: (submissionId: number) =>
      fetch(`${API}/grading/submission/${submissionId}/grade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam", examId, "submissions"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Submissions</h2>
        <Button variant="outline" onClick={() => submissions?.forEach((s: any) => gradeMutation.mutate(s.id))}>
          <Sparkles className="h-4 w-4 mr-2" /> Auto‑Grade All
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions?.map((sub: any) => (
              <TableRow key={sub.id}>
                <TableCell>{sub.studentId}</TableCell>
                <TableCell>{sub.questionId}</TableCell>
                <TableCell>{sub.marksScored || "Pending"}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelectedSubmission(sub)}>
                    <Eye className="h-4 w-4 mr-1" /> Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Auto‑Grade Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Submission Details</DialogTitle></DialogHeader>
          {selectedSubmission && (
            <div className="space-y-3 mt-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Student Answer:</p>
                <p className="text-sm mt-1">{selectedSubmission.mistakes || "No answer provided"}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  gradeMutation.mutate(selectedSubmission.id);
                  setSelectedSubmission(null);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Auto‑Grade This Answer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
