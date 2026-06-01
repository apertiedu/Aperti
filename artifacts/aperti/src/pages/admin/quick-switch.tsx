import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/auth";

export default function QuickSwitch() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState(user?.role || "teacher");

  const handleSwitch = () => {
    // Temporarily override role in context (not persisted)
    if (user) {
      user.role = selectedRole;
      window.location.reload(); // simple refresh to re‑render with new role
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">QuickSwitch<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Preview the platform as any role.</p>
      </motion.div>

      <Card className="card-hover max-w-md">
        <CardHeader><CardTitle>Switch Role</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as typeof selectedRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="assistant">Assistant</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSwitch} className="w-full">Switch Now</Button>
        </CardContent>
      </Card>
    </div>
  );
}
