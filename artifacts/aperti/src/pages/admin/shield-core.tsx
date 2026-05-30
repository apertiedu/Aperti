import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Eye } from "lucide-react";

// Mock data for flagged sessions
const MOCK_FLAGGED = [
  { id: 1, student: "Ahmed S.", exam: "Physics Mock", violations: 3, status: "flagged" },
  { id: 2, student: "Mona K.", exam: "Math Final", violations: 1, status: "reviewed" },
];

export default function ShieldCore() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> ShieldCore<span className="text-primary">™</span>
        </h1>
        <p className="text-muted-foreground">Exam integrity & proctoring intelligence.</p>
      </motion.div>

      <Card className="card-hover">
        <CardHeader><CardTitle>Flagged Sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Violations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_FLAGGED.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.student}</TableCell>
                  <TableCell>{f.exam}</TableCell>
                  <TableCell>
                    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{f.violations}</Badge>
                  </TableCell>
                  <TableCell><Badge variant={f.status === "flagged" ? "destructive" : "secondary"}>{f.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" /> Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
