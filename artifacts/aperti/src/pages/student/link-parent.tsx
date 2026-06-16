import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, CheckCircle2, Users, Clock, Link2, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";


const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

interface MyLink {
  id: number;
  status: string;
  pairing_code: string;
  requested_at: string;
}

export default function LinkParent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: links = [], isLoading } = useQuery<MyLink[]>({
    queryKey: ["my-parent-links"],
    queryFn: () => authFetch("/parent/my-links").then(r => r.json()),
  });

  const linkMutation = useMutation({
    mutationFn: (pairingCode: string) =>
      authFetch("/parent/link-student", {
        method: "POST",
        body: JSON.stringify({ pairingCode }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to link");
        return data;
      }),
    onSuccess: () => {
      setSubmitted(true);
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-parent-links"] });
      toast({ title: "Link request sent! ✅", description: "Your parent will see and approve the connection shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    linkMutation.mutate(code.trim().toUpperCase());
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          Link to a Parent
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter your parent's pairing code to connect your accounts. They'll approve the request from their Parent Hub.
        </p>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Enter Parent Pairing Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Ask your parent to open their <strong>Parent Hub → Link Your Child</strong> page and share their 8-character code.
          </p>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/8"
                >
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <p className="font-bold text-gray-900 mb-1">Request sent!</p>
                <p className="text-sm text-gray-500 mb-4">
                  Your parent will review and approve the connection.
                </p>
                <Button
                  variant="outline"
                  className="rounded-xl border-gray-200 text-sm"
                  onClick={() => setSubmitted(false)}
                >
                  Link another parent
                </Button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="flex gap-3"
              >
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A3F7B2D1"
                  maxLength={8}
                  className="flex-1 h-12 rounded-xl text-center font-mono text-lg font-black tracking-[0.25em] border-gray-200 uppercase text-primary"
                  disabled={linkMutation.isPending}
                />
                <Button
                  type="submit"
                  className="h-12 px-6 rounded-xl font-semibold gap-2 text-white bg-primary text-primary-foreground"
                  disabled={linkMutation.isPending || code.length < 6}
                >
                  {linkMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Link <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            My Parent Connections ({isLoading ? "…" : links.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1].map(i => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No parent connections yet</p>
              <p className="text-xs mt-1">Enter a pairing code above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link, i) => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-primary text-primary-foreground"
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 font-mono tracking-widest">
                        {link.pairing_code}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(link.requested_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] rounded-full px-2.5 ${
                      link.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : link.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {link.status === "active" ? "✓ Linked" : link.status === "pending" ? "Awaiting approval" : "Rejected"}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-2xl p-4 text-xs text-gray-500 border border-dashed border-gray-200 bg-primary/8">
        <p className="font-semibold mb-1 text-primary">How it works</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Your parent logs in and goes to <strong>Link Your Child</strong> in their portal.</li>
          <li>They share their 8-character pairing code with you.</li>
          <li>You enter the code above — your parent approves and you're connected.</li>
          <li>Your parent can then view your attendance, progress, and grades.</li>
        </ol>
      </div>
    </div>
  );
}
