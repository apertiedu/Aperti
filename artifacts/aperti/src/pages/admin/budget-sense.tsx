import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Calculator, TrendingUp, DollarSign } from "lucide-react";

export default function BudgetSense() {
  const [hostingCost, setHostingCost] = useState(200);
  const [netProfit, setNetProfit] = useState(5000);
  const [assistantPercent, setAssistantPercent] = useState(10);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const assistantPool = netProfit * (assistantPercent / 100);
    const remaining = netProfit - assistantPool - hostingCost;
    setResult({
      hostingCost,
      assistantPool,
      remaining,
      recommendation: remaining > 0
        ? `You have ${remaining} EGP available for growth. Consider investing in marketing or upgrading your Spaceship VPS.`
        : "Your costs exceed profit. Consider reducing assistant rewards or upgrading to more students.",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" /> BudgetSense<span className="text-primary"></span>
        </h1>
        <p className="text-muted-foreground">Understand exactly where your money can go.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-hover">
          <CardHeader><CardTitle>Enter Your Numbers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Hosting Cost (EGP)</Label>
              <Input type="number" value={hostingCost} onChange={e => setHostingCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Net Profit (EGP)</Label>
              <Input type="number" value={netProfit} onChange={e => setNetProfit(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Assistant Reward Pool (%)</Label>
              <Slider value={[assistantPercent]} min={0} max={50} onValueChange={([v]) => setAssistantPercent(v)} />
              <span className="text-sm text-muted-foreground">{assistantPercent}%</span>
            </div>
            <Button onClick={calculate} className="w-full">Calculate</Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="card-hover">
            <CardHeader><CardTitle>Your Financial Snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between"><span>Hosting</span><span className="font-medium">{result.hostingCost} EGP</span></div>
              <div className="flex justify-between"><span>Assistant Pool</span><span className="font-medium">{result.assistantPool.toFixed(0)} EGP</span></div>
              <div className="flex justify-between"><span>Remaining</span><span className="font-bold text-primary">{result.remaining.toFixed(0)} EGP</span></div>
              <Progress value={(result.remaining / netProfit) * 100} className="h-2" />
              <p className="text-sm text-muted-foreground mt-4">{result.recommendation}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
