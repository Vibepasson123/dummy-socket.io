const http = require("http");
const { Server } = require("socket.io");

// Create an HTTP server
const httpServer = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Socket.IO server is running!");
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Page not found");
    }
});

// Create a Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"],
    },
});

// In-memory store for users
const users = {};

// Handle connection
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("register", ({ userId }) => {
        console.log(`User registered: ${userId}`);
        users[userId] = socket.id;
        socket.emit("registered", { userId });
    });

    socket.on("call-user", ({ from, to, offer }) => {
        console.log(`Call from ${from} to ${to}`);
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", { from, offer });
        } else {
            socket.emit("user-not-found", { to });
        }
    });

    socket.on("answer-call", ({ to, answer }) => {
        console.log(`Answer from ${socket.id} to ${to}`);
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-answered", { answer });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        console.log(`ICE candidate from ${socket.id} to ${to}`);
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("ice-candidate", { candidate });
        }
    });

    socket.on("send-message", ({ from, to, message }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("new-message", { from, message });
        } else {
            console.log(`User ${to} not connected.`);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        for (const [userId, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                delete users[userId];
                break;
            }
        }
    });
});

// Start the HTTP server on port 3000
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
