import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Rocket, Clock, Mail, ArrowRight, Sparkles, Check } from "lucide-react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}

const FEATURE_GRADIENTS = [
  "from-primary/8 to-emerald-500/5 border-primary/15",
  "from-blue-500/8 to-cyan-500/5 border-blue-500/15",
  "from-purple-500/8 to-violet-500/5 border-purple-500/15",
  "from-amber-500/8 to-orange-500/5 border-amber-500/15",
  "from-rose-500/8 to-pink-500/5 border-rose-500/15",
  "from-indigo-500/8 to-blue-500/5 border-indigo-500/15",
];

export default function ComingSoonPage() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["coming-soon"],
    queryFn: () => fetchJSON("/api/coming-soon"),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Sparkles className="w-3 h-3" /> What's coming next
          </span>
          <h1 className="text-4xl font-bold text-foreground mb-3">Coming Soon</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Exciting features are in development. Join the waitlist to be notified when they launch.
          </p>
          {user?.role === "admin" && (
            <Link href="/admin/commerce">
              <button className="mt-4 text-xs text-primary hover:underline">Manage Coming Soon Items →</button>
            </Link>
          )}
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {(items as any[]).map((item: any, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-2xl border bg-gradient-to-br p-6 flex flex-col gap-4 ${FEATURE_GRADIENTS[i % FEATURE_GRADIENTS.length]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center shadow-sm border border-border/40">
                    <Rocket className="w-5 h-5 text-primary" />
                  </div>
                  {item.release_window && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/60">
                      <Clock className="w-2.5 h-2.5" /> {item.release_window}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-foreground text-base mb-1">{item.feature_name}</h3>
                  {item.description && <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>}
                </div>

                {item.demo_url && (
                  <a href={item.demo_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    View Demo <ArrowRight className="w-3 h-3" />
                  </a>
                )}

                {item.waitlist_enabled && (
                  <WaitlistButton featureName={item.feature_name} />
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && (items as any[]).length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-primary opacity-60" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Nothing announced yet</h3>
            <p className="text-sm">Check back soon — exciting features are in the pipeline.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WaitlistButton({ featureName }: { featureName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (e: string) => {
      const r = await fetch("/api/waitlist/join", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, feature: featureName }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      setEmail("");
      toast({ title: "You're on the list!", description: `We'll notify you when ${featureName} launches.` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Could not join waitlist", description: "Please try again later." });
    },
  });

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <Check className="w-3.5 h-3.5" /> On the waitlist
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs text-primary bg-background/80 hover:bg-background border border-primary/20 hover:border-primary/40 px-3 py-1.5 rounded-lg transition-colors self-start"
      >
        <Mail className="w-3 h-3" /> Join Waitlist
      </button>
    );
  }

  return (
    <form
      className="flex gap-2 self-start w-full"
      onSubmit={(ev) => { ev.preventDefault(); if (email.trim()) mutation.mutate(email.trim()); }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 text-xs border border-border rounded-lg px-3 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
      />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
      >
        {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Notify me"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setEmail(""); }}
        className="text-xs text-muted-foreground hover:text-foreground px-2"
      >
        Cancel
      </button>
    </form>
  );
}
