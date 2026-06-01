import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Video, FlaskConical, Layers } from "lucide-react";

const FEED = [
  { type: "video", title: "Understanding Waves", description: "10‑min animated lesson", icon: <Video className="h-5 w-5" /> },
  { type: "simulation", title: "Build a Circuit", description: "Try the ForgeField lab", icon: <FlaskConical className="h-5 w-5" /> },
  { type: "flashcards", title: "Chemical Bonding", description: "Review key terms", icon: <Layers className="h-5 w-5" /> },
  { type: "article", title: "Exam Tips: Physics", description: "Examiner report highlights", icon: <FileText className="h-5 w-5" /> },
];

export default function DiscoverFeed() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">DiscoverFeed<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Content tailored to your learning.</p>
      </motion.div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEED.map((item, idx) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
              <Card className="card-hover cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.icon}
                    </div>
                    <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
