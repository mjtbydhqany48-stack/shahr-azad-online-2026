const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 20;
const OFFICIAL_ROOMS = new Set([
  "server-1", "server-2", "server-3", "server-4", "server-5"
]);

app.get("/", (_req, res) => {
  res.type("text").send("Shahr Azad 3D multiplayer server is running.");
});

function roomPlayers(room) {
  return [...(io.sockets.adapter.rooms.get(room) || [])]
    .map(id => io.sockets.sockets.get(id))
    .filter(Boolean);
}

function safePlayerState(socket) {
  return socket.data.player || {
    id: socket.id, name: "راننده", skin: "normal",
    x: 0, z: 0, heading: 0, mode: "foot", color: 0x4dba83
  };
}

io.on("connection", socket => {
  socket.on("join-room", payload => {
    const room = String(payload?.room || "");
    if (!OFFICIAL_ROOMS.has(room)) {
      socket.emit("join-error", { message: "این سرور رسمی شناخته نشد." });
      return;
    }
    if (socket.data.room) {
      socket.leave(socket.data.room);
    }

    const current = roomPlayers(room);
    if (current.length >= MAX_PLAYERS) {
      socket.emit("join-error", { message: "این سرور پر است. سرور دیگری را انتخاب کن." });
      return;
    }

    const player = {
      id: socket.id,
      name: String(payload?.name || "راننده").slice(0, 18),
      skin: String(payload?.skin || "normal").slice(0, 32),
      x: 0, z: 0, heading: 0, mode: "foot",
      color: 0x4dba83
    };
    socket.data.room = room;
    socket.data.player = player;
    socket.join(room);

    const others = roomPlayers(room).filter(s => s.id !== socket.id).map(safePlayerState);
    socket.emit("room-state", others);
    socket.emit("joined", { room, count: roomPlayers(room).length });
    socket.to(room).emit("player-joined", player);
    io.to(room).emit("room-count", { room, count: roomPlayers(room).length });
  });

  socket.on("player-update", data => {
    const room = socket.data.room;
    if (!room || !socket.data.player || !data) return;

    const num = v => Number.isFinite(Number(v)) ? Math.max(-100000, Math.min(100000, Number(v))) : 0;
    const mode = ["foot", "car", "bike"].includes(data.mode) ? data.mode : "foot";
    socket.data.player = {
      ...socket.data.player,
      x: num(data.x),
      z: num(data.z),
      heading: num(data.heading),
      mode,
      skin: String(data.skin || socket.data.player.skin).slice(0, 32)
    };
    socket.to(room).emit("player-update", socket.data.player);
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (!room) return;
    socket.to(room).emit("player-left", { id: socket.id });
    io.to(room).emit("room-count", { room, count: roomPlayers(room).length });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Shahr Azad multiplayer server listening on ${PORT}`);
});
