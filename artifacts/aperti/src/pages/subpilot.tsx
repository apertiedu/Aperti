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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, CreditCard, MessageSquare, Phone, Save,
  CheckCircle2, Clock, ExternalLink, Users,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options?.headers as object | undefined),
    },
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

interface NotifySettings {
  senderName: string;
  messageTemplate: string;
  whatsappEnabled: boolean;
}

interface StudentPhone {
  id: number;
  student_name: string;
  student_code: string;
  parent_phone: string | null;
}

interface NotifyLog {
  id: number;
  student_name: string;
  parent_phone: string;
  status: string;
  lesson_name: string;
  date: string;
  message: string;
  sent_at: string;
}

export default function SubPilot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"instapay" | "stripe">("instapay");
  const [instapayCode, setInstapayCode] = useState("");

  // Notification settings state
  const [notifySettings, setNotifySettings] = useState<NotifySettings>({
    senderName: "Your Teacher",
    messageTemplate: "Dear parent, {studentName} was marked {status} from {lessonName} on {date}. Please contact us for more details.",
    whatsappEnabled: true,
  });
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
  const [phoneInput, setPhoneInput] = useState("");

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON("/subscriptions/plans"),
  });

  const { data: mySub, isLoading: subLoading } = useQuery<{ subscription: Subscription | null; flexSeats: any[] }>({
    queryKey: ["mySub"],
    queryFn: () => fetchJSON("/subscriptions/mine"),
  });

  const { data: fetchedSettings } = useQuery<NotifySettings>({
    queryKey: ["notify-settings"],
    queryFn: () => fetchJSON("/absence-notify/settings"),
    onSuccess: (d: NotifySettings) => setNotifySettings(d),
  } as any);

  const { data: studentsPhones = [], isLoading: studentsLoading } = useQuery<StudentPhone[]>({
    queryKey: ["students-phones"],
    queryFn: () => fetchJSON("/absence-notify/students-phones"),
  });

  const { data: notifyLog = [] } = useQuery<NotifyLog[]>({
    queryKey: ["notify-log"],
    queryFn: () => fetchJSON("/absence-notify/log"),
  });

  const activeSub = mySub?.subscription;
  const activePlan = plans?.find(p => p.id === activeSub?.planId);

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => fetchJSON("/subscriptions/checkout", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySub"] });
      toast({ title: "Subscription updated" });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: NotifySettings) =>
      fetchJSON("/absence-notify/settings", { method: "PUT", body: JSON.stringify(settings) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notify-settings"] });
      toast({ title: "Notification settings saved" });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: ({ studentId, parentPhone }: { studentId: number; parentPhone: string }) =>
      fetchJSON("/absence-notify/update-phone", {
        method: "POST",
        body: JSON.stringify({ studentId, parentPhone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-phones"] });
      setEditingPhoneId(null);
      toast({ title: "Parent phone updated" });
    },
  });

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SubPilot</h1>
            <p className="text-sm text-muted-foreground">Subscription, billing & parent notifications</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="current">Current Plan</TabsTrigger>
          <TabsTrigger value="plans">Upgrade</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* ── Current Plan ── */}
        <TabsContent value="current">
          {subLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : activeSub ? (
            <Card className="shadow-sm border-0 max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> {activePlan?.name} Plan
                </CardTitle>
                <CardDescription>Active since {new Date(activeSub.startDate).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{activePlan?.priceEgp} EGP / student / month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="bg-primary/10 text-primary border-0">{activeSub.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-0 max-w-lg">
              <CardContent className="p-10 text-center text-muted-foreground">
                No active subscription. Choose a plan to get started.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Upgrade ── */}
        <TabsContent value="plans">
          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {plans?.map(plan => (
                <Card
                  key={plan.id}
                  className={`shadow-sm cursor-pointer transition-all border-2 ${
                    selectedPlan === plan.id
                      ? "border-primary shadow-md shadow-primary/10"
                      : "border-transparent hover:border-primary/20"
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <div className="text-2xl font-bold text-gray-900">
                      {plan.priceEgp}
                      <span className="text-sm font-normal text-muted-foreground"> EGP/student/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm mb-4">
                      {plan.features?.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    {selectedPlan === plan.id && (
                      <div className="mt-4 space-y-3 border-t pt-3">
                        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                          <div className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="instapay" id="instapay" />
                            <Label htmlFor="instapay">InstaPay</Label>
                          </div>
                          <div className="flex items-center gap-2 text-sm opacity-50 cursor-not-allowed">
                            <RadioGroupItem value="stripe" id="stripe" disabled />
                            <Label htmlFor="stripe" className="cursor-not-allowed">Card (Stripe)</Label>
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#E6F4F1] text-[#00796B] font-semibold">Coming Soon</span>
                          </div>
                        </RadioGroup>
                        {paymentMethod === "instapay" && (
                          <Input
                            placeholder="InstaPay transaction code"
                            value={instapayCode}
                            onChange={e => setInstapayCode(e.target.value)}
                            className="h-9"
                          />
                        )}
                        <Button
                          className="w-full h-9 bg-primary hover:bg-primary/90 text-white"
                          onClick={e => { e.stopPropagation(); checkoutMutation.mutate({ planId: plan.id, paymentMethod, instapayCode }); }}
                          disabled={checkoutMutation.isPending}
                        >
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

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Settings */}
          <Card className="shadow-sm border-0 max-w-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> WhatsApp Absence Notifications
              </CardTitle>
              <CardDescription>
                Configure automatic parent notifications when students are marked absent.
                Messages are sent via WhatsApp — no extra fees, no API key required.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable WhatsApp notifications</p>
                  <p className="text-xs text-muted-foreground">Opens WhatsApp with a pre-filled message for each absent student's parent</p>
                </div>
                <Switch
                  checked={notifySettings.whatsappEnabled}
                  onCheckedChange={v => setNotifySettings(s => ({ ...s, whatsappEnabled: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Sender Name</Label>
                <Input
                  value={notifySettings.senderName}
                  onChange={e => setNotifySettings(s => ({ ...s, senderName: e.target.value }))}
                  placeholder="e.g. Mr. Ahmed — Physics"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Message Template</Label>
                <Textarea
                  value={notifySettings.messageTemplate}
                  onChange={e => setNotifySettings(s => ({ ...s, messageTemplate: e.target.value }))}
                  rows={4}
                  className="resize-none text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Use: <code className="bg-muted px-1 rounded">{"{studentName}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{status}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{lessonName}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{date}"}</code>
                </p>
              </div>
              <Button
                onClick={() => saveSettingsMutation.mutate(notifySettings)}
                disabled={saveSettingsMutation.isPending}
                className="bg-primary text-white hover:bg-primary/90 h-9"
              >
                <Save className="h-3.5 w-3.5 mr-2" />
                {saveSettingsMutation.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Parent phone numbers */}
          <Card className="shadow-sm border-0 max-w-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> Parent Phone Numbers
              </CardTitle>
              <CardDescription>Set the WhatsApp number for each student's parent. Include country code (e.g. +201012345678).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {studentsLoading ? (
                <div className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
              ) : studentsPhones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#0D948815" }}>
                    <Users className="w-5 h-5" style={{ color: "#0D9488" }} />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No students yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Add students via ClassForge first, then return here to send them messages.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Parent WhatsApp</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsPhones.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-sm">{s.student_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{s.student_code}</TableCell>
                        <TableCell>
                          {editingPhoneId === s.id ? (
                            <Input
                              value={phoneInput}
                              onChange={e => setPhoneInput(e.target.value)}
                              placeholder="+201012345678"
                              className="h-7 text-xs w-40"
                              autoFocus
                            />
                          ) : (
                            <span className={`text-sm ${s.parent_phone ? "text-gray-700 font-mono" : "text-muted-foreground"}`}>
                              {s.parent_phone || "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingPhoneId === s.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-primary text-white"
                                onClick={() => updatePhoneMutation.mutate({ studentId: s.id, parentPhone: phoneInput })}
                                disabled={updatePhoneMutation.isPending}
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPhoneId(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setEditingPhoneId(s.id); setPhoneInput(s.parent_phone || ""); }}
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Notification log */}
          <Card className="shadow-sm border-0 max-w-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Notification History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notifyLog.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  No notifications sent yet. Use the CheckIn page to send absence alerts.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lesson</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifyLog.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-sm">{log.student_name}</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] border-0 ${
                              log.status === "Absent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.lesson_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.date}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.sent_at).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
