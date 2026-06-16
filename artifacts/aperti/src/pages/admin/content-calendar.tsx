import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Plus, Megaphone, Star, LayoutTemplate,
  Clock, CheckCircle2, XCircle, FileText, ChevronLeft,
  ChevronRight, Filter, Send, Edit2, Trash2, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { StatusButton, useMutationStatus } from "@/components/ui/status-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type ContentType = "announcement" | "testimonial" | "landing_change";
type Status = "draft" | "scheduled" | "published" | "cancelled";

interface CalendarItem {
  id: number;
  title: string;
  content_type: ContentType;
  status: Status;
  scheduled_at: string | null;
  published_at: string | null;
  payload: Record<string, unknown>;
  created_by: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

const TYPE_CONFIG: Record<ContentType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  announcement:  { label: "Announcement",       icon: <Megaphone className="h-4 w-4" />,     color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  testimonial:   { label: "Testimonial Spotlight", icon: <Star className="h-4 w-4" />,        color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  landing_change:{ label: "Landing Page Change", icon: <LayoutTemplate className="h-4 w-4" />, color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
};

const STATUS_CONFIG: Record<Status, { label: string; variant: string; icon: React.ReactNode }> = {
  draft:      { label: "Draft",      variant: "secondary",    icon: <FileText className="h-3 w-3" /> },
  scheduled:  { label: "Scheduled",  variant: "outline",      icon: <Clock className="h-3 w-3" /> },
  published:  { label: "Published",  variant: "default",      icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:  { label: "Cancelled",  variant: "destructive",  icon: <XCircle className="h-3 w-3" /> },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LANDING_CHANGE_KEYS = [
  { value: "hero_headline",        label: "Hero Headline" },
  { value: "hero_headline_accent", label: "Hero Accent Text" },
  { value: "hero_subheadline",     label: "Hero Sub-headline" },
  { value: "hero_cta_primary",     label: "Primary CTA Button" },
  { value: "hero_cta_secondary",   label: "Secondary CTA Button" },
  { value: "show_pricing",         label: "Show Pricing Section" },
  { value: "show_testimonials",    label: "Show Testimonials" },
  { value: "show_stats",           label: "Show Stats Strip" },
  { value: "show_early_access",    label: "Show Early Access Form" },
];

function toLocalDatetimeString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

const EMPTY_FORM = {
  title: "",
  content_type: "announcement" as ContentType,
  scheduled_at: "",
  payload: {} as Record<string, unknown>,
};

function AnnouncementFields({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Message</Label>
        <Textarea
          rows={4}
          className="mt-1 resize-none"
          placeholder="Write the announcement…"
          value={String(payload.message ?? "")}
          onChange={e => onChange({ ...payload, message: e.target.value })}
        />
      </div>
      <div>
        <Label>Target Audience</Label>
        <Select value={String(payload.target_roles ?? "all")} onValueChange={v => onChange({ ...payload, target_roles: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="teacher">Teachers only</SelectItem>
            <SelectItem value="student">Students only</SelectItem>
            <SelectItem value="parent">Parents only</SelectItem>
            <SelectItem value="admin">Admins only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Priority</Label>
        <Select value={String(payload.priority ?? "normal")} onValueChange={v => onChange({ ...payload, priority: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TestimonialFields({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Author Name</Label>
          <Input className="mt-1" placeholder="Ms. Sarah Okafor" value={String(payload.author_name ?? "")} onChange={e => onChange({ ...payload, author_name: e.target.value })} />
        </div>
        <div>
          <Label>Author Role</Label>
          <Input className="mt-1" placeholder="Physics Teacher" value={String(payload.author_role ?? "")} onChange={e => onChange({ ...payload, author_role: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Testimonial Content</Label>
        <Textarea
          rows={4}
          className="mt-1 resize-none"
          placeholder="What they said…"
          value={String(payload.content ?? "")}
          onChange={e => onChange({ ...payload, content: e.target.value })}
        />
      </div>
      <div>
        <Label>Avatar URL (optional)</Label>
        <Input className="mt-1" placeholder="https://…" value={String(payload.avatar_url ?? "")} onChange={e => onChange({ ...payload, avatar_url: e.target.value })} />
      </div>
      <div>
        <Label>Rating (1–5)</Label>
        <Select value={String(payload.rating ?? "5")} onValueChange={v => onChange({ ...payload, rating: Number(v) })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[5,4,3,2,1].map(n => <SelectItem key={n} value={String(n)}>{n} star{n !== 1 ? "s" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function LandingChangeFields({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const isToggle = ["show_pricing","show_testimonials","show_stats","show_early_access","show_marketplace"].includes(String(payload.key ?? ""));
  return (
    <div className="space-y-3">
      <div>
        <Label>Landing Page Field</Label>
        <Select value={String(payload.key ?? "")} onValueChange={v => onChange({ ...payload, key: v, value: "" })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select field to change…" /></SelectTrigger>
          <SelectContent>
            {LANDING_CHANGE_KEYS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!!payload.key && (
        <div>
          <Label>New Value</Label>
          {isToggle ? (
            <Select value={String(payload.value ?? "true")} onValueChange={v => onChange({ ...payload, value: v === "true" })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Visible (on)</SelectItem>
                <SelectItem value="false">Hidden (off)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input className="mt-1" placeholder="New text content…" value={String(payload.value ?? "")} onChange={e => onChange({ ...payload, value: e.target.value })} />
          )}
        </div>
      )}
      <div>
        <Label>Change Description (internal note)</Label>
        <Input className="mt-1" placeholder="Why this change is being made…" value={String(payload.note ?? "")} onChange={e => onChange({ ...payload, note: e.target.value })} />
      </div>
    </div>
  );
}

function ItemModal({
  open, onClose, editing, onSaved,
}: { open: boolean; onClose: () => void; editing: CalendarItem | null; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  const isEdit = !!editing;

  const resetForm = (item?: CalendarItem) => {
    if (item) {
      setForm({
        title: item.title,
        content_type: item.content_type,
        scheduled_at: toLocalDatetimeString(item.scheduled_at),
        payload: { ...item.payload },
      });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const handleOpen = () => resetForm(editing ?? undefined);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      };
      const res = isEdit
        ? await apiFetch(`/api/admin/content-calendar/${editing!.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiFetch("/api/admin/content-calendar", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Item updated" : "Item created" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && form.content_type;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Scheduled Content" : "Schedule New Content"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1"
              placeholder="Internal title for this item…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <Label>Content Type</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_CONFIG) as ContentType[]).map(t => {
                const cfg = TYPE_CONFIG[t];
                const active = form.content_type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, content_type: t, payload: {} }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all",
                      active ? `${cfg.bg} ${cfg.color} shadow-sm` : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                    )}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Publish Date & Time</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.scheduled_at}
              onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank to save as draft without a schedule.</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-3">{TYPE_CONFIG[form.content_type].label} Details</p>
            {form.content_type === "announcement" && (
              <AnnouncementFields payload={form.payload} onChange={p => setForm(f => ({ ...f, payload: p }))} />
            )}
            {form.content_type === "testimonial" && (
              <TestimonialFields payload={form.payload} onChange={p => setForm(f => ({ ...f, payload: p }))} />
            )}
            {form.content_type === "landing_change" && (
              <LandingChangeFields payload={form.payload} onChange={p => setForm(f => ({ ...f, payload: p }))} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <StatusButton
            status={useMutationStatus(saveMutation.isPending, saveMutation.isSuccess, saveMutation.isError)}
            idleText={isEdit ? "Save Changes" : "Schedule"}
            loadingText={isEdit ? "Saving…" : "Scheduling…"}
            successText="Saved"
            errorText="Failed"
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewModal({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const cfg = TYPE_CONFIG[item.content_type];
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cfg.color}>{cfg.icon}</span>
            {item.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>Scheduled: <strong className="text-foreground">{formatDisplay(item.scheduled_at)}</strong></span>
          </div>
          {item.content_type === "announcement" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Message</p>
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">{String(item.payload.message ?? "No message")}</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Target: <strong>{String(item.payload.target_roles ?? "all")}</strong></span>
                <span>Priority: <strong>{String(item.payload.priority ?? "normal")}</strong></span>
              </div>
            </div>
          )}
          {item.content_type === "testimonial" && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <p className="text-sm italic">"{String(item.payload.content ?? "")}"</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <strong className="text-foreground">{String(item.payload.author_name ?? "")}</strong>
                <span>·</span>
                <span>{String(item.payload.author_role ?? "")}</span>
                <span>·</span>
                <span>{"★".repeat(Number(item.payload.rating ?? 5))}</span>
              </div>
            </div>
          )}
          {item.content_type === "landing_change" && (
            <div className="space-y-2 text-sm">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <p><span className="text-muted-foreground">Field:</span> <strong>{String(item.payload.key ?? "")}</strong></p>
                <p><span className="text-muted-foreground">New value:</span> <strong>{String(item.payload.value ?? "")}</strong></p>
                {!!item.payload.note && <p><span className="text-muted-foreground">Note:</span> {String(item.payload.note)}</p>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MiniCalendar({
  year, month, items, onPrev, onNext, onDayClick, selectedDay,
}: {
  year: number; month: number; items: CalendarItem[];
  onPrev: () => void; onNext: () => void;
  onDayClick: (d: number) => void; selectedDay: number | null;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const itemsByDay = useMemo(() => {
    const map: Record<number, CalendarItem[]> = {};
    for (const item of items) {
      const d = item.scheduled_at ? new Date(item.scheduled_at) : null;
      if (d && d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(item);
      }
    }
    return map;
  }, [items, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onPrev} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-sm">{MONTHS[month]} {year}</span>
          <button onClick={onNext} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const hasItems = !!itemsByDay[day]?.length;
            const isToday = isCurrentMonth && day === today.getDate();
            const isSelected = day === selectedDay;
            const dots = itemsByDay[day] ?? [];
            return (
              <button
                key={day}
                onClick={() => onDayClick(day)}
                className={cn(
                  "relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-xs font-medium transition-all",
                  isSelected && "bg-primary text-primary-foreground",
                  !isSelected && isToday && "bg-primary/10 text-primary font-bold",
                  !isSelected && !isToday && "hover:bg-muted text-foreground",
                )}
              >
                {day}
                {hasItems && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dots.slice(0, 3).map((it, idx) => {
                      const dotColor = it.content_type === "announcement" ? "bg-blue-500"
                        : it.content_type === "testimonial" ? "bg-amber-500" : "bg-teal-500";
                      return <span key={idx} className={cn("h-1 w-1 rounded-full", dotColor)} />;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-border space-y-1.5">
          {(Object.entries(TYPE_CONFIG) as [ContentType, typeof TYPE_CONFIG[ContentType]][]).map(([k, cfg]) => (
            <div key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full",
                k === "announcement" ? "bg-blue-500" : k === "testimonial" ? "bg-amber-500" : "bg-teal-500"
              )} />
              {cfg.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContentCalendarPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [previewing, setPreviewing] = useState<CalendarItem | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const queryKey = ["content-calendar", filterStatus, filterType];
  const { data: items = [], isLoading } = useQuery<CalendarItem[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("type", filterType);
      const res = await apiFetch(`/api/admin/content-calendar?${params}`);
      return res.json();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/content-calendar/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-calendar"] }); toast({ title: "Published" }); },
    onError: () => toast({ title: "Publish failed", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/content-calendar/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-calendar"] }); toast({ title: "Cancelled" }); },
    onError: () => toast({ title: "Cancel failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/content-calendar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-calendar"] }); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const dayItems = useMemo(() => {
    if (!selectedDay) return null;
    return items.filter(item => {
      if (!item.scheduled_at) return false;
      const d = new Date(item.scheduled_at);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === selectedDay;
    });
  }, [items, selectedDay, calYear, calMonth]);

  const stats = useMemo(() => ({
    draft: items.filter(i => i.status === "draft").length,
    scheduled: items.filter(i => i.status === "scheduled").length,
    published: items.filter(i => i.status === "published").length,
  }), [items]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (item: CalendarItem) => { setEditing(item); setModalOpen(true); };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["content-calendar"] });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Schedule announcements, testimonials, and landing page changes</p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Schedule Content
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Drafts",    value: stats.draft,     icon: <FileText className="h-5 w-5" />,     color: "text-muted-foreground" },
          { label: "Scheduled", value: stats.scheduled, icon: <Clock className="h-5 w-5" />,        color: "text-blue-600" },
          { label: "Published", value: stats.published, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-emerald-600" },
        ].map(s => (
          <Card key={s.label} className="card-lift shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("shrink-0", s.color)}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <MiniCalendar
            year={calYear} month={calMonth} items={items}
            onPrev={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
            onNext={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
            onDayClick={d => setSelectedDay(prev => prev === d ? null : d)}
            selectedDay={selectedDay}
          />

          {selectedDay && dayItems !== null && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">{MONTHS[calMonth]} {selectedDay}</CardTitle>
                <CardDescription className="text-xs">{dayItems.length} item{dayItems.length !== 1 ? "s" : ""} scheduled</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {dayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing scheduled this day.</p>
                ) : dayItems.map(it => {
                  const cfg = TYPE_CONFIG[it.content_type];
                  return (
                    <div key={it.id} className={cn("flex items-center gap-2 p-2 rounded-lg border text-xs", cfg.bg)}>
                      <span className={cfg.color}>{cfg.icon}</span>
                      <span className="font-medium truncate flex-1">{it.title}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
                <SelectItem value="testimonial">Testimonials</SelectItem>
                <SelectItem value="landing_change">Landing Changes</SelectItem>
              </SelectContent>
            </Select>
            {(filterStatus !== "all" || filterType !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterStatus("all"); setFilterType("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nothing scheduled yet"
              description="Create your first scheduled content item to get started."
              action={<Button size="sm" onClick={openCreate}>Schedule Content</Button>}
            />
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-3">
                {items.map(item => {
                  const typeCfg = TYPE_CONFIG[item.content_type];
                  const statusCfg = STATUS_CONFIG[item.status];
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="card-lift shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("mt-0.5 p-2 rounded-lg border shrink-0", typeCfg.bg, typeCfg.color)}>
                              {typeCfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{item.title}</p>
                                <Badge variant={statusCfg.variant as any} className="flex items-center gap-1 text-[10px] px-1.5 py-0">
                                  {statusCfg.icon}{statusCfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className={typeCfg.color}>{typeCfg.label}</span>
                                <span>·</span>
                                {item.scheduled_at ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDisplay(item.scheduled_at)}
                                  </span>
                                ) : <span className="italic">No schedule set</span>}
                                {item.creator_name && <><span>·</span><span>by {item.creator_name}</span></>}
                              </div>
                              {item.content_type === "announcement" && !!item.payload.message && (
                                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{String(item.payload.message)}</p>
                              )}
                              {item.content_type === "testimonial" && !!item.payload.author_name && (
                                <p className="text-xs text-muted-foreground mt-1.5">By {String(item.payload.author_name)}, {String(item.payload.author_role ?? "")}</p>
                              )}
                              {item.content_type === "landing_change" && !!item.payload.key && (
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  Changes <strong>{String(item.payload.key)}</strong> → <span className="font-mono">{String(item.payload.value)}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                onClick={() => setPreviewing(item)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {item.status !== "published" && item.status !== "cancelled" && (
                                <button
                                  onClick={() => openEdit(item)}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {(item.status === "draft" || item.status === "scheduled") && (
                                <button
                                  onClick={() => publishMutation.mutate(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-muted-foreground"
                                  title="Publish now"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {(item.status === "draft" || item.status === "scheduled") && (
                                <button
                                  onClick={() => cancelMutation.mutate(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground"
                                  title="Cancel"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {(item.status === "cancelled" || item.status === "published") && (
                                <button
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={invalidate}
      />

      {previewing && <PreviewModal item={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
