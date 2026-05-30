import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight, Circle } from "lucide-react";

const PATH = [
  { topic: "Algebra Basics", completed: true },
  { topic: "Quadratic Equations", completed: true },
  { topic: "Functions", completed: false },
  { topic: "Calculus Intro", completed: false },
  { topic: "Vectors", completed: false },
];

export default function LearnPath() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">LearnPath<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Your recommended journey to mastery.</p>
      </motion.div>

      <Card className="card-hover max-w-lg mx-auto">
        <CardContent className="p-6">
          <div className="space-y-4">
            {PATH.map((step, idx) => (
              <div key={step.topic} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  {step.completed ? (
                    <CheckCircle className="h-6 w-6 text-primary" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                  {idx < PATH.length - 1 && <div className="w-0.5 h-6 bg-border" />}
                </div>
                <div>
                  <p className={`font-medium ${step.completed ? "" : "text-muted-foreground"}`}>{step.topic}</p>
                  {step.completed && <Badge variant="secondary" className="text-xs">Completed</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
