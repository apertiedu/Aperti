import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Zap } from "lucide-react";

const MOCK_COSTS = {
  openai: 340,
  ocr: 120,
  hosting: 200,
  total: 660,
  projectedSaving: 140,
};

export default function SpendWise() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-primary" /> SpendWise<span className="text-primary"></span>
        </h1>
        <p className="text-muted-foreground">Optimize your AI and infrastructure spending.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="card-hover">
          <CardContent className="p-4"><p className="text-sm text-muted-foreground">AI API Calls (OpenAI)</p><p className="text-2xl font-bold">{MOCK_COSTS.openai} EGP</p></CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4"><p className="text-sm text-muted-foreground">OCR Processing</p><p className="text-2xl font-bold">{MOCK_COSTS.ocr} EGP</p></CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Monthly</p><p className="text-2xl font-bold">{MOCK_COSTS.total} EGP</p></CardContent>
        </Card>
      </div>

      <Card className="card-hover max-w-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-primary" /> Savings Potential</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">By enabling smart caching and batching, you could save approximately:</p>
          <p className="text-3xl font-bold text-primary">{MOCK_COSTS.projectedSaving} EGP / month</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>Current usage efficiency</span><span>67%</span></div>
            <Progress value={67} className="h-2" />
          </div>
          <Button className="w-full"><Zap className="h-4 w-4 mr-2" /> Apply Recommended Optimizations</Button>
        </CardContent>
      </Card>
    </div>
  );
}
