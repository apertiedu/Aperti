import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { QrCode, MicOff, Hand, Users, Play, Pause, Monitor, MessageCircle, BarChart3 } from "lucide-react";
import { Room, RoomEvent, RemoteParticipant } from "livekit-client";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";
const API = import.meta.env.VITE_API_URL || "";

export default function TwinControl() {
  const [pairCode, setPairCode] = useState("");
  const [controlToken, setControlToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [handRaised, setHandRaised] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // Pair via scanning (simulate with input for now)
  const pairDevice = async () => {
    const res = await fetch(`${API}/live-class/control-token?pairCode=${pairCode}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token")}` },
    });
    const data = await res.json();
    if (data.controlToken) {
      setControlToken(data.controlToken);
      setRoomName(data.roomName);
    }
  };

  // Connect with control token
  useEffect(() => {
    if (!controlToken || !roomName) return;
    const room = new Room({ adaptiveStream: true });
    roomRef.current = room;
    room.connect(LIVEKIT_URL, controlToken).then(() => {
      // Listen for participants
      setParticipants([...room.remoteParticipants.values()]);
      room.on(RoomEvent.ParticipantConnected, () => setParticipants([...room.remoteParticipants.values()]));
      room.on(RoomEvent.ParticipantDisconnected, () => setParticipants([...room.remoteParticipants.values()]));
      // Listen for hand raise data (we'll use data messages)
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        if (payload.toString() === "hand_raise" && participant) setHandRaised((prev) => [...prev, participant.identity]);
      });
    });
    return () => { room.disconnect(); };
  }, [controlToken, roomName]);

  const sendControl = (action: string) => {
    // Send data message to room (presenter device will listen)
    const str = JSON.stringify({ action, timestamp: Date.now() });
    roomRef.current?.localParticipant.publishData(new TextEncoder().encode(str), { reliable: true });
  };

  return (
    <div className="min-h-screen bg-background p-4 page-transition">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">TwinControl<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground mb-4">Your pocket command center.</p>

        {!controlToken ? (
          <Card className="card-hover">
            <CardHeader><CardTitle>Pair with LiveClass</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Enter pair code" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
                <Button onClick={pairDevice}>Connect</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => alert("Scan QR would open camera")}>
                <QrCode className="h-4 w-4 mr-2" /> Scan QR Code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm">Connected to {roomName}</span>
                <Badge className="bg-primary text-primary-foreground">Live</Badge>
              </CardContent>
            </Card>

            {/* Quick Controls Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => sendControl("mute_all")}>
                <MicOff className="h-5 w-5" /> <span className="text-xs">Mute All</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => sendControl("hand_queue")}>
                <Hand className="h-5 w-5" /> <span className="text-xs">Hands ({handRaised.length})</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => { setRecording(!recording); sendControl(recording ? "pause_rec" : "resume_rec"); }}>
                {recording ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} <span className="text-xs">Rec</span>
              </Button>
            </div>

            {/* Participant list */}
            <Card className="card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Participants ({participants.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {participants.map((p) => (
                    <div key={p.sid} className="flex items-center justify-between">
                      <span className="text-sm">{p.name || p.identity}</span>
                      <div className="flex gap-2">
                        {handRaised.includes(p.sid) && <Badge variant="secondary">✋</Badge>}
                        <Button variant="ghost" size="sm" onClick={() => sendControl(`mute_single:${p.sid}`)}><MicOff className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Extra Controls */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => sendControl("share_screen")}><Monitor className="h-4 w-4 mr-2" />Share Screen</Button>
              <Button variant="outline" onClick={() => sendControl("poll")}><BarChart3 className="h-4 w-4 mr-2" />Quick Poll</Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
