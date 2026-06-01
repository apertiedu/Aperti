import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, FileText, BookOpen } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const BOARDS = ["CAIE", "Edexcel", "OxfordAQA", "IB"];

export default function PaperVault() {
  const [board, setBoard] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");

  const queryParams = new URLSearchParams();
  if (board) queryParams.set("board", board);
  if (subject) queryParams.set("subject", subject);
  if (year) queryParams.set("year", year);

  const { data: papers, isLoading } = useQuery({
    queryKey: ["past-papers", board, subject, year],
    queryFn: () => fetchJSON(`/past-papers?${queryParams.toString()}`),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <h1 className="text-3xl font-bold">PaperVault<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Free past papers, open to everyone.</p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 max-w-3xl mx-auto">
        <Select value={board} onValueChange={setBoard}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Boards" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Boards</SelectItem>
            {BOARDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Subject (e.g., Physics 0625)" className="pl-9" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <Input placeholder="Year" className="w-24" value={year} onChange={e => setYear(e.target.value)} />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : papers?.length === 0 ? (
        <Card className="card-hover max-w-md mx-auto">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2" />
            No papers found. Try different filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {papers?.map((paper: any) => (
            <motion.div key={paper.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{paper.subject}</CardTitle>
                    <Badge variant="secondary">{paper.board}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground mb-4">
                    <span>{paper.year}</span>
                    <span>{paper.variant || "Standard"}</span>
                  </div>
                  <a href={paper.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
