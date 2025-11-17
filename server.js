const http = require("http");
const { Server } = require("socket.io");

// Helper function for formatted logging
const log = (stage, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${stage}] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
};

const httpServer = http.createServer((req, res) => {
    log("HTTP_REQUEST", `Received ${req.method} request for ${req.url}`, {
        method: req.method,
        url: req.url,
        headers: req.headers
    });
    
    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Socket.IO server is running!");
        log("HTTP_RESPONSE", "Sent 200 OK response for root path");
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Page not found");
        log("HTTP_RESPONSE", `Sent 404 Not Found for ${req.url}`);
    }
});

log("SERVER_INIT", "Creating Socket.IO server instance", {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

log("SERVER_INIT", "Socket.IO server instance created successfully");


const users = {};
const liveUsers = [];
const callUsers = [];



io.on("connection", (socket) => {
    log("CONNECTION", "New socket connection established", {
        socketId: socket.id,
        totalConnections: io.sockets.sockets.size
    });

    socket.on("register", ({ userId }) => {
        log("REGISTER", `Registration request received`, {
            userId,
            socketId: socket.id,
            currentUsersCount: Object.keys(users).length
        });
        
        const wasExisting = users.hasOwnProperty(userId);
        users[userId] = socket.id;
        log("REGISTER", `User ${userId} mapped to socket ${socket.id}`, {
            wasExisting,
            users: Object.keys(users),
            liveUsersBefore: [...liveUsers],
            callUsersBefore: [...callUsers]
        });
        
        if (!liveUsers.includes(userId)) {
            liveUsers.push(userId);
            log("REGISTER", `Added ${userId} to liveUsers`, {
                liveUsers: [...liveUsers]
            });
        } else {
            log("REGISTER", `User ${userId} already in liveUsers`, {
                liveUsers: [...liveUsers]
            });
        }
        
        const index = callUsers.findIndex(id => id === userId);
        if (index !== -1) {
            callUsers.splice(index, 1);
            log("REGISTER", `Removed ${userId} from callUsers`, {
                callUsers: [...callUsers]
            });
        } else {
            log("REGISTER", `User ${userId} not in callUsers`, {
                callUsers: [...callUsers]
            });
        }
        
        socket.emit("registered", { userId });
        log("REGISTER", `Sent 'registered' event to ${userId}`);
        
        io.emit("live-users", { liveUsers });
        log("REGISTER", `Broadcasted live-users to all clients`, {
            liveUsers: [...liveUsers]
        });
        
        io.emit("call-users", { callUsers });
        log("REGISTER", `Broadcasted call-users to all clients`, {
            callUsers: [...callUsers]
        });
        
        socket.broadcast.emit("new-live-user", { userId });
        log("REGISTER", `Broadcasted 'new-live-user' event for ${userId} to other clients`);
        
        log("REGISTER", `Registration complete for ${userId}`, {
            finalState: {
                users: Object.keys(users),
                liveUsers: [...liveUsers],
                callUsers: [...callUsers]
            }
        });
    });

    socket.on("call-user", ({ from, to, offer }) => {
        log("CALL_USER", `Call request received`, {
            from,
            to,
            socketId: socket.id,
            hasOffer: !!offer
        });
        
        const targetSocketId = users[to];
        log("CALL_USER", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", { from, offer });
            log("CALL_USER", `Sent 'incoming-call' event to ${to} (${targetSocketId})`, {
                from,
                to
            });
        } else {
            const senderSocketId = users[from];
            log("CALL_USER", `Target user ${to} not found, notifying sender`, {
                from,
                to,
                senderSocketId
            });
            if (senderSocketId) {
                io.to(senderSocketId).emit("user-not-found", { to });
                log("CALL_USER", `Sent 'user-not-found' event to ${from} (${senderSocketId})`);
            } else {
                log("CALL_USER", `ERROR: Sender ${from} also not found in users`, {
                    availableUsers: Object.keys(users)
                });
            }
        }
    });
    socket.on("start-in-call", (userId) => {
        log("START_IN_CALL", `Start in-call request received`, {
            userId,
            socketId: socket.id,
            callUsersBefore: [...callUsers]
        });
        
        if (!callUsers.includes(userId)) {
            callUsers.push(userId);
            log("START_IN_CALL", `Added ${userId} to callUsers`, {
                callUsers: [...callUsers]
            });
        } else {
            log("START_IN_CALL", `User ${userId} already in callUsers`, {
                callUsers: [...callUsers]
            });
        }
        
        io.emit("call-users", { callUsers });
        log("START_IN_CALL", `Broadcasted call-users to all clients`, {
            callUsers: [...callUsers]
        });
    });

    socket.on("remove-in-call", (userId) => {
        log("REMOVE_IN_CALL", `Remove in-call request received`, {
            userId,
            socketId: socket.id,
            callUsersBefore: [...callUsers]
        });
        
        const index = callUsers.indexOf(userId);
        if (index !== -1) {
            callUsers.splice(index, 1);
            log("REMOVE_IN_CALL", `Removed ${userId} from callUsers`, {
                callUsers: [...callUsers]
            });
        } else {
            log("REMOVE_IN_CALL", `User ${userId} not found in callUsers`, {
                callUsers: [...callUsers]
            });
        }
        
        io.emit("call-users", { callUsers });
        log("REMOVE_IN_CALL", `Broadcasted call-users to all clients`, {
            callUsers: [...callUsers]
        });
    });

    socket.on("answer-call", ({ to, answer }) => {
        log("ANSWER_CALL", `Answer call request received`, {
            to,
            socketId: socket.id,
            hasAnswer: !!answer
        });
        
        const targetSocketId = users[to];
        log("ANSWER_CALL", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-answered", { answer });
            log("ANSWER_CALL", `Sent 'call-answered' event to ${to} (${targetSocketId})`);
        } else {
            log("ANSWER_CALL", `ERROR: Target user ${to} not found`, {
                availableUsers: Object.keys(users)
            });
        }
    });

    socket.on("call-accepted", ({ from, to, offer }) => {
        log("CALL_ACCEPTED", `Call accepted event received`, {
            from,
            to,
            socketId: socket.id,
            hasOffer: !!offer
        });
        
        const targetSocketId = users[to];
        log("CALL_ACCEPTED", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-accepted", { from, offer });
            log("CALL_ACCEPTED", `Sent 'call-accepted' event to ${to} (${targetSocketId})`, {
                from
            });
        } else {
            log("CALL_ACCEPTED", `ERROR: Target user ${to} not found`, {
                availableUsers: Object.keys(users)
            });
        }
    });

    socket.on("call-declined", ({ from, to, offer }) => {
        log("CALL_DECLINED", `Call declined event received`, {
            from,
            to,
            socketId: socket.id,
            hasOffer: !!offer
        });
        
        const targetSocketId = users[to];
        log("CALL_DECLINED", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-declined", { from, offer });
            log("CALL_DECLINED", `Sent 'call-declined' event to ${to} (${targetSocketId})`, {
                from
            });
        } else {
            log("CALL_DECLINED", `ERROR: Target user ${to} not found`, {
                availableUsers: Object.keys(users)
            });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        log("ICE_CANDIDATE", `ICE candidate received`, {
            to,
            socketId: socket.id,
            hasCandidate: !!candidate
        });
        
        const targetSocketId = users[to];
        log("ICE_CANDIDATE", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("ice-candidate", { candidate });
            log("ICE_CANDIDATE", `Sent 'ice-candidate' event to ${to} (${targetSocketId})`);
        } else {
            log("ICE_CANDIDATE", `ERROR: Target user ${to} not found`, {
                availableUsers: Object.keys(users)
            });
        }
    });

    socket.on("send-message", ({ from, to, message }) => {
        log("SEND_MESSAGE", `Send message request received`, {
            from,
            to,
            socketId: socket.id,
            messageLength: message ? message.length : 0
        });
        
        const targetSocketId = users[to];
        log("SEND_MESSAGE", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("new-message", { from, message });
            log("SEND_MESSAGE", `Sent 'new-message' event to ${to} (${targetSocketId})`, {
                from
            });
        } else {
            log("SEND_MESSAGE", `ERROR: User ${to} not connected`, {
                availableUsers: Object.keys(users)
            });
        }
    });

    socket.on("disconnect", () => {
        log("DISCONNECT", `Socket disconnection initiated`, {
            socketId: socket.id,
            usersBefore: Object.keys(users),
            liveUsersBefore: [...liveUsers],
            callUsersBefore: [...callUsers],
            totalConnectionsBefore: io.sockets.sockets.size
        });
        
        let disconnectedUserId;
        for (const [userId, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                delete users[userId];
                log("DISCONNECT", `Found and removed user mapping`, {
                    disconnectedUserId,
                    socketId
                });
                break;
            }
        }

        if (!disconnectedUserId) {
            log("DISCONNECT", `WARNING: Socket ${socket.id} not found in users mapping`, {
                availableUsers: Object.keys(users)
            });
        }

        if (disconnectedUserId) {
            const index = liveUsers.indexOf(disconnectedUserId);
            if (index !== -1) {
                liveUsers.splice(index, 1);
                io.emit("live-users", { liveUsers });
                log("DISCONNECT", `Removed ${disconnectedUserId} from liveUsers and broadcasted`, {
                    liveUsers: [...liveUsers]
                });
            } else {
                log("DISCONNECT", `User ${disconnectedUserId} not found in liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            }
            
            const index2 = callUsers.indexOf(disconnectedUserId);
            if (index2 !== -1) {
                callUsers.splice(index2, 1);
                io.emit("call-users", { callUsers });
                log("DISCONNECT", `Removed ${disconnectedUserId} from callUsers and broadcasted`, {
                    callUsers: [...callUsers]
                });
            } else {
                log("DISCONNECT", `User ${disconnectedUserId} not found in callUsers`, {
                    callUsers: [...callUsers]
                });
            }
            
            log("DISCONNECT", `Disconnection complete for ${disconnectedUserId}`, {
                finalState: {
                    users: Object.keys(users),
                    liveUsers: [...liveUsers],
                    callUsers: [...callUsers],
                    totalConnections: io.sockets.sockets.size
                }
            });
        } else {
            log("DISCONNECT", `Disconnection complete for socket ${socket.id} (no user mapping found)`, {
                finalState: {
                    users: Object.keys(users),
                    liveUsers: [...liveUsers],
                    callUsers: [...callUsers],
                    totalConnections: io.sockets.sockets.size
                }
            });
        }
    });
    socket.on("in-call", ({ from, to }) => {
        log("IN_CALL", `In-call event received`, {
            from,
            to,
            socketId: socket.id,
            liveUsersBefore: [...liveUsers]
        });
        
        [from, to].forEach((userId) => {
            const liveIndex = liveUsers.indexOf(userId);
            if (liveIndex !== -1) {
                liveUsers.splice(liveIndex, 1);
                log("IN_CALL", `Removed ${userId} from liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            } else {
                log("IN_CALL", `User ${userId} not found in liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            }
        });
        
        io.emit("live-users", { liveUsers });
        log("IN_CALL", `Broadcasted live-users to all clients`, {
            liveUsers: [...liveUsers]
        });
    });

    socket.on("call-end", ({ from, to }) => {
        log("CALL_END", `Call end event received`, {
            from,
            to,
            socketId: socket.id,
            liveUsersBefore: [...liveUsers],
            callUsersBefore: [...callUsers]
        });
        
        io.emit("call-users", { callUsers });
        log("CALL_END", `Broadcasted call-users to all clients`, {
            callUsers: [...callUsers]
        });
        
        [from, to].forEach((userId) => {
            if (!liveUsers.includes(userId)) {
                liveUsers.push(userId);
                log("CALL_END", `Added ${userId} back to liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            } else {
                log("CALL_END", `User ${userId} already in liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            }
        });
        
        io.emit("live-users", { liveUsers });
        log("CALL_END", `Broadcasted live-users to all clients`, {
            liveUsers: [...liveUsers]
        });
        
        log("CALL_END", `Call end complete`, {
            finalState: {
                liveUsers: [...liveUsers],
                callUsers: [...callUsers]
            }
        });
    });

    socket.on("disconnect-call", ({ from, to, name, complain, block }) => {
        log("DISCONNECT_CALL", `Disconnect call event received`, {
            from,
            to,
            name,
            complain,
            block,
            socketId: socket.id,
            liveUsersBefore: [...liveUsers],
            callUsersBefore: [...callUsers]
        });
        
        const targetSocketId = users[to];
        log("DISCONNECT_CALL", `Looking up target user ${to}`, {
            targetSocketId,
            availableUsers: Object.keys(users)
        });
        
        log("DISCONNECT_CALL", `Current users in call`, {
            callUsers: [...callUsers]
        });
        
        [from, to].forEach((userId) => {
            if (!liveUsers.includes(userId)) {
                liveUsers.push(userId);
                log("DISCONNECT_CALL", `Added ${userId} back to liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            } else {
                log("DISCONNECT_CALL", `User ${userId} already in liveUsers`, {
                    liveUsers: [...liveUsers]
                });
            }
        });
        
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-disconnect", { from, to, name, complain, block });
            log("DISCONNECT_CALL", `Sent 'call-disconnect' event to ${to} (${targetSocketId})`, {
                from,
                name,
                complain,
                block
            });
        } else {
            log("DISCONNECT_CALL", `ERROR: Target user ${to} not found`, {
                availableUsers: Object.keys(users)
            });
        }
        
        io.emit("live-users", { liveUsers });
        log("DISCONNECT_CALL", `Broadcasted live-users to all clients`, {
            liveUsers: [...liveUsers]
        });
        
        log("DISCONNECT_CALL", `Disconnect call complete`, {
            finalState: {
                liveUsers: [...liveUsers],
                callUsers: [...callUsers]
            }
        });
    });

});


const PORT = process.env.PORT || 3000;
log("SERVER_START", `Starting HTTP server on port ${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development'
});

httpServer.listen(PORT, () => {
    log("SERVER_START", `Server successfully started and listening`, {
        port: PORT,
        url: `http://localhost:${PORT}`,
        timestamp: new Date().toISOString()
    });
});

// Log server errors
httpServer.on('error', (error) => {
    log("SERVER_ERROR", `HTTP server error occurred`, {
        error: error.message,
        code: error.code,
        stack: error.stack
    });
});

// Log when server is closing
process.on('SIGTERM', () => {
    log("SERVER_SHUTDOWN", "SIGTERM received, shutting down gracefully");
    httpServer.close(() => {
        log("SERVER_SHUTDOWN", "HTTP server closed");
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log("SERVER_SHUTDOWN", "SIGINT received, shutting down gracefully");
    httpServer.close(() => {
        log("SERVER_SHUTDOWN", "HTTP server closed");
        process.exit(0);
    });
});
