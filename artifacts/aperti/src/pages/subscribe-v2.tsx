import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Lock, AlertCircle, CreditCard, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Step = "select" | "checkout" | "payment" | "pending" | "active";

const STATUS_STEPS = [
  { key: "select",   label: "Select Plan",     icon: CreditCard },
  { key: "checkout", label: "Checkout",        icon: Lock },
  { key: "payment",  label: "Submit Payment",  icon: ChevronRight },
  { key: "pending",  label: "Pending Review",  icon: Clock },
  { key: "active",   label: "Active",          icon: CheckCircle2 },
] as const;

function StepIndicator({ current }: { current: Step }) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STATUS_STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all text-xs font-bold ${
              done ? "bg-teal-600 text-white" : active ? "bg-teal-100 text-teal-700 ring-2 ring-teal-500" : "bg-gray-100 text-gray-400"
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-12 transition-all ${done ? "bg-teal-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBanner({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: any; label: string; desc: string }> = {
    inactive:             { color: "text-gray-600",    bg: "bg-gray-50",     icon: Clock,         label: "Inactive",              desc: "Choose a plan to get started." },
    pending_payment:      { color: "text-amber-700",   bg: "bg-amber-50",    icon: Clock,         label: "Pending Payment",       desc: "Submit your Instapay reference code to complete." },
    pending_confirmation: { color: "text-blue-700",    bg: "bg-blue-50",     icon: Lock,          label: "Pending Admin Review",  desc: "Payment submitted. An admin will verify shortly." },
    active:               { color: "text-emerald-700", bg: "bg-emerald-50",  icon: CheckCircle2,  label: "Active",                desc: "Your subscription is confirmed and active." },
    grace_period:         { color: "text-orange-700",  bg: "bg-orange-50",   icon: AlertCircle,   label: "Grace Period",          desc: "Renew now to avoid losing access." },
    expired:              { color: "text-red-700",      bg: "bg-red-50",      icon: AlertCircle,   label: "Expired",               desc: "Your subscription has expired. Renew below." },
    suspended:            { color: "text-rose-700",    bg: "bg-rose-50",     icon: AlertCircle,   label: "Suspended",             desc: "Contact support to restore your account." },
  };
  const cfg = map[status] ?? map.inactive;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bg} mb-4`}>
      <Icon className={`h-5 w-5 flex-shrink-0 ${cfg.color}`} />
      <div>
        <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
        <p className={`text-xs ${cfg.color} opacity-80`}>{cfg.desc}</p>
      </div>
    </div>
  );
}

export default function SubscribeV2() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [finalAmount, setFinalAmount] = useState(0);
  const [instapayCode, setInstapayCode] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const { data: plans, isLoading: plansLoading } = useQuery<any[]>({
    queryKey: ["plans-public-v2"],
    queryFn: async () => {
      const r = await fetch("/api/plans/public", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: myStatus } = useQuery<any>({
    queryKey: ["my-sub-status"],
    queryFn: async () => {
      const r = await fetch("/api/sub-engine/my-status", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-engine/initiate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, discountCode: discountCode.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (data) => {
      setSubscriptionId(data.subscription_id);
      setReference(data.reference);
      setFinalAmount(data.amount);
      setStep("payment");
    },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-engine/submit-payment", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, instapayCode, proofUrl: proofUrl || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => { setStep("pending"); },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const currentStatus = myStatus?.state ?? "inactive";

  if (currentStatus === "active") {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Subscription Active</h2>
          <p className="text-sm text-gray-500 mb-4">
            Plan: <strong>{myStatus?.subscription?.plan_name}</strong><br />
            {myStatus?.subscription?.days_remaining} days remaining
          </p>
          <Link href="/dashboard"><Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Go to Dashboard</Button></Link>
        </motion.div>
      </div>
    );
  }

  const platformPlans = (plans ?? []).filter((p: any) => p.visibility !== false);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-900">Subscribe to Aperti</h1>
          <p className="text-sm text-gray-400 mt-1">Secure · Ledger-confirmed · No activation until verified</p>
        </motion.div>

        <StepIndicator current={step} />

        {(currentStatus !== "inactive") && step === "select" && (
          <StatusBanner status={currentStatus} />
        )}

        <AnimatePresence mode="wait">

          {/* STEP: Select Plan */}
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {plansLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-white animate-pulse rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {platformPlans.map((plan: any) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`bg-white rounded-2xl p-5 cursor-pointer transition-all border-2 ${
                          isSelected ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent shadow-sm hover:border-teal-200"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <p className="font-black text-gray-900">{plan.name}</p>
                          {isSelected && <CheckCircle2 className="h-5 w-5 text-teal-600" />}
                        </div>
                        <p className="text-3xl font-black text-teal-600 mb-1">
                          EGP {parseFloat(plan.final_price_egp ?? plan.price_egp).toLocaleString()}
                          <span className="text-sm font-medium text-gray-400">/mo</span>
                        </p>
                        {plan.discount_pct > 0 && (
                          <p className="text-xs text-red-600 line-through mb-2">EGP {parseFloat(plan.price_egp).toLocaleString()}</p>
                        )}
                        <div className="space-y-1 mt-3">
                          {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((f: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />{f}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400 font-semibold uppercase">
                          {plan.type} plan · 30 days
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedPlan && (
                <Button
                  className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white gap-2 h-12 text-base font-semibold"
                  onClick={() => setStep("checkout")}
                >
                  Continue with {selectedPlan.name} <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}

          {/* STEP: Checkout Summary */}
          {step === "checkout" && selectedPlan && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-0 shadow-sm mb-4">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">{selectedPlan.name} (1 month)</span><span className="font-semibold">EGP {parseFloat(selectedPlan.price_egp).toLocaleString()}</span></div>
                    {parseFloat(selectedPlan.discount_pct ?? "0") > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Platform discount ({selectedPlan.discount_pct}%)</span>
                        <span>-EGP {(parseFloat(selectedPlan.price_egp) - parseFloat(selectedPlan.final_price_egp)).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-black text-base">
                      <span>Total</span>
                      <span className="text-teal-600">EGP {parseFloat(selectedPlan.final_price_egp ?? selectedPlan.price_egp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Discount Code (optional)</label>
                    <input
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      placeholder="Enter code"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-3">
                <Button variant="outline" className="gap-2" onClick={() => setStep("select")}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-2 h-11 font-semibold"
                  disabled={initiateMutation.isPending}
                  onClick={() => initiateMutation.mutate()}
                >
                  {initiateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Proceed to Payment
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP: Submit Instapay */}
          {step === "payment" && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-0 shadow-sm mb-4">
                <CardContent className="p-6">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5">
                    <p className="text-xs font-bold text-teal-800 mb-2">Payment Instructions</p>
                    <p className="text-sm text-teal-700">Send <strong>EGP {finalAmount.toLocaleString()}</strong> via InstaPay</p>
                    <p className="text-sm text-teal-700 mt-1">Reference code: <code className="font-mono bg-teal-100 px-1.5 py-0.5 rounded font-bold">{reference}</code></p>
                    <p className="text-xs text-teal-600 mt-2">Include this reference in your InstaPay note</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Your InstaPay Reference Code <span className="text-red-500">*</span></label>
                      <input
                        value={instapayCode}
                        onChange={(e) => setInstapayCode(e.target.value)}
                        placeholder="Enter the code from your InstaPay confirmation"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Screenshot URL (optional)</label>
                      <input
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 p-3 bg-gray-50 rounded-lg">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500">Your subscription will NOT be marked active until admin confirms payment in our ledger.</p>
                  </div>
                </CardContent>
              </Card>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2 h-11 font-semibold"
                disabled={!instapayCode.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit Payment
              </Button>
            </motion.div>
          )}

          {/* STEP: Pending */}
          {step === "pending" && (
            <motion.div key="pending" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Payment Submitted</h2>
              <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold mb-4">
                <Lock className="h-3 w-3" />Status: pending_confirmation
              </div>
              <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
                An admin will verify your payment and activate your subscription. You'll receive a notification once confirmed.
              </p>
              <p className="text-xs text-gray-400 mb-2 font-semibold">What happens next:</p>
              <div className="space-y-1.5 text-xs text-gray-600 text-left max-w-xs mx-auto mb-6">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Admin reviews your Instapay code</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Ledger entry is created</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Subscription is activated</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-500" />You receive a push notification</div>
              </div>
              <Link href="/dashboard"><Button variant="outline" className="w-full">Back to Dashboard</Button></Link>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
