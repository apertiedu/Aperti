import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Zap, Star, Crown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("aperti_token") || "";
async function fetchJSON(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  return r.json();
}

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Zap,
  essential: Star,
  plus: Star,
  pro: Crown,
  elite: Crown,
};

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans-public"],
    queryFn: () => fetchJSON("/api/plans/public"),
  });

  const teacherPlans = plans.filter((p: any) => p.type === "teacher");
  const studentPlans = plans.filter((p: any) => p.type === "student");

  const handleGetStarted = (planId: number) => {
    if (!user) navigate(`/login?redirect=/subscribe/${planId}`);
    else navigate(`/subscribe/${planId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 to-white">
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Zap className="w-3 h-3" /> Simple, transparent pricing in EGP
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Choose your plan</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Unlock the full power of Aperti for your classroom. All plans include our core teaching tools.
          </p>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Teacher Plans */}
            {teacherPlans.length > 0 && (
              <section className="mb-16">
                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">For Teachers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {teacherPlans.map((plan: any, i: number) => (
                    <PlanCard key={plan.id} plan={plan} index={i} onSelect={() => handleGetStarted(plan.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* Student Plans */}
            {studentPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">For Students</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {studentPlans.map((plan: any, i: number) => (
                    <PlanCard key={plan.id} plan={plan} index={i} onSelect={() => handleGetStarted(plan.id)} />
                  ))}
                </div>
              </section>
            )}

            {(teacherPlans.length === 0 && studentPlans.length === 0) && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg">Plans coming soon.</p>
                <Link href="/" className="mt-4 inline-block text-teal-600 hover:underline text-sm">← Back to dashboard</Link>
              </div>
            )}
          </>
        )}

        {/* FAQ strip */}
        <div className="mt-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Questions?</h3>
          <div className="grid sm:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <p className="font-semibold text-gray-700 mb-1">How do I pay?</p>
              <p>We use InstaPay for all payments. After subscribing, you'll get a unique reference code to send your payment to our verified account.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">How quickly is my account activated?</p>
              <p>Once you upload your payment screenshot, our team reviews and activates your account within 24 hours, typically much faster.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Can I upgrade my plan?</p>
              <p>Yes — at any time. Visit My Subscription to start a new payment request for your desired plan.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Is there a free tier?</p>
              <p>Yes, every teacher gets a free plan with limited students and courses. Perfect for getting started.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, index, onSelect }: { plan: any; index: number; onSelect: () => void }) {
  const Icon = planIcons[plan.name?.toLowerCase()] ?? Zap;
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  const limits: Record<string, number> = typeof plan.limits === "object" ? plan.limits ?? {} : {};
  const isPopular = plan.name?.toLowerCase() === "plus" || plan.name?.toLowerCase() === "pro";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`relative bg-white rounded-2xl border shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow ${isPopular ? "border-teal-400 ring-1 ring-teal-200" : "border-gray-100"}`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
          Most Popular
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPopular ? "bg-teal-500 text-white" : "bg-teal-50 text-teal-600"}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-base">{plan.name}</h3>
          <p className="text-[10px] text-gray-400 capitalize">{plan.type}</p>
        </div>
      </div>

      <div>
        {plan.discount_pct > 0 ? (
          <>
            <span className="text-3xl font-bold text-gray-900">{Number(plan.final_price_egp).toLocaleString()}</span>
            <span className="text-sm text-gray-400 ml-1">EGP/mo</span>
            <span className="ml-2 line-through text-sm text-gray-400">{Number(plan.price_egp).toLocaleString()}</span>
            <span className="ml-1.5 inline-flex items-center bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{plan.discount_pct}% off</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-gray-900">{Number(plan.price_egp).toLocaleString()}</span>
            <span className="text-sm text-gray-400 ml-1">EGP/mo</span>
          </>
        )}
      </div>

      {/* Limits */}
      {Object.keys(limits).length > 0 && (
        <div className="space-y-1 text-xs text-gray-500">
          {limits.courses   && <p>📚 {limits.courses} courses</p>}
          {limits.students  && <p>👨‍🎓 {limits.students} students</p>}
          {limits.questions && <p>❓ {limits.questions} questions</p>}
          {limits.storage_gb && <p>💾 {limits.storage_gb} GB storage</p>}
        </div>
      )}

      {/* Features */}
      {features.length > 0 && (
        <ul className="space-y-1.5 flex-1">
          {features.slice(0, 6).map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <Check className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onSelect}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${isPopular ? "bg-teal-500 text-white hover:bg-teal-600" : "bg-teal-50 text-teal-700 hover:bg-teal-100"}`}
      >
        Get Started
      </button>
    </motion.div>
  );
}
