import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "";

export default function GuardianPulseAdmin() {
  const [result, setResult] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      fetch(`${API}/guardian-pulse/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token")}` },
      }).then(r => r.json()),
    onSuccess: (data) => setResult(data.message),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <Card className="card-hover max-w-md mx-auto">
        <CardHeader><CardTitle>Send GuardianPulse Emails</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This will send the weekly summary to all parents.</p>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Sending..." : "Send Now"}
          </Button>
          {result && <p className="text-sm text-green-600">{result}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
