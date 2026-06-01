import type { Server as SocketServer } from "socket.io";

interface RoomParticipant {
  socketId: string;
  displayName: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
}

interface Room {
  roomId: string;
  hostSocketId: string;
  lessonTitle?: string;
  participants: Map<string, RoomParticipant>;
  createdAt: Date;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

function makeRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cleanupRoom(io: SocketServer, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.participants.forEach((_, sid) => socketToRoom.delete(sid));
  rooms.delete(roomId);
  io.socketsLeave(roomId);
}

export function setupSignaling(io: SocketServer) {
  io.on("connection", (socket) => {

    // ── Host creates a room ──────────────────────────────────────────
    socket.on("create-room", ({ displayName, lessonTitle }: { displayName: string; lessonTitle?: string }) => {
      const roomId = makeRoomId();
      const room: Room = {
        roomId,
        hostSocketId: socket.id,
        lessonTitle,
        participants: new Map([[socket.id, {
          socketId: socket.id,
          displayName,
          isHost: true,
          audioEnabled: true,
          videoEnabled: true,
          handRaised: false,
        }]]),
        createdAt: new Date(),
      };
      rooms.set(roomId, room);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      socket.emit("room-created", { roomId, lessonTitle });
    });

    // ── Participant joins ────────────────────────────────────────────
    socket.on("join-room", ({ roomId, displayName }: { roomId: string; displayName: string }) => {
      const rid = roomId.toUpperCase();
      const room = rooms.get(rid);
      if (!room) {
        socket.emit("join-error", { message: `Room "${rid}" not found. Ask your teacher for the code.` });
        return;
      }

      const participant: RoomParticipant = {
        socketId: socket.id,
        displayName,
        isHost: false,
        audioEnabled: true,
        videoEnabled: true,
        handRaised: false,
      };
      room.participants.set(socket.id, participant);
      socketToRoom.set(socket.id, rid);
      socket.join(rid);

      // Tell new participant the current state (everyone already in the room)
      const existingList = Array.from(room.participants.values())
        .filter(p => p.socketId !== socket.id)
        .map(p => ({ socketId: p.socketId, displayName: p.displayName, isHost: p.isHost, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled }));

      socket.emit("room-state", {
        roomId: rid,
        lessonTitle: room.lessonTitle,
        participants: existingList,
      });

      // Tell all existing participants about the newcomer (they create WebRTC offers)
      socket.to(rid).emit("participant-joined", {
        socketId: socket.id,
        displayName,
        isHost: false,
      });
    });

    // ── WebRTC signaling relay ───────────────────────────────────────
    socket.on("offer", ({ target, sdp }: { target: string; sdp: object }) => {
      io.to(target).emit("offer", { from: socket.id, sdp });
    });

    socket.on("answer", ({ target, sdp }: { target: string; sdp: object }) => {
      io.to(target).emit("answer", { from: socket.id, sdp });
    });

    socket.on("ice-candidate", ({ target, candidate }: { target: string; candidate: object }) => {
      io.to(target).emit("ice-candidate", { from: socket.id, candidate });
    });

    // ── Whiteboard ───────────────────────────────────────────────────
    socket.on("whiteboard-draw", (event: object) => {
      const rid = socketToRoom.get(socket.id);
      if (rid) socket.to(rid).emit("whiteboard-draw", event);
    });

    socket.on("whiteboard-clear", () => {
      const rid = socketToRoom.get(socket.id);
      if (rid) socket.to(rid).emit("whiteboard-clear");
    });

    socket.on("whiteboard-toggle", ({ visible }: { visible: boolean }) => {
      const rid = socketToRoom.get(socket.id);
      if (rid) socket.to(rid).emit("whiteboard-toggle", { visible });
    });

    // ── Media state ──────────────────────────────────────────────────
    socket.on("media-changed", ({ audioEnabled, videoEnabled }: { audioEnabled: boolean; videoEnabled: boolean }) => {
      const rid = socketToRoom.get(socket.id);
      if (!rid) return;
      const room = rooms.get(rid);
      if (room?.participants.has(socket.id)) {
        const p = room.participants.get(socket.id)!;
        p.audioEnabled = audioEnabled;
        p.videoEnabled = videoEnabled;
      }
      socket.to(rid).emit("participant-media-changed", { socketId: socket.id, audioEnabled, videoEnabled });
    });

    // ── Hand raise ───────────────────────────────────────────────────
    socket.on("raise-hand", ({ raised }: { raised: boolean }) => {
      const rid = socketToRoom.get(socket.id);
      if (!rid) return;
      const room = rooms.get(rid);
      if (room?.participants.has(socket.id)) {
        room.participants.get(socket.id)!.handRaised = raised;
      }
      socket.to(rid).emit("hand-raised", { socketId: socket.id, raised });
    });

    // ── Chat ─────────────────────────────────────────────────────────
    socket.on("chat-message", ({ text }: { text: string }) => {
      const rid = socketToRoom.get(socket.id);
      if (!rid) return;
      const room = rooms.get(rid);
      const sender = room?.participants.get(socket.id);
      io.to(rid).emit("chat-message", {
        socketId: socket.id,
        displayName: sender?.displayName ?? "Unknown",
        text,
        timestamp: Date.now(),
      });
    });

    // ── End / leave room ─────────────────────────────────────────────
    socket.on("end-room", () => {
      const rid = socketToRoom.get(socket.id);
      if (!rid) return;
      const room = rooms.get(rid);
      if (room?.hostSocketId === socket.id) {
        io.to(rid).emit("room-ended", { reason: "Host ended the session" });
        cleanupRoom(io, rid);
      }
    });

    socket.on("leave-room", () => handleLeave(socket.id));
    socket.on("disconnect", () => handleLeave(socket.id));
  });

  function handleLeave(socketId: string) {
    const rid = socketToRoom.get(socketId);
    if (!rid) return;
    const room = rooms.get(rid);
    if (!room) return;

    socketToRoom.delete(socketId);
    room.participants.delete(socketId);

    if (room.hostSocketId === socketId) {
      // Host disconnected → end room for everyone
      io.to(rid).emit("room-ended", { reason: "Host disconnected" });
      cleanupRoom(io, rid);
    } else {
      io.to(rid).emit("participant-left", { socketId });
    }
  }
}
