import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Shield } from "lucide-react";

export default function PrivacyVault() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> PrivacyVault<span className="text-primary"></span>
        </h1>
        <p className="text-muted-foreground">You control your data.</p>
      </motion.div>

      <div className="grid gap-6 max-w-2xl">
        <Card className="card-hover">
          <CardHeader><CardTitle>Export Your Data</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Download a copy of all your data, including grades, attendance, and memory.</p>
            <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Request Export</Button>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader><CardTitle>Delete Your Account</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
            <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete Account</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
