const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Socket.IO server is running!");
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Page not found");
    }
});


const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});


const users = {};
const liveUsers = [];



io.on("connection", (socket) => {

    socket.on("register", ({ userId }) => {
        console.log(`User registered: ${userId}`);
        users[userId] = socket.id;
        if (!liveUsers.includes(userId)) {
            liveUsers.push(userId);
        }
        socket.emit("registered", { userId });
        io.emit("live-users", { liveUsers });
        socket.broadcast.emit("new-live-user", { userId });
    });

    socket.on("call-user", ({ from, to, offer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", { from, offer });
        } else {
            socket.emit("user-not-found", { to });
        }
    });


    socket.on("answer-call", ({ to, answer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-answered", { answer });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
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
        let disconnectedUserId;
        for (const [userId, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                delete users[userId];
                break;
            }
        }

        if (disconnectedUserId) {
            const index = liveUsers.indexOf(disconnectedUserId);
            if (index !== -1) {
                liveUsers.splice(index, 1);
                io.emit("live-users", { liveUsers });
            }
        }
    });
    socket.on("in-call", ({ from, to }) => {
        [from, to].forEach((userId) => {
            const liveIndex = liveUsers.indexOf(userId);
            if (liveIndex !== -1) liveUsers.splice(liveIndex, 1);
        });
        io.emit("live-users", { liveUsers });
    });

    socket.on("call-end", ({ from, to }) => {
        [from, to].forEach((userId) => {
            if (!liveUsers.includes(userId)) {
                liveUsers.push(userId);
            }
        });
        io.emit("live-users", { liveUsers });
    });


});


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
