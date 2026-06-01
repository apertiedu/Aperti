import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { setRoleOverride, getRoleOverride } from "@/App";
import {
  GraduationCap, Users, UserCheck, Shield, UserCog,
  Eye, LogOut, RefreshCw,
} from "lucide-react";

const ROLES = [
  {
    id: "admin",
    label: "Admin",
    description: "Full platform control — Admin Command Centre",
    icon: Shield,
    color: "#00796B",
    bg: "#E6F4F1",
  },
  {
    id: "teacher",
    label: "Teacher",
    description: "CoreHub, PlanGrid, CheckIn, GradeFlow and all teaching tools",
    icon: UserCheck,
    color: "#1976D2",
    bg: "#E3F2FD",
  },
  {
    id: "assistant",
    label: "Assistant",
    description: "CheckIn, GradeFlow, MarkerMind and assigned modules",
    icon: UserCog,
    color: "#7B1FA2",
    bg: "#F3E5F5",
  },
  {
    id: "student",
    label: "Student",
    description: "StudyStream, Mentor, SimVerse, Ascend and the student portal",
    icon: GraduationCap,
    color: "#E65100",
    bg: "#FBE9E7",
  },
  {
    id: "parent",
    label: "Parent",
    description: "GuardianHub — view child progress and attendance",
    icon: Users,
    color: "#388E3C",
    bg: "#E8F5E9",
  },
] as const;

export default function QuickSwitch() {
  const { user } = useAuth();
  const currentOverride = getRoleOverride();
  const [selected, setSelected] = useState<string>(currentOverride || user?.role || "admin");

  const handleSwitch = () => {
    if (selected === user?.role) {
      setRoleOverride(null);
    } else {
      setRoleOverride(selected);
    }
    window.location.href = "/";
  };

  const handleExit = () => {
    setRoleOverride(null);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-[#00796B]/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-[#00796B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QuickSwitch</h1>
            <p className="text-sm text-gray-500">Preview the platform from any role's perspective</p>
          </div>
        </div>

        {currentOverride && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-[#00796B]/10 border border-[#00796B]/20"
          >
            <Eye className="h-4 w-4 text-[#00796B]" />
            <span className="text-sm text-[#00796B] font-medium">
              Currently previewing as <strong>{currentOverride}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExit}
              className="ml-auto border-[#00796B]/30 text-[#00796B] hover:bg-[#00796B]/10 h-7 text-xs"
            >
              <LogOut className="h-3 w-3 mr-1" /> Exit Preview
            </Button>
          </motion.div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
        {ROLES.map((role, i) => {
          const Icon = role.icon;
          const isSelected = selected === role.id;
          const isCurrent = user?.role === role.id;
          return (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <button
                onClick={() => setSelected(role.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 bg-white shadow-sm hover:shadow-md ${
                  isSelected
                    ? "border-[#00796B] ring-1 ring-[#00796B]/20"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: role.bg }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: role.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{role.label}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{role.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-3 h-0.5 w-full rounded-full bg-[#00796B]/20">
                    <div className="h-full bg-[#00796B] rounded-full w-full" />
                  </div>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        <Button
          onClick={handleSwitch}
          className="bg-[#00796B] hover:bg-[#00695C] text-white px-6"
        >
          <Eye className="h-4 w-4 mr-2" />
          {selected === user?.role ? "View as Myself" : `Preview as ${ROLES.find(r => r.id === selected)?.label}`}
        </Button>
        {currentOverride && (
          <Button variant="outline" onClick={handleExit}>
            <LogOut className="h-4 w-4 mr-2" /> Exit Preview Mode
          </Button>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Role switching is temporary and does not change your actual account. A banner will appear when previewing as another role.
      </p>
    </div>
  );
}
