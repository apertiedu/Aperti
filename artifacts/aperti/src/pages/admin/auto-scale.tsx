import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, HardDrive, AlertTriangle } from "lucide-react";

export default function AutoScale() {
  const [cpuUsage, setCpuUsage] = useState(42);
  const [ramUsage, setRamUsage] = useState(68);
  const [diskUsage, setDiskUsage] = useState(55);
  const [activeUsers, setActiveUsers] = useState(87);
  const [recommendation, setRecommendation] = useState("");

  // Simulate fetching metrics (in production, call Spaceship API)
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.floor(Math.random() * 30) + 30);
      setRamUsage(Math.floor(Math.random() * 20) + 60);
      setActiveUsers(Math.floor(Math.random() * 50) + 70);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const analyzeScaling = () => {
    if (cpuUsage > 75 || ramUsage > 85) {
      setRecommendation("High load detected. Consider upgrading to a larger Spaceship VPS plan (e.g., Star VPS 6).");
    } else if (activeUsers > 150) {
      setRecommendation("User count growing. Add a load balancer and a second application node soon.");
    } else {
      setRecommendation("System healthy. Current resources are sufficient.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Activity className="h-7 w-7 text-primary" /> AutoScale<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Monitor and scale your infrastructure intelligently.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <Cpu className="h-8 w-8 text-primary" />
            <div><p className="text-2xl font-bold">{cpuUsage}%</p><p className="text-sm text-muted-foreground">CPU Usage</p></div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <HardDrive className="h-8 w-8 text-primary" />
            <div><p className="text-2xl font-bold">{ramUsage}%</p><p className="text-sm text-muted-foreground">RAM Usage</p></div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <HardDrive className="h-8 w-8 text-primary" />
            <div><p className="text-2xl font-bold">{diskUsage}%</p><p className="text-sm text-muted-foreground">Disk</p></div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-4">
            <Activity className="h-8 w-8 text-primary" />
            <div><p className="text-2xl font-bold">{activeUsers}</p><p className="text-sm text-muted-foreground">Active Users</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-hover max-w-2xl">
        <CardHeader><CardTitle>Scaling Advisor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Progress value={cpuUsage} className="h-2" />
          <Progress value={ramUsage} className="h-2" />
          <Button onClick={analyzeScaling}>Analyze Now</Button>
          {recommendation && (
            <div className="p-3 bg-muted rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <p className="text-sm">{recommendation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
