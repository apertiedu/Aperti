import { Link } from "wouter";
import { BookOpen, Users, BarChart2, Settings, HelpCircle, FileText, Shield, Mail } from "lucide-react";

const sections = [
  {
    title: "For Teachers",
    icon: <BookOpen className="h-5 w-5 text-primary" />,
    links: [
      { label: "Core Hub (Dashboard)", href: "/" },
      { label: "Plan Grid (Calendar)", href: "/plan-grid" },
      { label: "Check-in (Attendance)", href: "/checkin" },
      { label: "Submit Flow (Homework)", href: "/submit-flow" },
      { label: "Grade Flow (Marking)", href: "/grade-flow" },
      { label: "ContentCraft (Lessons)", href: "/content-craft" },
      { label: "SchemeCraft", href: "/scheme-craft" },
      { label: "Syllabuilder", href: "/syllabuilder" },
      { label: "QueryVault (Questions)", href: "/query-vault" },
      { label: "CardStack (Flashcards)", href: "/cardstack" },
      { label: "Lab Builder", href: "/lab-builder" },
      { label: "MarkerMind (AI Marking)", href: "/marker-mind" },
      { label: "Insight Stream", href: "/insight-stream" },
      { label: "Kudos Engine", href: "/kudos-engine" },
      { label: "Pulse (Analytics)", href: "/pulse" },
      { label: "HelpDesk", href: "/helpdesk" },
      { label: "My Subscription", href: "/account/subscription" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "For Students",
    icon: <Users className="h-5 w-5 text-primary" />,
    links: [
      { label: "Study Stream (Dashboard)", href: "/" },
      { label: "My Homework", href: "/my-homework" },
      { label: "My Timetable", href: "/my-timetable" },
      { label: "My Attendance", href: "/my-attendance" },
      { label: "The Mentor (AI)", href: "/mentor" },
      { label: "CardStack (Flashcards)", href: "/flashcards" },
      { label: "Ascend (Analytics)", href: "/ascend" },
      { label: "Exams", href: "/exams" },
      { label: "Skill Badges", href: "/skill-badge" },
      { label: "Learning Path", href: "/learn-path" },
      { label: "Discover Feed", href: "/discover" },
      { label: "Revisit", href: "/revisit" },
      { label: "Focus Coach", href: "/focus-coach" },
      { label: "Peak Rankings", href: "/peak-rankings" },
    ],
  },
  {
    title: "Admin",
    icon: <Settings className="h-5 w-5 text-primary" />,
    links: [
      { label: "Command Centre", href: "/admin/command" },
      { label: "World Pilot", href: "/admin/world-pilot" },
      { label: "Paper Vault", href: "/admin/paper-vault" },
      { label: "Shield Core", href: "/admin/shield-core" },
      { label: "Budget Sense", href: "/admin/budget-sense" },
    ],
  },
  {
    title: "Legal & Support",
    icon: <HelpCircle className="h-5 w-5 text-primary" />,
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

export default function Sitemap() {
  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Sitemap</h1>
      <p className="text-muted-foreground mb-10">All pages and modules in the Aperti platform.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map(section => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-4">
              {section.icon}
              <h2 className="text-lg font-semibold">{section.title}</h2>
            </div>
            <ul className="space-y-1.5">
              {section.links.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
