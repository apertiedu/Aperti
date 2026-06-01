import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function SubPilotAdmin() {
  const queryClient = useQueryClient();
  const { data: subs, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchJSON("/subscriptions/admin/all"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/subscriptions/admin/${id}/approve`, { method: "PUT", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">SubPilot Admin</h1>
        <p className="text-muted-foreground">Manage subscriptions and approve InstaPay payments.</p>
      </motion.div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Card className="card-hover">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>InstaPay Code</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs?.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell>{sub.accountId}</TableCell>
                    <TableCell>{sub.plan?.name}</TableCell>
                    <TableCell><Badge variant={sub.status === "pending_review" ? "secondary" : "default"}>{sub.status}</Badge></TableCell>
                    <TableCell>{sub.instaPayCode || "—"}</TableCell>
                    <TableCell>
                      {sub.status === "pending_review" && (
                        <Button size="sm" onClick={() => approveMutation.mutate(sub.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
