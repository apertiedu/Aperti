import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Trash2, FileText } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

export default function PaperVaultAdmin() {
  const queryClient = useQueryClient();
  const [board, setBoard] = useState("CAIE");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [variant, setVariant] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const { data: papers, isLoading } = useQuery({
    queryKey: ["admin", "past-papers"],
    queryFn: async () => {
      const res = await fetch(`${API}/past-papers`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/past-papers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "past-papers"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/past-papers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "past-papers"] }),
  });

  const handleUpload = () => {
    uploadMutation.mutate({ board, subject, year, variant, fileUrl });
    setSubject(""); setVariant(""); setFileUrl("");
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">PaperVault Admin</h1>
        <p className="text-muted-foreground">Upload and manage past papers.</p>
      </motion.div>

      {/* Upload form */}
      <Card className="card-hover mb-8 max-w-xl">
        <CardHeader><CardTitle>Upload New Paper</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Board</Label>
              <Select value={board} onValueChange={setBoard}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAIE">CAIE</SelectItem>
                  <SelectItem value="Edexcel">Edexcel</SelectItem>
                  <SelectItem value="OxfordAQA">OxfordAQA</SelectItem>
                  <SelectItem value="IB">IB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Physics 0625" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Variant</Label><Input value={variant} onChange={e => setVariant(e.target.value)} placeholder="Paper 4" /></div>
            <div className="space-y-2"><Label>File URL</Label><Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="w-full">
            <Upload className="h-4 w-4 mr-2" /> {uploadMutation.isPending ? "Uploading…" : "Upload Paper"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing papers */}
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Board</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers?.map((paper: any) => (
              <TableRow key={paper.id}>
                <TableCell><Badge variant="secondary">{paper.board}</Badge></TableCell>
                <TableCell>{paper.subject}</TableCell>
                <TableCell>{paper.year}</TableCell>
                <TableCell>{paper.variant || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(paper.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
