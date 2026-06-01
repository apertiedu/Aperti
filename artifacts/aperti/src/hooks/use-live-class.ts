import { useRef, useState, useCallback, useEffect } from "react";
import { io, type Socket } from "socket.io-client";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export interface Participant {
  socketId: string;
  displayName: string;
  isHost: boolean;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
}

export interface DrawEvent {
  tool: "pen" | "eraser";
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  color: string;
  size: number;
}

export interface ChatMessage {
  socketId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export type RoomPhase = "idle" | "initializing" | "active" | "ended" | "error";

export function useLiveClass() {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isInitialized = useRef(false);

  const [phase, setPhase] = useState<RoomPhase>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitleState] = useState<string | undefined>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawEvents, setDrawEvents] = useState<DrawEvent[]>([]);
  const [clearCount, setClearCount] = useState(0);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const updateParticipant = useCallback((socketId: string, updates: Partial<Participant>) => {
    setParticipants(prev => {
      const next = new Map(prev);
      const existing = next.get(socketId);
      if (existing) next.set(socketId, { ...existing, ...updates });
      return next;
    });
  }, []);

  const addParticipant = useCallback((p: Omit<Participant, "stream">) => {
    setParticipants(prev => {
      const next = new Map(prev);
      next.set(p.socketId, { ...p });
      return next;
    });
  }, []);

  const removeParticipant = useCallback((socketId: string) => {
    pcsRef.current.get(socketId)?.close();
    pcsRef.current.delete(socketId);
    setParticipants(prev => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  const createPC = useCallback((remoteId: string): RTCPeerConnection => {
    const existing = pcsRef.current.get(remoteId);
    if (existing) {
      existing.close();
      pcsRef.current.delete(remoteId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = ({ streams }) => {
      const [stream] = streams;
      if (stream) {
        setParticipants(prev => {
          const next = new Map(prev);
          const p = next.get(remoteId);
          if (p) next.set(remoteId, { ...p, stream });
          return next;
        });
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current?.emit("ice-candidate", { target: remoteId, candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        pc.close();
        pcsRef.current.delete(remoteId);
      }
    };

    pcsRef.current.set(remoteId, pc);
    return pc;
  }, []);

  const flushPending = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
    const candidates = pendingRef.current.get(remoteId) ?? [];
    for (const c of candidates) {
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
    pendingRef.current.delete(remoteId);
  }, []);

  const initSocket = useCallback((): Socket => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setMySocketId(socket.id ?? null));

    socket.on("room-created", ({ roomId: rid, lessonTitle: lt }: { roomId: string; lessonTitle?: string }) => {
      setRoomId(rid);
      setLessonTitleState(lt);
      setPhase("active");
    });

    socket.on("room-state", ({ roomId: rid, lessonTitle: lt, participants: pList }: {
      roomId: string; lessonTitle?: string;
      participants: Array<{ socketId: string; displayName: string; isHost: boolean; audioEnabled: boolean; videoEnabled: boolean }>;
    }) => {
      setRoomId(rid);
      setLessonTitleState(lt);
      setPhase("active");
      const map = new Map<string, Participant>();
      pList.forEach(p => {
        map.set(p.socketId, { ...p, handRaised: false });
        const pc = createPC(p.socketId);
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer).then(() => offer))
          .then(offer => socket.emit("offer", { target: p.socketId, sdp: offer }))
          .catch(() => {/* ignore */});
      });
      setParticipants(map);
    });

    socket.on("participant-joined", ({ socketId, displayName, isHost }: { socketId: string; displayName: string; isHost: boolean }) => {
      addParticipant({ socketId, displayName, isHost, audioEnabled: true, videoEnabled: true, handRaised: false });
      const pc = createPC(socketId);
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer).then(() => offer))
        .then(offer => socket.emit("offer", { target: socketId, sdp: offer }))
        .catch(() => {/* ignore */});
    });

    socket.on("offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPC(from);
      try {
        await pc.setRemoteDescription(sdp);
        await flushPending(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { target: from, sdp: answer });
      } catch { /* ignore */ }
    });

    socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(sdp);
        await flushPending(from, pc);
      } catch { /* ignore */ }
    });

    socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcsRef.current.get(from);
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
      } else {
        const list = pendingRef.current.get(from) ?? [];
        list.push(candidate);
        pendingRef.current.set(from, list);
      }
    });

    socket.on("participant-left", ({ socketId }: { socketId: string }) => {
      removeParticipant(socketId);
    });

    socket.on("participant-media-changed", ({ socketId, audioEnabled, videoEnabled }: { socketId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
      updateParticipant(socketId, { audioEnabled, videoEnabled });
    });

    socket.on("hand-raised", ({ socketId, raised }: { socketId: string; raised: boolean }) => {
      updateParticipant(socketId, { handRaised: raised });
    });

    socket.on("whiteboard-draw", (evt: DrawEvent) => {
      setDrawEvents(prev => [...prev, evt]);
    });

    socket.on("whiteboard-clear", () => {
      setDrawEvents([]);
      setClearCount(c => c + 1);
    });

    socket.on("whiteboard-toggle", ({ visible }: { visible: boolean }) => {
      setWhiteboardVisible(visible);
    });

    socket.on("chat-message", (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on("room-ended", () => {
      cleanup();
      setPhase("ended");
    });

    socket.on("join-error", ({ message }: { message: string }) => {
      setError(message);
      setPhase("error");
    });

    return socket;
  }, [createPC, flushPending, addParticipant, removeParticipant, updateParticipant]);

  const initMedia = useCallback(async () => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    setPhase("initializing");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not access camera/microphone";
      setError(msg);
      setPhase("error");
      isInitialized.current = false;
      throw e;
    }
  }, []);

  const startRoom = useCallback(async (displayName: string, lt?: string) => {
    await initMedia();
    const socket = initSocket();
    socket.emit("create-room", { displayName, lessonTitle: lt });
  }, [initMedia, initSocket]);

  const joinRoom = useCallback(async (code: string, displayName: string) => {
    await initMedia();
    const socket = initSocket();
    socket.emit("join-room", { roomId: code.toUpperCase(), displayName });
  }, [initMedia, initSocket]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newVal = !micOn;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = newVal; });
    setMicOn(newVal);
    socketRef.current?.emit("media-changed", { audioEnabled: newVal, videoEnabled: cameraOn });
  }, [micOn, cameraOn]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const newVal = !cameraOn;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = newVal; });
    setCameraOn(newVal);
    socketRef.current?.emit("media-changed", { audioEnabled: micOn, videoEnabled: newVal });
  }, [cameraOn, micOn]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      pcsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender && camTrack) sender.replaceTrack(camTrack).catch(() => {/* ignore */});
      });
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        pcsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack).catch(() => {/* ignore */});
        });
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch { /* user cancelled */ }
    }
  }, [isScreenSharing]);

  const toggleWhiteboard = useCallback((visible: boolean) => {
    setWhiteboardVisible(visible);
    socketRef.current?.emit("whiteboard-toggle", { visible });
  }, []);

  const sendDraw = useCallback((evt: DrawEvent) => {
    setDrawEvents(prev => [...prev, evt]);
    socketRef.current?.emit("whiteboard-draw", evt);
  }, []);

  const clearBoard = useCallback(() => {
    setDrawEvents([]);
    setClearCount(c => c + 1);
    socketRef.current?.emit("whiteboard-clear");
  }, []);

  const raiseHand = useCallback((raised: boolean) => {
    setHandRaised(raised);
    socketRef.current?.emit("raise-hand", { raised });
  }, []);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("chat-message", { text });
  }, []);

  const endRoom = useCallback(() => {
    socketRef.current?.emit("end-room");
    cleanup();
    setPhase("ended");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave-room");
    cleanup();
    setPhase("ended");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    pendingRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    isInitialized.current = false;
    setLocalStream(null);
    setParticipants(new Map());
  }, []);

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phase, roomId, lessonTitle, localStream, participants,
    micOn, cameraOn, isScreenSharing, whiteboardVisible,
    handRaised, mySocketId, error,
    drawEvents, clearCount, chatMessages,
    startRoom, joinRoom,
    toggleMic, toggleCamera, toggleScreenShare,
    toggleWhiteboard, sendDraw, clearBoard,
    raiseHand, sendChat,
    endRoom, leaveRoom,
  };
}
