import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Upload, Clock, ChevronRight, Loader2, AlertCircle, ArrowLeft, Shield, Zap } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchJSON, postJSON } from "@/lib/api";

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

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans-public"],
    queryFn: () => fetchJSON("/api/plans/public"),
  });
  const plan = (plans as any[]).find((p: any) => p.id === planId);

  const subscribeMut = useMutation({
    mutationFn: () => postJSON("/api/commerce/subscribe", { planId }),
    onSuccess: (data: any) => {
      if (data.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setPaymentRequest(data);
      setStep("payment");
    },
    onError: (err: any) => {
      toast({ title: "Could not start payment", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const proofMut = useMutation({
    mutationFn: () => postJSON("/api/commerce/upload-proof", {
      paymentRequestId: paymentRequest?.paymentRequest?.id,
      proofUrl: proofUrl.trim(),
    }),
    onSuccess: () => setStep("confirmed"),
    onError: (err: any) => {
      toast({ title: "Could not submit proof", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const steps: { id: Step; label: string }[] = [
    { id: "review", label: "Plan" },
    { id: "payment", label: "Payment" },
    { id: "proof", label: "Proof" },
    { id: "confirmed", label: "Done" },
  ];
  const stepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/40 via-white to-gray-50/30 py-10 px-4">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < stepIndex
                    ? "bg-teal-500 text-white shadow-sm shadow-teal-200"
                    : i === stepIndex
                      ? "bg-teal-600 text-white ring-4 ring-teal-100 shadow-md shadow-teal-200"
                      : "bg-white text-gray-400 border border-gray-200"
                }`}>
                  {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide ${i === stepIndex ? "text-teal-700" : i < stepIndex ? "text-teal-500" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 mb-5 mx-1 transition-colors duration-300 ${i < stepIndex ? "bg-teal-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "review" && (
            <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Review your plan</h2>
                <p className="text-sm text-gray-500 mb-6">Confirm the details below before proceeding to payment.</p>

                {plansLoading ? (
                  <div className="space-y-3">
                    <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
                    <div className="h-4 rounded bg-gray-100 animate-pulse w-3/4" />
                    <div className="h-4 rounded bg-gray-100 animate-pulse w-1/2" />
                  </div>
                ) : !plan ? (
                  <div className="text-center py-10">
                    <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Plan not found.</p>
                    <button onClick={() => navigate("/pricing")} className="mt-4 text-teal-600 hover:underline text-sm inline-flex items-center gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" /> Browse plans
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-5 bg-gradient-to-br from-teal-50 to-emerald-50/60 rounded-xl border border-teal-100 flex items-center justify-between mb-5">
                      <div>
                        <p className="font-bold text-teal-800 text-lg">{plan.name}</p>
                        <p className="text-sm text-teal-600 capitalize mt-0.5">{plan.type} plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-700">{Number(plan.price_egp).toLocaleString()}<span className="text-sm font-normal ml-1">EGP</span></p>
                        <p className="text-xs text-teal-500 mt-0.5">per month</p>
                      </div>
                    </div>

                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <ul className="space-y-2 mb-5">
                        {plan.features.map((f: string, i: number) => (
                          <li key={i} className="flex items-center gap-2.5 text-sm text-gray-600">
                            <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 text-teal-600" />
                            </div>
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="p-3.5 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100 flex gap-2 mb-5">
                      <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                      <span>Payment is via InstaPay. You'll get a unique reference code and payment instructions after clicking continue.</span>
                    </div>

                    {subscribeMut.isError && (
                      <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                        {(subscribeMut.error as any)?.message ?? "Could not start payment. Please try again."}
                      </div>
                    )}

                    <button
                      onClick={() => subscribeMut.mutate()}
                      disabled={subscribeMut.isPending}
                      className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60 shadow-sm shadow-teal-200 hover:shadow-md hover:shadow-teal-200 text-sm"
                    >
                      {subscribeMut.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      ) : (
                        <><Zap className="w-4 h-4" /> Continue to Payment</>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {step === "payment" && paymentRequest && (
            <motion.div key="payment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Make your payment</h2>
                <p className="text-sm text-gray-500 mb-6">Send the exact amount via InstaPay using the details below.</p>

                <div className="space-y-2.5">
                  <InfoRow label="InstaPay Phone" value={paymentRequest.instapay?.phone ?? "—"} />
                  <InfoRow label="Account Name" value={paymentRequest.instapay?.name ?? "—"} />
                  <InfoRow label="Amount" value={`${paymentRequest.instapay?.amount?.toLocaleString()} EGP`} highlight />

                  <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-xl">
                    <div>
                      <p className="text-[10px] text-teal-500 uppercase font-bold tracking-wider mb-1">Reference Code</p>
                      <p className="font-mono font-bold text-teal-800 text-xl">{paymentRequest.instapay?.reference}</p>
                    </div>
                    <button
                      onClick={() => copyRef(paymentRequest.instapay?.reference)}
                      className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 bg-white px-3 py-2 rounded-lg transition-colors hover:bg-teal-50"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                  Always include the reference code in the payment note so we can match your transaction.
                </div>

                <button
                  onClick={() => setStep("proof")}
                  className="w-full mt-5 py-3.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold transition-all text-sm shadow-sm shadow-teal-200"
                >
                  I've Sent the Payment →
                </button>
              </div>
            </motion.div>
          )}

          {step === "proof" && (
            <motion.div key="proof" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Upload payment proof</h2>
                <p className="text-sm text-gray-500 mb-6">Paste a screenshot link (Google Drive, Imgur, etc.) so we can verify your payment quickly.</p>

                <label className="block text-xs font-semibold text-gray-600 mb-2">Screenshot URL</label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-all"
                />

                {proofMut.isError && (
                  <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    {(proofMut.error as any)?.message ?? "Could not submit. Please try again."}
                  </div>
                )}

                <button
                  onClick={() => proofMut.mutate()}
                  disabled={!proofUrl.trim() || proofMut.isPending}
                  className="w-full mt-5 py-3.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm shadow-sm shadow-teal-200"
                >
                  {proofMut.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Submit Proof</>
                  )}
                </button>
                <button
                  onClick={() => setStep("payment")}
                  className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>
            </motion.div>
          )}

          {step === "confirmed" && (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 22 }}
                  className="w-18 h-18 bg-gradient-to-br from-teal-50 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ width: 72, height: 72 }}
                >
                  <Check className="w-9 h-9 text-teal-500" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Proof Received</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
                  Our team will review your payment and activate your account within 24 hours.
                </p>
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium px-4 py-2 rounded-full mb-8">
                  <Clock className="w-3.5 h-3.5" /> Awaiting admin verification
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => navigate("/")}
                    className="px-6 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors shadow-sm">
                    Go to Dashboard
                  </button>
                  <button onClick={() => navigate("/account/subscription")}
                    className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
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
    <div className={`flex items-center justify-between p-3.5 rounded-xl border ${highlight ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"}`}>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-gray-900" : "text-gray-600"}`}>{value}</span>
    </div>
  );
}
