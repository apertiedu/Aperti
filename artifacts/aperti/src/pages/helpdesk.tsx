import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, Plus, Clock, CheckCircle } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function HelpDesk() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["helpdesk", "my"],
    queryFn: () => fetchJSON("/helpdesk/my"),
  });
  const createMutation = useMutation({
    mutationFn: (data: any) => fetchJSON("/helpdesk", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk", "my"] });
      setDialogOpen(false);
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-primary" /> HelpDesk<span className="text-primary"></span>
          </h1>
          <p className="text-muted-foreground">Get help directly from the admin team.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create a Support Ticket</DialogTitle></DialogHeader>
            <TicketForm onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : tickets?.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-8 text-center text-muted-foreground">No tickets yet. We're here 24/7.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets?.map((ticket: any) => (
            <Card key={ticket.id} className="card-hover">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">{ticket.message}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={ticket.priority === "urgent" ? "destructive" : "secondary"}>{ticket.priority}</Badge>
                    <Badge variant="outline">{ticket.status}</Badge>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ subject, message, priority });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2"><Label>Subject</Label><Input required value={subject} onChange={e => setSubject(e.target.value)} /></div>
      <div className="space-y-2"><Label>Message</Label><Textarea rows={4} required value={message} onChange={e => setMessage(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Submitting…" : "Submit Ticket"}
      </Button>
    </form>
  );
}
