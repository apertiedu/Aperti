import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Smartphone, QrCode, MicOff, Hand, BarChart3, Monitor } from "lucide-react";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";

export default function TwinControl() {
  const features = [
    { icon: QrCode, label: "QR Pairing", desc: "Pair any mobile device as a clicker in seconds" },
    { icon: MicOff, label: "Mute Controls", desc: "Mute or spotlight participants from your phone" },
    { icon: Hand, label: "Hand-Raise Queue", desc: "Manage raised hands and grant speaking turns" },
    { icon: BarChart3, label: "Live Polls", desc: "Launch and tally polls without leaving the slide" },
    { icon: Monitor, label: "Whiteboard Remote", desc: "Draw annotations wirelessly from across the room" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6 flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-lg w-full"
      >
        {/* Icon */}
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: TEAL_LIGHT }}
        >
          <Smartphone className="h-8 w-8" style={{ color: TEAL }} />
        </div>

        <Badge
          className="mb-5 rounded-full px-4 py-1.5 text-xs font-semibold border-0 gap-1.5"
          style={{ background: TEAL_LIGHT, color: TEAL }}
        >
          <Clock className="h-3 w-3" /> Coming Soon
        </Badge>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">TwinControl</h1>
        <p className="text-gray-500 text-base leading-relaxed mb-10">
          Turn any smartphone into a wireless classroom remote. Pair via QR code and control your live session, polls, and whiteboard from anywhere in the room.
        </p>

        {/* Feature preview grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-10">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
            >
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: TEAL_LIGHT }}
                  >
                    <f.icon className="h-4 w-4" style={{ color: TEAL }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{f.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {/* Filler for odd grid */}
          <div />
        </div>

        <p className="text-xs text-gray-400">
          TwinControl pairs seamlessly with LiveClass sessions. You'll be notified when it's available for your institution.
        </p>
      </motion.div>
    </div>
  );
}
