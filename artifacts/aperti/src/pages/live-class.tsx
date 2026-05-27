import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Hand, Monitor, QrCode,
  Play, Pause, StopCircle,
} from "lucide-react";
import { Room, VideoPresets, RoomEvent, RemoteParticipant } from "livekit-client";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function LiveClass() {
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [handRaised, setHandRaised] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);

  const { data: lessons } = useQuery({
    queryKey: ["lessons"],
    queryFn: () => fetchJSON("/lessons"),
  });

  const createRoom = useMutation({
    mutationFn: (lessonId: number) => fetchJSON("/live-class/create", { method: "POST", body: JSON.stringify({ lessonId }) }),
    onSuccess: (data) => {
      setRoomName(data.roomName);
      setHostToken(data.hostToken);
    },
  });

  useEffect(() => {
    if (!hostToken || !roomName) return;
    const room = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: VideoPresets.h720.resolution } });
    roomRef.current = room;
    room.connect(LIVEKIT_URL, hostToken).then(() => {
      room.localParticipant.setMicrophoneEnabled(micOn);
      room.localParticipant.setCameraEnabled(videoOn);
      setParticipants([...room.remoteParticipant.values()]);
      room.on(RoomEvent.ParticipantConnected, () => setParticipants([...room.remoteParticipant.values()]));
      room.on(RoomEvent.ParticipantDisconnected, () => setParticipants([...room.remoteParticipant.values()]));
    });
    return () => { room.disconnect(); };
  }, [hostToken, roomName]);

  const toggleMic = () => { roomRef.current?.localParticipant.setMicrophoneEnabled(!micOn); setMicOn(!micOn); };
  const toggleVideo = () => { roomRef.current?.localParticipant.setCameraEnabled(!videoOn); setVideoOn(!videoOn); };
  const endCall = () => roomRef.current?.disconnect();

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">LiveClass<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Your virtual classroom with full host control.</p>
      </motion.div>

      {!roomName ? (
        <Card className="card-hover max-w-md mx-auto">
          <CardHeader><CardTitle>Start a live session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedLessonId?.toString() ?? ""} onValueChange={(v) => setSelectedLessonId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Choose a lesson" /></SelectTrigger>
              <SelectContent>
                {lessons?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>Lesson {l.lessonNumber} – {l.startTime}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={() => selectedLessonId && createRoom.mutate(selectedLessonId)} disabled={createRoom.isPending}>
              {createRoom.isPending ? "Creating…" : "Start LiveClass"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main video area */}
          <Card className="lg:col-span-3 card-hover">
            <CardContent className="p-4 min-h-[400px] bg-muted/30 rounded-lg flex items-center justify-center relative">
              <div id="video-grid" className="grid grid-cols-2 gap-4 w-full h-full" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-card/90 backdrop-blur-sm rounded-full px-6 py-3 shadow">
                <Button variant="ghost" size="icon" onClick={toggleMic}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-destructive" />}</Button>
                <Button variant="ghost" size="icon" onClick={toggleVideo}>{videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-destructive" />}</Button>
                <Button variant="ghost" size="icon" onClick={endCall}><PhoneOff className="h-5 w-5 text-destructive" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setRecording(!recording)}>{recording ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 text-primary" />}</Button>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar controls */}
          <div className="space-y-4">
            <Card className="card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Participants ({participants.length})</CardTitle></CardHeader>
              <CardContent>
                {participants.map((p) => (
                  <div key={p.sid} className="flex items-center justify-between py-1">
                    <span className="text-sm">{p.name || p.identity}</span>
                    <Badge variant="secondary">{handRaised.includes(p.sid) ? "✋" : "🎤"}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Host Controls</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm"><Users className="h-4 w-4 mr-2" />Mute All</Button>
                <Button variant="outline" className="w-full justify-start" size="sm"><Hand className="h-4 w-4 mr-2" />Raise Hand Queue</Button>
                <Button variant="outline" className="w-full justify-start" size="sm"><Monitor className="h-4 w-4 mr-2" />Share Screen</Button>
                <Button variant="outline" className="w-full justify-start" size="sm"><QrCode className="h-4 w-4 mr-2" />Pair TwinControl</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// After setHostToken...
// Show pairing dialog with QR code
setPairDialogOpen(true);

room.on(RoomEvent.DataReceived, (payload, participant) => {
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    if (msg.action === "mute_all") {
      participants.forEach(p => p.setMicrophoneEnabled(false));
    }
    // ... handle other actions
  } catch {}
});
