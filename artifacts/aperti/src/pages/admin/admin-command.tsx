import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Calculator, Activity, DollarSign, Shield, LifeBuoy, FileText,
  Settings, Users, Globe, Zap, ChevronRight
} from "lucide-react";

const modules = [
  { to: "/admin/budget-sense", label: "BudgetSense", icon: Calculator },
  { to: "/admin/auto-scale", label: "AutoScale", icon: Activity },
  { to: "/admin/spend-wise", label: "SpendWise", icon: DollarSign },
  { to: "/admin/shield-core", label: "ShieldCore", icon: Shield },
  { to: "/admin/helpdesk", label: "HelpDesk Admin", icon: LifeBuoy },
  { to: "/admin/paper-vault", label: "PaperVault Admin", icon: FileText },
  { to: "/admin/subpilot-settings", label: "SubPilot Admin", icon: Settings },
  { to: "/admin/quick-switch", label: "QuickSwitch", icon: Users },
  { to: "/admin/world-pilot", label: "WorldPilot (coming)", icon: Globe },
];

export default function AdminCommand() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Admin Command Centre</h1>
        <p className="text-muted-foreground">Full platform control at your fingertips.</p>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => (
          <Link key={mod.to} href={mod.to}>
            <Card className="card-hover cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition">
                  <mod.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground">Manage {mod.label.toLowerCase()}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
