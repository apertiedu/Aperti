import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Edit, Trash2, ShoppingCart, AlertTriangle,
  TrendingUp, RefreshCw, Search, DollarSign, BookOpen, FileText,
  BarChart2, RotateCcw, CheckCircle, XCircle
} from "lucide-react";

type InventoryItem = {
  id: number; name: string; item_type: string; description: string | null;
  price: string; stock_count: number; low_stock_threshold: number;
  total_sold: number; revenue: string; is_active: boolean; created_at: string;
};

type Sale = {
  id: number; item_name: string; item_type: string;
  student_name: string | null; student_code: string | null;
  quantity: number; unit_price: string; total_price: string;
  payment_status: string; notes: string | null; sold_at: string;
};

type Summary = {
  total_items: number; total_stock_value: string;
  low_stock_count: number; out_of_stock_count: number;
  total_revenue: string; paid_revenue: string; unpaid_revenue: string; total_sales: number;
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  book:         { label: "Book",         icon: BookOpen,  color: "from-violet-400 to-purple-500" },
  sheet:        { label: "Sheet",        icon: FileText,  color: "from-sky-400 to-blue-500" },
  worksheet:    { label: "Worksheet",    icon: FileText,  color: "from-teal-400 to-emerald-500" },
  exam_booklet: { label: "Exam Booklet", icon: Package,   color: "from-amber-400 to-orange-500" },
  other:        { label: "Other",        icon: Package,   color: "from-slate-400 to-gray-500" },
};

function getTypeConfig(type: string) { return TYPE_CONFIG[type] ?? TYPE_CONFIG.other; }

function StockBadge({ item }: { item: InventoryItem }) {
  if (item.stock_count === 0) return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Out of stock</Badge>;
  if (item.stock_count <= item.low_stock_threshold) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Low stock</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">{item.stock_count} left</Badge>;
}

const BLANK_FORM = { name: "", itemType: "book", description: "", price: "", stockCount: "", lowStockThreshold: "5" };

