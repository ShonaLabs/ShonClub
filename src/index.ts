/**
 * Main entry point for the FarClub application
 * Sets up Express server, Socket.IO, and WebSocket handlers
 * for real-time audio communication
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketServer } from './server/SocketServer';

// Initialize Express application
const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS settings
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Configure this appropriately for production
    methods: ["GET", "POST"]
  }
});

// Initialize the WebSocket server
const socketServer = new SocketServer(io);

/**
 * REST API endpoint to list all active rooms
 * @route GET /api/rooms
 * @returns {Object[]} Array of active rooms
 */
app.get('/api/rooms', (_req, res) => {
  const rooms = socketServer.listRooms();
  res.json(rooms);
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});