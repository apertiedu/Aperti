import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home, BookOpen, CalendarCheck, Brain, Layers, Zap, Flame, FlaskConical, HelpCircle,
} from "lucide-react";

const navItems = [
  { href: "/", label: "StudyStream", icon: Home },
  { href: "/my-homework", label: "Homework", icon: BookOpen },
  { href: "/my-timetable", label: "Timetable", icon: CalendarCheck },
  { href: "/mentor", label: "The Mentor", icon: Brain },
  { href: "/flashcards", label: "CardStack", icon: Layers },
  { href: "/ascend", label: "Ascend", icon: Flame },
  { href: "/simverse", label: "SimVerse", icon: FlaskConical },
  { href: "/helpdesk", label: "Help", icon: HelpCircle },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 w-full border-t border-border bg-card/90 backdrop-blur-md z-50">
        <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" size="sm" className={`flex flex-col items-center gap-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
