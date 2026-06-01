import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { Bell, CheckCircle2, Mail, Users, Calendar, AlertCircle } from "lucide-react";

const API = "/api";

export default function GuardianPulseAdmin() {
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`${API}/guardian-pulse/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token")}` },
      }).then(r => r.json()),
    onSuccess: (data) => setResult({ success: true, message: data.message || "Notifications sent successfully." }),
    onError: () => setResult({ success: false, message: "Failed to send notifications. Check server configuration." }),
  });

  const info = [
    { icon: Mail, label: "Weekly summary", desc: "Attendance, grades, and homework overview per student" },
    { icon: Users, label: "All parents", desc: "Sent to every parent with a registered email address" },
    { icon: Calendar, label: "On demand", desc: "Trigger manually or schedule as a weekly cron job" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GuardianPulse</h1>
            <p className="text-sm text-gray-500">Send weekly progress summaries to all parent accounts</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        {/* Trigger card */}
        <Card className="border-0 shadow-sm md:col-span-2 max-w-md">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Send Notification Batch</CardTitle>
            <CardDescription>
              This will immediately dispatch a progress summary email to every parent who has an email address on record.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
                  result.success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {result.success
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <span>{result.message}</span>
              </motion.div>
            )}
            <Button
              onClick={() => { setResult(null); mutation.mutate(); }}
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Bell className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Sending…" : "Send Weekly Summary Now"}
            </Button>
            <p className="text-xs text-muted-foreground">
              To automate this, configure a weekly cron job on your server to POST to <code className="bg-muted px-1 rounded">/api/guardian-pulse/trigger</code>.
            </p>
          </CardContent>
        </Card>

        {/* Info cards */}
        {info.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
          >
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
