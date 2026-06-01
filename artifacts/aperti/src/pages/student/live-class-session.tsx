import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Hand, Send, MessageSquare,
} from "lucide-react";
import { useLiveClass } from "@/hooks/use-live-class";
import Whiteboard from "@/components/whiteboard";

function VideoTile({ stream, displayName, muted, audioEnabled, videoEnabled, small }: {
  stream?: MediaStream; displayName: string; muted?: boolean;
  audioEnabled?: boolean; videoEnabled?: boolean; small?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div className={`relative rounded-xl overflow-hidden bg-[#0f172a] flex items-center justify-center ${small ? "aspect-video" : "w-full h-full"}`}>
      {stream && (videoEnabled ?? true) ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">{initials}</span>
          </div>
          {!small && <span className="text-white/60 text-sm">{displayName}</span>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm truncate max-w-[80%]">{displayName}</span>
        {!(audioEnabled ?? true) && (
          <span className="bg-red-600/80 text-white p-0.5 rounded-full"><MicOff className="h-2.5 w-2.5" /></span>
        )}
      </div>
    </div>
  );
}

function JoinView({ onJoin, initialCode }: { onJoin: (code: string, name: string) => void; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [name, setName] = useState("Student");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">LiveClass<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground mt-2">Enter the room code your teacher shared.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Room code</label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="text-center font-mono text-2xl tracking-widest h-14 font-bold"
              maxLength={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Your name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex Smith"
            />
          </div>
          <Button
            className="w-full" size="lg"
            onClick={() => onJoin(code, name)}
            disabled={code.length < 3 || !name.trim()}
          >
            Join Class
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LiveClassSession() {
  const lc = useLiveClass();
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lc.chatMessages]);

  if (lc.phase === "idle") {
    return <JoinView onJoin={(code, name) => lc.joinRoom(code, name)} />;
  }

  if (lc.phase === "initializing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Joining session…</p>
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
          <h2 className="text-xl font-semibold">Could not join</h2>
          <p className="text-muted-foreground text-sm">{lc.error || "Check the room code and try again."}</p>
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
          <h2 className="text-xl font-semibold">Class ended</h2>
          <p className="text-muted-foreground text-sm">Your teacher has ended the session.</p>
          <Button onClick={() => window.location.reload()}>Back to class</Button>
        </div>
      </div>
    );
  }

  const allParticipants = Array.from(lc.participants.values());
  const host = allParticipants.find(p => p.isHost);
  const others = allParticipants.filter(p => !p.isHost);

  return (
    <div className="h-screen bg-[#0b0b0d] flex flex-col overflow-hidden">
      {/* Top */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary text-sm">LiveClass™</span>
          {lc.lessonTitle && <span className="text-xs text-muted-foreground">{lc.lessonTitle}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{allParticipants.length + 1} participants</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main view: teacher video or whiteboard */}
          <AnimatePresence mode="wait">
            {lc.whiteboardVisible ? (
              <motion.div
                key="wb"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <Whiteboard
                  canDraw={false}
                  remoteEvents={lc.drawEvents}
                  clearTrigger={lc.clearCount}
                  onDraw={() => {}}
                  onClear={() => {}}
                  className="h-full"
                />
              </motion.div>
            ) : (
              <motion.div
                key="video"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 p-3 relative"
              >
                {host ? (
                  <VideoTile
                    stream={host.stream}
                    displayName={host.displayName}
                    audioEnabled={host.audioEnabled}
                    videoEnabled={host.videoEnabled}
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-[#0f172a] flex items-center justify-center">
                    <p className="text-white/40 text-sm">Waiting for teacher…</p>
                  </div>
                )}
                {/* Local video pip */}
                <div className="absolute bottom-6 right-6 w-32 rounded-xl overflow-hidden shadow-xl border-2 border-primary/30">
                  <VideoTile
                    stream={lc.localStream ?? undefined}
                    displayName="You"
                    muted
                    audioEnabled={lc.micOn}
                    videoEnabled={lc.cameraOn}
                    small
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Other students strip */}
          {others.length > 0 && !lc.whiteboardVisible && (
            <div className="shrink-0 flex gap-2 px-3 pb-2 overflow-x-auto">
              {others.map(p => (
                <div key={p.socketId} className="w-36 shrink-0">
                  <VideoTile
                    stream={p.stream}
                    displayName={p.displayName}
                    audioEnabled={p.audioEnabled}
                    videoEnabled={p.videoEnabled}
                    small
                  />
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="shrink-0 flex items-center justify-center gap-3 py-3 px-4 bg-card/80 backdrop-blur border-t">
            <CtrlBtn
              active={lc.micOn}
              onClick={lc.toggleMic}
              icon={lc.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              label={lc.micOn ? "Mute" : "Unmute"}
              danger={!lc.micOn}
            />
            <CtrlBtn
              active={lc.cameraOn}
              onClick={lc.toggleCamera}
              icon={lc.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              label={lc.cameraOn ? "Stop" : "Start"}
              danger={!lc.cameraOn}
            />
            <CtrlBtn
              active={lc.handRaised}
              onClick={() => lc.raiseHand(!lc.handRaised)}
              icon={<Hand className="h-5 w-5" />}
              label={lc.handRaised ? "Lower" : "Hand"}
            />
            <CtrlBtn
              active={showChat}
              onClick={() => setShowChat(!showChat)}
              icon={<MessageSquare className="h-5 w-5" />}
              label="Chat"
              badge={lc.chatMessages.length > 0 ? lc.chatMessages.length : undefined}
            />
            <button
              onClick={lc.leaveRoom}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 transition-colors text-white"
            >
              <PhoneOff className="h-5 w-5" />
              <span className="text-xs">Leave</span>
            </button>
          </div>
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ width: 0 }} animate={{ width: 256 }} exit={{ width: 0 }}
              className="shrink-0 flex flex-col border-l bg-card overflow-hidden"
            >
              <div className="p-3 border-b font-semibold text-sm">Chat</div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {lc.chatMessages.map((m, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-semibold text-primary">{m.displayName}: </span>
                      <span>{m.text}</span>
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
                  size="sm" className="h-8 w-8 p-0 shrink-0"
                  onClick={() => { if (chatInput.trim()) { lc.sendChat(chatInput.trim()); setChatInput(""); } }}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CtrlBtn({ active, onClick, icon, label, danger, badge }: {
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
