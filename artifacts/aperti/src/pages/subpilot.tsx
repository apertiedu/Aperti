import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, History, CreditCard } from "lucide-react";
import { useAuth } from "@/context/auth";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Plan {
  id: number;
  name: string;
  type: string;
  priceEgp: string;
  features: string[];
  studentLimit: number | null;
  flexSeatPriceEgp: string | null;
}

interface Subscription {
  id: number;
  planId: number;
  status: string;
  startDate: string;
  plan?: Plan;
}

export default function SubPilot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [flexQty, setFlexQty] = useState(1);

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON("/subscriptions/plans"),
  });

  const { data: mySub, isLoading: subLoading } = useQuery<{ subscription: Subscription | null; flexSeats: any[] }>({
    queryKey: ["mySub"],
    queryFn: () => fetchJSON("/subscriptions/mine"),
  });

  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"instapay" | "stripe">("instapay");
  const [instapayCode, setInstapayCode] = useState("");

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => fetchJSON("/subscriptions/checkout", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mySub"] }),
  });

  const flexMutation = useMutation({
    mutationFn: (qty: number) => fetchJSON("/subscriptions/flex-seats", { method: "POST", body: JSON.stringify({ quantity: qty }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mySub"] }),
  });

  const activeSub = mySub?.subscription;
  const activePlan = plans?.find(p => p.id === activeSub?.planId);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">SubPilot<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your subscription & billing command center.</p>
      </motion.div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList>
          <TabsTrigger value="current">Current Plan</TabsTrigger>
          <TabsTrigger value="plans">Upgrade / New Plan</TabsTrigger>
          <TabsTrigger value="flex">FlexSeats</TabsTrigger>
        </TabsList>

        {/* Current Plan */}
        <TabsContent value="current">
          {subLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : activeSub ? (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> {activePlan?.name} Plan</CardTitle>
                <CardDescription>Active since {new Date(activeSub.startDate).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span>Price</span><span className="font-medium">{activePlan?.priceEgp} EGP / student / month</span></div>
                <div className="flex justify-between"><span>Status</span><Badge>{activeSub.status}</Badge></div>
                <div className="flex justify-between"><span>FlexSeats used</span><span>{mySub?.flexSeats?.length || 0}</span></div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-hover">
              <CardContent className="p-8 text-center text-muted-foreground">
                No active subscription. Choose a plan to start.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Plans */}
        <TabsContent value="plans">
          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {plans?.map(plan => (
                <Card key={plan.id} className={`card-hover cursor-pointer ${selectedPlan === plan.id ? "border-primary shadow-md shadow-primary/10" : ""}`} onClick={() => setSelectedPlan(plan.id)}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="text-2xl font-bold">{plan.priceEgp} EGP<span className="text-sm font-normal text-muted-foreground">/student/mo</span></div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {plan.features?.slice(0,4).map((f,i) => <li key={i} className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" />{f}</li>)}
                    </ul>
                    {selectedPlan === plan.id && (
                      <div className="mt-4 space-y-3">
                        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="instapay" id="instapay" /><Label htmlFor="instapay">InstaPay</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="stripe" id="stripe" /><Label htmlFor="stripe">Card (Stripe)</Label></div>
                        </RadioGroup>
                        {paymentMethod === "instapay" && (
                          <Input placeholder="InstaPay transaction code" value={instapayCode} onChange={e => setInstapayCode(e.target.value)} />
                        )}
                        <Button className="w-full" onClick={() => checkoutMutation.mutate({ planId: plan.id, paymentMethod, instapayCode })} disabled={checkoutMutation.isPending}>
                          {checkoutMutation.isPending ? "Processing…" : "Subscribe"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* FlexSeats */}
        <TabsContent value="flex">
          <Card className="card-hover max-w-md">
            <CardHeader>
              <CardTitle>FlexSeats</CardTitle>
              <CardDescription>Add extra students without upgrading your plan. {activePlan?.flexSeatPriceEgp} EGP each.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1">
                  <Label>Number of students</Label>
                  <Input type="number" min={1} value={flexQty} onChange={e => setFlexQty(Number(e.target.value))} />
                </div>
                <Button onClick={() => flexMutation.mutate(flexQty)} disabled={flexMutation.isPending}>
                  {flexMutation.isPending ? "Adding…" : `Add (${flexQty} × ${activePlan?.flexSeatPriceEgp || '?'} EGP)`}
                </Button>
              </div>
              {(mySub?.flexSeats?.length ?? 0) > 0 && (
                <div className="text-sm text-muted-foreground">
                  Active FlexSeats: {(mySub!.flexSeats ?? []).map((fs: any) => `${fs.quantity} seat(s)`).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
