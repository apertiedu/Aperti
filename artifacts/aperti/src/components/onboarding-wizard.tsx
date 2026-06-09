import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { title: "Welcome to Aperti", description: "Let's set up your classroom in 3 minutes." },
  { title: "Add Your Subjects", description: "Select the exam board and subjects you teach." },
  { title: "Create Your First Lesson", description: "Set up a recurring lesson for your class." },
  { title: "Invite Students", description: "Share your teacher code so students can join." },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const progress = ((step + 1) / STEPS.length) * 100;

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full card-hover">
        <CardHeader>
          <CardTitle>{STEPS[step].title}</CardTitle>
          <p className="text-muted-foreground">{STEPS[step].description}</p>
          <Progress value={progress} className="h-1 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <SubjectsStep />}
          {step === 2 && <LessonStep />}
          {step === 3 && <InviteStep />}
          <div className="flex justify-between">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button className="ml-auto" onClick={next}>{step === STEPS.length - 1 ? "Finish" : "Next"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeStep() { return <p>We're excited to have you! Aperti will help you manage attendance, assignments, courses, and much more — all in one place.</p>; }
function SubjectsStep() { return <Input placeholder="e.g., Physics 0625 CAIE" />; }
function LessonStep() { return <Input placeholder="e.g., Monday 9:00 AM Physics" />; }
function InviteStep() { return <p>Your teacher code is <strong>APR-12345</strong>. Share this with your students to join your classes.</p>; }
