import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users,
  Hand, Monitor, MonitorOff, PenLine, Copy, Send,
  MessageSquare, ChevronRight,
} from "lucide-react";
import { useLiveClass, type Participant } from "@/hooks/use-live-class";
import Whiteboard from "@/components/whiteboard";

function VideoTile({ stream, displayName, muted, audioEnabled, videoEnabled, isLocal }: {
  stream?: MediaStream; displayName: string; muted?: boolean;
  audioEnabled?: boolean; videoEnabled?: boolean; isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#0f172a] aspect-video flex items-center justify-center">
      {stream && (videoEnabled ?? true) ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold">{initials}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
          {isLocal ? "You (host)" : displayName}
        </span>
        {!(audioEnabled ?? true) && (
          <span className="bg-red-600/80 text-white p-1 rounded-full">
            <MicOff className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

function LobbyView({ onStart }: { onStart: (name: string, title: string) => void }) {
  const [name, setName] = useState("Teacher");
  const [title, setTitle] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => {/* no preview */});
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <h1 className="text-3xl font-bold mb-1">LiveClass<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground mb-6">Start a live session for your students.</p>

        <div className="rounded-2xl overflow-hidden bg-[#0f172a] aspect-video mb-6 flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Your display name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ms Johnson" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Lesson title (optional)</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Quadratic Equations" />
          </div>
          <Button
            className="w-full mt-2" size="lg"
            onClick={() => onStart(name, title)}
            disabled={!name.trim()}
          >
            Go Live
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LiveClass() {
  const lc = useLiveClass();
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lc.chatMessages]);

  const copyCode = () => {
    if (lc.roomId) {
      navigator.clipboard.writeText(lc.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (lc.phase === "idle") {
    return <LobbyView onStart={(n, t) => lc.startRoom(n, t || undefined)} />;
  }

  if (lc.phase === "initializing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Setting up your camera and microphone…</p>
        </div>
      </div>
    );
  }

  if (lc.phase === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <VideoOff className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Camera access required</h2>
          <p className="text-muted-foreground text-sm">{lc.error || "Could not access your camera or microphone."}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  if (lc.phase === "ended") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <PhoneOff className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Session ended</h2>
          <p className="text-muted-foreground text-sm">The LiveClass™ session has ended.</p>
          <Button onClick={() => window.location.reload()}>New session</Button>
        </div>
      </div>
    );
  }

  const participantList = Array.from(lc.participants.values());
  const handsRaised = participantList.filter(p => p.handRaised);

  return (
    <div className="h-screen bg-[#0b0b0d] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-primary">LiveClass™</span>
          {lc.lessonTitle && <span className="text-sm text-muted-foreground">{lc.lessonTitle}</span>}
          <Badge variant="secondary" className="text-xs">LIVE</Badge>
        </div>
        {lc.roomId && (
          <button
            onClick={copyCode}
            className="flex items-center gap-2 bg-muted hover:bg-muted/70 transition-colors rounded-lg px-3 py-1.5 text-sm"
          >
            <span className="font-mono font-bold tracking-widest text-primary">{lc.roomId}</span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            {copied && <span className="text-xs text-green-500">Copied!</span>}
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{participantList.length + 1} in session</span>
        </div>
      </div>

      {/* Main body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video / Whiteboard area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {lc.whiteboardVisible ? (
              <motion.div
                key="wb"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <Whiteboard
                  canDraw
                  remoteEvents={lc.drawEvents}
                  clearTrigger={lc.clearCount}
                  onDraw={lc.sendDraw}
                  onClear={lc.clearBoard}
                  className="flex-1"
                />
              </motion.div>
            ) : (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 p-3 overflow-auto"
              >
                <div className={`grid gap-3 h-full ${
                  participantList.length === 0 ? "grid-cols-1" :
                  participantList.length <= 1 ? "grid-cols-2" :
                  participantList.length <= 3 ? "grid-cols-2" :
                  "grid-cols-3"
                }`}>
                  <VideoTile
                    stream={lc.localStream ?? undefined}
                    displayName="You (host)"
                    muted
                    isLocal
                    audioEnabled={lc.micOn}
                    videoEnabled={lc.cameraOn}
                  />
                  {participantList.map(p => (
                    <VideoTile
                      key={p.socketId}
                      stream={p.stream}
                      displayName={p.displayName}
                      audioEnabled={p.audioEnabled}
                      videoEnabled={p.videoEnabled}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="shrink-0 flex items-center justify-center gap-3 py-3 px-4 bg-card/80 backdrop-blur border-t">
            <ControlBtn
              active={lc.micOn}
              onClick={lc.toggleMic}
              icon={lc.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              label={lc.micOn ? "Mute" : "Unmute"}
              danger={!lc.micOn}
            />
            <ControlBtn
              active={lc.cameraOn}
              onClick={lc.toggleCamera}
              icon={lc.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              label={lc.cameraOn ? "Stop video" : "Start video"}
              danger={!lc.cameraOn}
            />
            <ControlBtn
              active={lc.isScreenSharing}
              onClick={lc.toggleScreenShare}
              icon={lc.isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              label="Screen"
            />
            <ControlBtn
              active={lc.whiteboardVisible}
              onClick={() => lc.toggleWhiteboard(!lc.whiteboardVisible)}
              icon={<PenLine className="h-5 w-5" />}
              label="Board"
            />
            <ControlBtn
              active={showChat}
              onClick={() => setShowChat(!showChat)}
              icon={<MessageSquare className="h-5 w-5" />}
              label="Chat"
              badge={lc.chatMessages.length > 0 ? lc.chatMessages.length : undefined}
            />
            <button
              onClick={lc.endRoom}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 transition-colors text-white"
            >
              <PhoneOff className="h-5 w-5" />
              <span className="text-xs">End</span>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className={`${showChat ? "w-72" : "w-56"} shrink-0 flex flex-col border-l bg-card overflow-hidden`}>
          {/* Participants */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Participants ({participantList.length + 1})</span>
            </div>
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                <ParticipantRow name="You (host)" isHost audioOn={lc.micOn} videoOn={lc.cameraOn} />
                {participantList.map(p => (
                  <ParticipantRow
                    key={p.socketId}
                    name={p.displayName}
                    audioOn={p.audioEnabled}
                    videoOn={p.videoEnabled}
                    handUp={p.handRaised}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Hand raise queue */}
          {handsRaised.length > 0 && (
            <div className="p-3 border-b bg-amber-500/10">
              <p className="text-xs font-semibold text-amber-600 mb-1">
                <Hand className="h-3.5 w-3.5 inline mr-1" />
                Hands raised
              </p>
              {handsRaised.map(p => (
                <p key={p.socketId} className="text-sm">{p.displayName}</p>
              ))}
            </div>
          )}

          {/* Chat */}
          {showChat && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {lc.chatMessages.map((m, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-semibold text-primary">{m.displayName}: </span>
                      <span className="text-foreground">{m.text}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="p-2 border-t flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && chatInput.trim()) { lc.sendChat(chatInput.trim()); setChatInput(""); } }}
                  placeholder="Message…"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => { if (chatInput.trim()) { lc.sendChat(chatInput.trim()); setChatInput(""); } }}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {!showChat && (
            <button
              onClick={() => setShowChat(true)}
              className="p-3 text-xs text-muted-foreground flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Open chat
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ active, onClick, icon, label, danger, badge }: {
  active?: boolean; onClick: () => void; icon: React.ReactNode;
  label: string; danger?: boolean; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
        active ? "bg-primary text-white" :
        danger ? "bg-destructive/10 text-destructive hover:bg-destructive/20" :
        "bg-muted hover:bg-muted/70 text-foreground"
      }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function ParticipantRow({ name, isHost, audioOn, videoOn, handUp }: {
  name: string; isHost?: boolean; audioOn?: boolean; videoOn?: boolean; handUp?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-muted/50">
      <span className="text-sm truncate">{name}</span>
      <div className="flex items-center gap-1 shrink-0">
        {handUp && <Hand className="h-3.5 w-3.5 text-amber-500" />}
        {isHost && <Badge variant="secondary" className="text-[10px] px-1 h-4">Host</Badge>}
        {!audioOn && <MicOff className="h-3 w-3 text-red-500" />}
        {!videoOn && <VideoOff className="h-3 w-3 text-red-500" />}
      </div>
    </div>
  );
}
