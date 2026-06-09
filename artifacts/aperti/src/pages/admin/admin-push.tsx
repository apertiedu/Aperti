import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchJSON, postJSON } from "@/lib/api";
import { motion } from "framer-motion";
import { Bell, Send, Users, User, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Target = "user" | "role" | "all";

export default function AdminPushPage() {
  const { toast } = useToast();
  const [target, setTarget] = useState<Target>("all");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("student");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");

  const { data: stats } = useQuery({
    queryKey: ["admin-push-stats"],
    queryFn: () => fetchJSON("/admin/push/stats"),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      postJSON("/admin/push/send", { target, userId: userId || undefined, role, title, body, url }),
    onSuccess: () => {
      toast({ title: "Push notification sent!", description: `Delivered to target: ${target}` });
      setTitle("");
      setBody("");
    },
    onError: () => {
      toast({ title: "Failed to send", variant: "destructive" });
    },
  });

  const totalSubs = stats?.total ?? 0;
  const byRole = stats?.byRole ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Push Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send web push notifications to users across the platform.
        </p>
      </div>

      {/* Subscription Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-primary/10 rounded-xl p-4 flex flex-col gap-1">
          <Bell className="w-5 h-5 text-primary" />
          <p className="text-xl font-bold text-foreground">{totalSubs}</p>
          <p className="text-[11px] text-muted-foreground">Total subscribers</p>
        </div>
        {byRole.map((r: any) => (
          <div key={r.role} className="bg-card border border-border/40 rounded-xl p-4 flex flex-col gap-1">
            <Users className="w-5 h-5 text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{r.subscribers}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{r.role}s</p>
          </div>
        ))}
      </div>

      {/* Compose Form */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-foreground">Compose Notification</h2>

        {/* Target Selector */}
        <div className="space-y-2">
          <Label>Send To</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["all", "role", "user"] as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${
                  target === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t === "all" && <Globe className="w-4 h-4" />}
                {t === "role" && <Users className="w-4 h-4" />}
                {t === "user" && <User className="w-4 h-4" />}
                <span className="capitalize">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Role / User ID */}
        {target === "role" && (
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {["student", "teacher", "parent", "admin", "assistant"].map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}s</option>
              ))}
            </select>
          </div>
        )}

        {target === "user" && (
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              type="number"
              placeholder="Enter user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <Label>Notification Title</Label>
          <Input
            placeholder="e.g. New assignment posted"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl"
            maxLength={80}
          />
          <p className="text-[11px] text-muted-foreground text-right">{title.length}/80</p>
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label>Message Body</Label>
          <Textarea
            placeholder="e.g. Your Physics homework is due tomorrow."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
            maxLength={200}
          />
          <p className="text-[11px] text-muted-foreground text-right">{body.length}/200</p>
        </div>

        {/* URL */}
        <div className="space-y-2">
          <Label>Click URL (optional)</Label>
          <Input
            placeholder="/my-homework"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>

        {/* Preview */}
        {(title || body) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/40 rounded-xl p-4 flex items-start gap-3 border border-border/40"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{title || "Notification title"}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body || "Notification body…"}</p>
            </div>
          </motion.div>
        )}

        <Button
          onClick={() => sendMutation.mutate()}
          disabled={!title || !body || sendMutation.isPending}
          className="w-full h-11 rounded-xl font-semibold text-sm"
        >
          {sendMutation.isPending ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Sending…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Notification
            </span>
          )}
        </Button>

        {sendMutation.isSuccess && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Notification dispatched successfully
          </div>
        )}
        {sendMutation.isError && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to send — check logs
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">How Push Works</p>
        <ul className="space-y-1 text-xs opacity-90">
          <li>• Users must grant notification permission from their device.</li>
          <li>• Subscribers are stored per device — users may be subscribed on multiple devices.</li>
          <li>• Expired subscriptions are automatically removed when a send fails with 410/404.</li>
          <li>• Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment secrets for persistent keys.</li>
        </ul>
      </div>
    </div>
  );
}
