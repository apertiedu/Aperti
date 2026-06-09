import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Tag, ArrowRight, Loader2, Upload, AlertCircle, Lock, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const TEAL = "#00796B";

const STUDENT_PLANS = [
  { id: "free",     name: "Free",      price: 0,   color: "#757575", features: ["Past paper access", "AI Mentor (5/day)", "Basic flashcards", "Public course library"] },
  { id: "essential",name: "Essential", price: 79,  color: TEAL,      features: ["All Free features", "Unlimited AI Mentor", "Full flashcard engine", "Revision schedules"] },
  { id: "plus",     name: "Plus",      price: 149, color: "#00897B", features: ["All Essential features", "Revision Notes", "SimVerse labs", "Peer review access"] },
  { id: "pro",      name: "Pro",       price: 249, color: "#00695C", features: ["All Plus features", "Priority AI tutor", "Practice exam library", "Progress analytics"] },
  { id: "elite",    name: "Elite",     price: 399, color: "#004D40", features: ["All Pro features", "Premium content access", "Dedicated support", "Custom learning path"] },
];

function PlanCard({ plan, selected, onSelect }: { plan: typeof STUDENT_PLANS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${
        selected ? "shadow-lg" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      style={selected ? { borderColor: plan.color, background: `${plan.color}06` } : {}}>
      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5" style={{ color: plan.color }} />
        </motion.div>
      )}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}18` }}>
          <span className="text-lg font-black" style={{ color: plan.color, fontSize: 13 }}>{plan.name[0]}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-gray-900">{plan.name}</h3>
            <span className="text-lg font-black" style={{ color: plan.color }}>
              {plan.price === 0 ? "Free" : `EGP ${plan.price}`}
            </span>
            {plan.price > 0 && <span className="text-xs text-gray-400">/month</span>}
          </div>
          <ul className="mt-2 space-y-0.5">
            {plan.features.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: plan.color }} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<"plan" | "pay" | "done">("plan");
  const [selectedPlanId, setSelectedPlanId] = useState("plus");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ id: number; discountPercent: number; code: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [instaPayCode, setInstaPayCode] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = STUDENT_PLANS.find(p => p.id === selectedPlanId)!;
  const basePrice = selectedPlan.price;
  const discountAmt = coupon ? Math.round(basePrice * (coupon.discountPercent / 100)) : 0;
  const finalPrice = Math.max(0, basePrice - discountAmt);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCouponError(data.error || "Invalid coupon"); setCoupon(null); }
      else { setCoupon(data); }
    } catch {
      setCouponError("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedPlan.price === 0) {
      toast({ title: "Free plan activated!" });
      setStep("done");
      return;
    }
    if (!instaPayCode.trim()) {
      toast({ title: "Please enter your InstaPay transaction code", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("planId", selectedPlanId);
      formData.append("paymentMethod", "instapay");
      formData.append("instapayCode", instaPayCode.trim());
      if (coupon) formData.append("couponId", String(coupon.id));
      if (screenshot) formData.append("screenshot", screenshot);

      const res = await apiFetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          paymentMethod: "instapay",
          instapayCode: instaPayCode.trim(),
          couponId: coupon?.id,
        }),
      });
      if (res.ok) { setStep("done"); }
      else { const d = await res.json(); throw new Error(d.error || "Checkout failed"); }
    } catch (e: any) {
      toast({ title: e.message || "Checkout failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xl font-extrabold tracking-tight" style={{ color: "#121212" }}>
          Aperti<span style={{ color: TEAL }}>.</span>
        </span>
        <span className="text-sm text-gray-400 ml-1">Checkout</span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-3.5 w-3.5" />
          Secure checkout
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-5 py-10">
        <AnimatePresence mode="wait">

          {/* Step 1 – Plan Selection */}
          {step === "plan" && (
            <motion.div key="plan" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Choose your plan</h1>
              <p className="text-gray-500 mb-8">Access the full Aperti student experience. Cancel anytime.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {STUDENT_PLANS.map(p => (
                  <PlanCard key={p.id} plan={p} selected={selectedPlanId === p.id} onSelect={() => setSelectedPlanId(p.id)} />
                ))}
              </div>

              {/* Coupon field */}
              {selectedPlan.price > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: TEAL }} /> Have a coupon code?
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); setCouponError(""); }}
                      placeholder="ENTER CODE"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 transition-all"
                      style={{ "--ring-color": TEAL } as any}
                      onKeyDown={e => e.key === "Enter" && validateCoupon()}
                    />
                    <button
                      onClick={validateCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{ background: TEAL }}>
                      {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{couponError}</p>
                  )}
                  {coupon && (
                    <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold mt-2 flex items-center gap-1.5"
                      style={{ color: TEAL }}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {coupon.discountPercent}% off applied — saving EGP {discountAmt}
                    </motion.p>
                  )}
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">{selectedPlan.name} Plan</span><span className="font-medium">EGP {basePrice}</span></div>
                  {coupon && <div className="flex justify-between"><span style={{ color: TEAL }}>Coupon ({coupon.code})</span><span style={{ color: TEAL }}>−EGP {discountAmt}</span></div>}
                  <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span style={{ color: selectedPlan.color }}>{finalPrice === 0 ? "Free" : `EGP ${finalPrice}/month`}</span>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => selectedPlan.price === 0 ? setStep("done") : setStep("pay")}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg"
                style={{ background: selectedPlan.color }}>
                {selectedPlan.price === 0 ? "Activate Free Plan" : "Continue to Payment"} <ArrowRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}

          {/* Step 2 – Payment */}
          {step === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <button onClick={() => setStep("plan")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back to plans
              </button>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Complete payment</h1>
              <p className="text-gray-500 mb-8">Pay EGP {finalPrice}/month via InstaPay to activate your <strong>{selectedPlan.name}</strong> plan.</p>

              <div className="grid md:grid-cols-2 gap-6">
                {/* InstaPay Instructions */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">IP</span>
                    Pay via InstaPay
                  </h3>
                  <ol className="space-y-3 text-sm text-gray-600 mb-5">
                    <li className="flex gap-2"><span className="font-bold text-gray-900 w-5 shrink-0">1.</span>Open your bank's mobile app and go to InstaPay.</li>
                    <li className="flex gap-2"><span className="font-bold text-gray-900 w-5 shrink-0">2.</span>Send <strong>EGP {finalPrice}</strong> to the Aperti InstaPay ID:</li>
                    <li>
                      <code className="block bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm font-bold text-center" style={{ color: TEAL }}>
                        aperti@instapay.eg
                      </code>
                    </li>
                    <li className="flex gap-2"><span className="font-bold text-gray-900 w-5 shrink-0">3.</span>Copy your transaction reference code and enter it below.</li>
                    <li className="flex gap-2"><span className="font-bold text-gray-900 w-5 shrink-0">4.</span>Submit. An admin will approve your subscription within 2–4 hours.</li>
                  </ol>

                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Transaction Reference Code *</label>
                  <input
                    value={instaPayCode}
                    onChange={e => setInstaPayCode(e.target.value)}
                    placeholder="e.g. TXN-2024-XXXXXXXX"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00796B] transition-all mb-3"
                  />

                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Upload Screenshot (optional)</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#00796B]/40 transition-colors group">
                    <Upload className="h-5 w-5 text-gray-300 group-hover:text-[#00796B] transition-colors mb-1" />
                    <span className="text-xs text-gray-400">{screenshot ? screenshot.name : "PNG or JPG, max 5MB"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setScreenshot(e.target.files?.[0] ?? null)} />
                  </label>

                  <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Your plan will be set to <strong>Pending Review</strong> until an admin verifies your payment.
                  </p>
                </div>

                {/* Order Summary */}
                <div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 sticky top-4">
                    <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">{selectedPlan.name} Plan</span><span>EGP {basePrice}</span></div>
                      {coupon && <div className="flex justify-between"><span style={{ color: TEAL }}>Coupon ({coupon.code})</span><span style={{ color: TEAL }}>−EGP {discountAmt}</span></div>}
                      <div className="border-t pt-2 flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span style={{ color: selectedPlan.color }}>EGP {finalPrice}<span className="text-xs font-normal text-gray-400">/mo</span></span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {selectedPlan.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                          <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: selectedPlan.color }} />{f}
                        </div>
                      ))}
                    </div>

                    <motion.button
                      onClick={handleSubmit}
                      disabled={submitting || !instaPayCode.trim()}
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                      className="mt-5 w-full py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                      style={{ background: selectedPlan.color }}>
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : <>Submit for Review <ArrowRight className="h-4 w-4" /></>}
                    </motion.button>

                    <p className="mt-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" /> SSL secured · Cancel anytime
                    </p>
                    <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs text-center text-gray-400 font-medium">💳 Stripe / Card payment</p>
                      <p className="text-[10px] text-center text-gray-300 mt-0.5">Coming Soon</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3 – Done */}
          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center py-20">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl"
                style={{ background: `linear-gradient(135deg, ${selectedPlan.color}, ${selectedPlan.color}BB)` }}>
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
                {selectedPlan.price === 0 ? "You're all set!" : "Payment submitted!"}
              </h2>
              <p className="text-gray-500 max-w-sm mb-8">
                {selectedPlan.price === 0
                  ? "Your free plan is active. Start learning now."
                  : "Your InstaPay submission is under review. You'll get access within 2–4 hours after admin verification."}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="px-8 py-3 rounded-2xl font-bold text-white shadow-lg"
                style={{ background: selectedPlan.color }}>
                Go to Login
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
