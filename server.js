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
const callUsers = [];



io.on("connection", (socket) => {

    socket.on("register", ({ userId }) => {
        console.log(`User registered: ${userId}`);
        users[userId] = socket.id;
        if (!liveUsers.includes(userId)) {
            liveUsers.push(userId);
        }
        const index = callUsers.findIndex(id => id === userId);
        if (index !== -1) {
            callUsers.splice(index, 1);
        }
        socket.emit("registered", { userId });
        io.emit("live-users", { liveUsers });
        io.emit("call-users", { callUsers });
        socket.broadcast.emit("new-live-user", { userId });
        console.log(callUsers);
    });

    socket.on("call-user", ({ from, to, offer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", { from, offer });
        } else {
            const targetSocketId = users[from];
            io.to(targetSocketId).emit("user-not-found", { to });
        }
    });
    socket.on("start-in-call", (userId) => {
        if (!callUsers.includes(userId)) callUsers.push(userId);
        io.emit("call-users", { callUsers });
    });

    socket.on("remove-in-call", (userId) => {
        const index = callUsers.indexOf(userId);
        if (index !== -1) {
            callUsers.splice(index, 1);
        }
        io.emit("call-users", { callUsers });
    });

    socket.on("answer-call", ({ to, answer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-answered", { answer });
        }
    });

    socket.on("call-accepted", ({ from, to, offer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-accepted", { from, offer });
        }
    });

    socket.on("call-declined", ({ from, to, offer }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-declined", { from, offer });
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
        let disconnectedUserId;
        for (const [userId, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                delete users[userId];
                break;
            }
            console.log("User disconnected:", userId);
        }

        if (disconnectedUserId) {
            const index = liveUsers.indexOf(disconnectedUserId);
            if (index !== -1) {
                liveUsers.splice(index, 1);
                io.emit("live-users", { liveUsers });
            }
            const index2 = callUsers.indexOf(disconnectedUserId);
            if (index2 !== -1) {
                callUsers.splice(index2, 1);
                io.emit("call-users", { callUsers });
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
        io.emit("call-users", { callUsers });
        [from, to].forEach((userId) => {
            if (!liveUsers.includes(userId)) {
                liveUsers.push(userId);
            }
        });
        io.emit("live-users", { liveUsers });
    });

    socket.on("disconnect-call", ({ from, to, name, complain, block }) => {
        const targetSocketId = users[to];
        console.log("Users in call after disconnect-call:", callUsers);
        [from, to].forEach((userId) => {
            if (!liveUsers.includes(userId)) {
                liveUsers.push(userId);
            }
        });
        io.to(targetSocketId).emit("call-disconnect", { from, to, name, complain, block });
        io.emit("live-users", { liveUsers });
    });

});


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
