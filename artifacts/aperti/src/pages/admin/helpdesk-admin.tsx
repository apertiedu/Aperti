import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, Eye, CheckCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

export default function HelpDeskAdmin() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [response, setResponse] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["helpdesk", "admin"],
    queryFn: async () => {
      const res = await fetch(`${API}/helpdesk/admin/all`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`${API}/helpdesk/admin/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk", "admin"] });
      setSelectedTicket(null);
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><LifeBuoy className="h-7 w-7 text-primary" /> HelpDesk Admin</h1>
      </motion.div>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Account</TableHead><TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>{t.id}</TableCell><TableCell>{t.accountId}</TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell><Badge variant={t.priority === "urgent" ? "destructive" : "secondary"}>{t.priority}</Badge></TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setSelectedTicket(t)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{selectedTicket?.subject}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{selectedTicket?.message}</p>
            </div>
            <Textarea placeholder="Write a response..." value={response} onChange={e => setResponse(e.target.value)} />
            <Button className="w-full" onClick={() => updateMutation.mutate({ id: selectedTicket.id, data: { status: "closed", response } })}>
              <CheckCircle className="h-4 w-4 mr-2" /> Close Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