export default function Inventory() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stock" | "sales">("stock");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState<InventoryItem | null>(null);
  const [restockOpen, setRestockOpen] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saleForm, setSaleForm] = useState({ studentCode: "", quantity: "1", paymentStatus: "paid", notes: "" });
  const [restockQty, setRestockQty] = useState("10");
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loadAll = async () => {
    setLoading(true);
    const [iRes, sRes, smRes] = await Promise.all([
      fetch("/api/inventory", { credentials: "include" }),
      fetch("/api/inventory/sales?limit=100", { credentials: "include" }),
      fetch("/api/inventory/summary", { credentials: "include" }),
    ]);
    if (iRes.ok) setItems(await iRes.json());
    if (sRes.ok) setSales(await sRes.json());
    if (smRes.ok) setSummary(await smRes.json());
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { name: form.name, itemType: form.itemType, description: form.description, price: form.price, stockCount: form.stockCount, lowStockThreshold: form.lowStockThreshold };
    const url = editItem ? `/api/inventory/${editItem.id}` : "/api/inventory";
    const method = editItem ? "PATCH" : "POST";
    const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!r.ok) { toast({ title: "Failed to save", variant: "destructive" }); return; }
    toast({ title: editItem ? "Updated!" : "Item added!" });
    setAddOpen(false); setEditItem(null); setForm(BLANK_FORM); loadAll();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this item from inventory?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE", credentials: "include" });
    loadAll();
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleOpen) return;
    setSaving(true);
    let studentId: number | null = null;
    if (saleForm.studentCode) {
      const sr = await fetch(`/api/students?search=${encodeURIComponent(saleForm.studentCode)}`, { credentials: "include" });
      if (sr.ok) { const students = await sr.json(); studentId = students.find((s: any) => s.studentCode === saleForm.studentCode)?.id ?? null; }
    }
    const r = await fetch("/api/inventory/sales", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: saleOpen.id, studentId, quantity: parseInt(saleForm.quantity, 10), paymentStatus: saleForm.paymentStatus, notes: saleForm.notes }),
    });
    setSaving(false);
    if (!r.ok) { const err = await r.json().catch(() => ({})); toast({ title: err.message || "Sale failed", variant: "destructive" }); return; }
    toast({ title: "Sale recorded!" }); setSaleOpen(null); setSaleForm({ studentCode: "", quantity: "1", paymentStatus: "paid", notes: "" }); loadAll();
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockOpen) return;
    setSaving(true);
    const r = await fetch(`/api/inventory/${restockOpen.id}/restock`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: parseInt(restockQty, 10) }),
    });
    setSaving(false);
    if (!r.ok) { toast({ title: "Restock failed", variant: "destructive" }); return; }
    toast({ title: "Restocked!" }); setRestockOpen(null); setRestockQty("10"); loadAll();
  };

  const openEdit = (item: InventoryItem) => {
    setForm({ name: item.name, itemType: item.item_type, description: item.description ?? "", price: item.price, stockCount: String(item.stock_count), lowStockThreshold: String(item.low_stock_threshold) });
    setEditItem(item); setAddOpen(true);
  };

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = items.filter(i => i.stock_count <= i.low_stock_threshold && i.stock_count > 0);
  const outOfStock = items.filter(i => i.stock_count === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Inventory & Sales</h1>
            <p className="text-xs text-muted-foreground">Books, sheets, and materials</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button onClick={() => { setForm(BLANK_FORM); setEditItem(null); setAddOpen(true); }} className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-sm">
            <Plus className="h-4 w-4" />Add Item
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Items",  value: summary.total_items,       icon: Package,    color: "text-violet-600", bg: "bg-violet-100" },
            { label: "Revenue",      value: `£${parseFloat(summary.paid_revenue).toFixed(2)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100" },
            { label: "Unpaid",       value: `£${parseFloat(summary.unpaid_revenue).toFixed(2)}`, icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
            { label: "Low Stock",    value: summary.low_stock_count + summary.out_of_stock_count, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100" },
          ].map(s => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="space-y-2">
          {outOfStock.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 text-sm">
              <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-400"><strong>{outOfStock.length} item{outOfStock.length > 1 ? "s" : ""}</strong> out of stock: {outOfStock.map(i => i.name).join(", ")}</p>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-amber-700 dark:text-amber-400"><strong>{lowStock.length} item{lowStock.length > 1 ? "s" : ""}</strong> running low: {lowStock.map(i => i.name).join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl border border-border/50 p-1 bg-muted/30">
        {(["stock", "sales"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "stock" ? `Stock (${items.length})` : `Sales (${sales.length})`}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl skeleton" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-semibold text-foreground mb-1">No items yet</p>
              <p className="text-sm text-muted-foreground mb-4">Add books, sheets, or worksheets to track inventory</p>
              <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Add First Item</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item, idx) => {
                const cfg = getTypeConfig(item.item_type);
                const Ic = cfg.icon;
                const isLow = item.stock_count <= item.low_stock_threshold && item.stock_count > 0;
                const isOut = item.stock_count === 0;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                    <Card className={`border overflow-hidden ${isOut ? "border-red-200" : isLow ? "border-amber-200" : "border-border/50"}`}>
                      <div className={`h-1.5 bg-gradient-to-r ${cfg.color}`} />
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                              <Ic className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                            </div>
                          </div>
                          <StockBadge item={item} />
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="text-center p-2 rounded-lg bg-muted/40">
                            <p className="text-lg font-bold text-foreground">£{parseFloat(item.price).toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">Price</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/40">
                            <p className={`text-lg font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-foreground"}`}>{item.stock_count}</p>
                            <p className="text-[10px] text-muted-foreground">In Stock</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                          <TrendingUp className="h-3 w-3" />{item.total_sold} sold · £{parseFloat(item.revenue).toFixed(2)} revenue
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setSaleOpen(item)} disabled={isOut}
                            className="flex-1 text-xs h-7 gap-1">
                            <ShoppingCart className="h-3 w-3" />Sell
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRestockOpen(item); setRestockQty("10"); }}
                            className="flex-1 text-xs h-7 gap-1">
                            <RotateCcw className="h-3 w-3" />Restock
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(item)} className="h-7 w-7 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-2">
          {sales.length === 0 ? (
            <div className="text-center py-16">
              <BarChart2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-semibold text-foreground mb-1">No sales recorded</p>
              <p className="text-sm text-muted-foreground">Record a sale from the stock tab</p>
            </div>
          ) : sales.map((s, idx) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="border-border/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getTypeConfig(s.item_type).color} flex items-center justify-center flex-shrink-0`}>
                    <ShoppingCart className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.student_name ? `${s.student_name} (${s.student_code})` : "Walk-in"}
                      {" · "}{new Date(s.sold_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">£{parseFloat(s.total_price).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">×{s.quantity}</p>
                  </div>
                  <Badge className={s.payment_status === "paid"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                    : "bg-red-100 text-red-700 border-red-200 text-[10px]"}>
                    {s.payment_status}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { setEditItem(null); setForm(BLANK_FORM); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3 mt-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Physics Revision Guide" required /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={form.itemType} onValueChange={v => set("itemType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Description <span className="text-muted-foreground">(optional)</span></Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label>Price (£)</Label><Input type="number" value={form.price} onChange={e => set("price", e.target.value)} min={0} step={0.01} /></div>
              <div className="space-y-1.5"><Label>Stock</Label><Input type="number" value={form.stockCount} onChange={e => set("stockCount", e.target.value)} min={0} /></div>
              <div className="space-y-1.5"><Label>Low Alert</Label><Input type="number" value={form.lowStockThreshold} onChange={e => set("lowStockThreshold", e.target.value)} min={0} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); setEditItem(null); setForm(BLANK_FORM); }}>Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : editItem ? "Update" : "Add Item"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={!!saleOpen} onOpenChange={o => !o && setSaleOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Sale — {saleOpen?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleSale} className="space-y-3 mt-2">
            <div className="p-3 rounded-lg bg-muted/40 text-sm">
              Price: <strong>£{saleOpen ? parseFloat(saleOpen.price).toFixed(2) : "0"}</strong> · Stock: <strong>{saleOpen?.stock_count ?? 0}</strong>
            </div>
            <div className="space-y-1.5"><Label>Student Code <span className="text-muted-foreground">(optional)</span></Label><Input value={saleForm.studentCode} onChange={e => setSaleForm(f => ({ ...f, studentCode: e.target.value }))} placeholder="e.g. ST001" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={saleForm.quantity} onChange={e => setSaleForm(f => ({ ...f, quantity: e.target.value }))} min={1} max={saleOpen?.stock_count} /></div>
              <div className="space-y-1.5"><Label>Payment</Label>
                <Select value={saleForm.paymentStatus} onValueChange={v => setSaleForm(f => ({ ...f, paymentStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
              Total: £{saleOpen ? (parseFloat(saleOpen.price) * (parseInt(saleForm.quantity || "1", 10) || 1)).toFixed(2) : "0"}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSaleOpen(null)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">{saving ? "Saving..." : "Record Sale"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={!!restockOpen} onOpenChange={o => !o && setRestockOpen(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Restock — {restockOpen?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleRestock} className="space-y-3 mt-2">
            <div className="p-3 rounded-lg bg-muted/40 text-sm text-center">Current stock: <strong>{restockOpen?.stock_count ?? 0}</strong></div>
            <div className="space-y-1.5"><Label>Quantity to add</Label><Input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} min={1} required /></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setRestockOpen(null)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : "Restock"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
