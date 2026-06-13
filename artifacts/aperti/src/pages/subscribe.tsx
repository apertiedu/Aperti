import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Upload, Clock, ChevronRight, Loader2, X } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}
async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

type Step = "review" | "payment" | "proof" | "confirmed";

export default function SubscribePage() {
  const [, params] = useRoute("/subscribe/:planId");
  const planId = parseInt(params?.planId ?? "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("review");
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: plans = [] } = useQuery({ queryKey: ["plans-public"], queryFn: () => fetchJSON("/api/plans/public") });
  const plan = plans.find((p: any) => p.id === planId);

  const subscribeMut = useMutation({
    mutationFn: () => postJSON("/api/commerce/subscribe", { planId }),
    onSuccess: (data) => {
      if (data.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setPaymentRequest(data);
      setStep("payment");
    },
  });

  const proofMut = useMutation({
    mutationFn: () => postJSON("/api/commerce/upload-proof", {
      paymentRequestId: paymentRequest?.paymentRequest?.id,
      proofUrl,
    }),
    onSuccess: () => setStep("confirmed"),
    onError: () => toast({ title: "Error uploading proof", variant: "destructive" }),
  });

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps: { id: Step; label: string }[] = [
    { id: "review", label: "Plan" },
    { id: "payment", label: "Payment" },
    { id: "proof", label: "Proof" },
    { id: "confirmed", label: "Done" },
  ];
  const stepIndex = steps.findIndex(s => s.id === step);

  if (!plan && plans.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Plan not found.</p>
          <button onClick={() => navigate("/pricing")} className="mt-4 text-teal-600 hover:underline text-sm">← Back to Pricing</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/40 to-white py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < stepIndex ? "bg-teal-500 text-white" : i === stepIndex ? "bg-teal-600 text-white ring-4 ring-teal-100" : "bg-gray-100 text-gray-400"}`}>
                {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === stepIndex ? "text-teal-700" : "text-gray-400"}`}>{s.label}</span>
              {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Review */}
          {step === "review" && (
            <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Review your plan</h2>
                {plan ? (
                  <>
                    <div className="mt-4 p-4 bg-teal-50 rounded-xl border border-teal-100 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-teal-800 text-lg">{plan.name}</p>
                        <p className="text-sm text-teal-600 capitalize">{plan.type} plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-700">{Number(plan.price_egp).toLocaleString()} <span className="text-sm font-normal">EGP</span></p>
                        <p className="text-xs text-teal-500">per month</p>
                      </div>
                    </div>
                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <ul className="mt-5 space-y-2">
                        {plan.features.map((f: string, i: number) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <Check className="w-4 h-4 text-teal-500 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 border border-gray-100">
                      <p>💡 Payment is manual via InstaPay. After clicking continue, you'll receive payment instructions and a unique reference code.</p>
                    </div>
                    <button
                      onClick={() => subscribeMut.mutate()}
                      disabled={subscribeMut.isPending}
                      className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                    >
                      {subscribeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Continue to Payment
                    </button>
                  </>
                ) : (
                  <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Payment instructions */}
          {step === "payment" && paymentRequest && (
            <motion.div key="payment" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Make your payment</h2>
                <p className="text-sm text-gray-500 mb-5">Send the exact amount via InstaPay using the details below.</p>

                <div className="space-y-3">
                  <InfoRow label="InstaPay Phone" value={paymentRequest.instapay?.phone ?? "—"} />
                  <InfoRow label="Account Name" value={paymentRequest.instapay?.name ?? "—"} />
                  <InfoRow label="Amount" value={`${paymentRequest.instapay?.amount?.toLocaleString()} EGP`} highlight />
                  <div className="flex items-center justify-between p-3.5 bg-teal-50 border border-teal-200 rounded-xl">
                    <div>
                      <p className="text-[10px] text-teal-500 uppercase font-bold tracking-wider">Reference Code</p>
                      <p className="font-mono font-bold text-teal-800 text-lg mt-0.5">{paymentRequest.instapay?.reference}</p>
                    </div>
                    <button
                      onClick={() => copyRef(paymentRequest.instapay?.reference)}
                      className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 bg-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                  ⚠️ Always include the reference code in the payment note so we can match your transaction.
                </div>

                <button
                  onClick={() => setStep("proof")}
                  className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold transition-colors"
                >
                  I've Sent the Payment →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Upload proof */}
          {step === "proof" && (
            <motion.div key="proof" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Upload payment proof</h2>
                <p className="text-sm text-gray-500 mb-5">Paste a link to your payment screenshot (hosted on Google Drive, Imgur, etc.) so we can verify your payment quickly.</p>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Screenshot URL</label>
                  <input
                    type="url"
                    value={proofUrl}
                    onChange={e => setProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>

                <button
                  onClick={() => proofMut.mutate()}
                  disabled={!proofUrl || proofMut.isPending}
                  className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {proofMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Submit Proof
                </button>
                <button onClick={() => setStep("payment")} className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Confirmed */}
          {step === "confirmed" && (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Clock className="w-8 h-8 text-teal-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Pending Verification</h2>
                <p className="text-gray-500 text-sm mb-6">Your payment proof has been received. Our team will review and activate your account within 24 hours.</p>
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium px-4 py-2 rounded-full mb-6">
                  <Clock className="w-3.5 h-3.5" /> Awaiting admin verification
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
                    Go to Dashboard
                  </button>
                  <button onClick={() => navigate("/account/subscription")} className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                    My Subscription
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${highlight ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"}`}>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-gray-900" : "text-gray-600"}`}>{value}</span>
    </div>
  );
}
