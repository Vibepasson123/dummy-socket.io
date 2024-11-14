const { Server } = require("socket.io");


const io = new Server(3000, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
    },
});

const users = {};


io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);


    socket.on("register", ({ userId }) => {
        console.log(`User registered: ${userId}`);
        users[userId] = socket.id; // Map userId to socket.id
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

console.log("Socket.IO signaling server running on port 3000");
