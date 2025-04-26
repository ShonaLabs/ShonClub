import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { MediasoupBroadcaster } from '../broadcasters/MediasoupBroadcaster';
import { User, Room, ReactionType } from '../types/Room';

interface SerializedRoom {
  id: string;
  name: string;
  tags: string[];
  hostFid: string;
  speakers: string[];
  listeners: string[];
  raisedHands: string[];
  reactions: Array<{ type: string; fid: string; timestamp: number }>;
  active: boolean;
}

/**
 * SocketServer manages WebSocket connections and real-time communication
 * including room management, user authentication, and broadcasting.
 */
export class SocketServer {
  private io: Server;
  private roomManager: RoomManager;
  private broadcaster: MediasoupBroadcaster;

  /**
   * Creates a new instance of SocketServer
   * @param io - The Socket.IO server instance
   */
  constructor(io: Server) {
    this.io = io;
    this.roomManager = new RoomManager();
    this.broadcaster = new MediasoupBroadcaster();
    this.setupSocketHandlers();
  }

  /**
   * Serializes a Room object into a format suitable for transmission
   * @private
   * @param room - The room to serialize
   * @returns Serialized room data
   */
  private serializeRoom(room: Room): SerializedRoom {
    return {
      id: room.id,
      name: room.name,
      tags: room.tags,
      hostFid: room.hostFid,
      speakers: Array.from(room.speakers),
      listeners: Array.from(room.listeners),
      raisedHands: Array.from(room.raisedHands),
      reactions: room.reactions,
      active: room.active
    };
  }

  /**
   * Sets up all WebSocket event handlers for the server
   * Handles authentication, room creation/joining, and user interactions
   * @private
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      let currentUser: User;
      let currentRoom: Room | undefined;

      /**
       * Handles user authentication
       * @event authenticate
       * @param fid - The user's FID (Federation ID)
       */
      socket.on('authenticate', async (fid: string) => {
        currentUser = { fid };
        socket.emit('authenticated', { success: true });
      });

      /**
       * Handles room creation
       * @event create-room
       * @param payload - Object containing room details
       * @param payload.name - The name for the new room
       * @param payload.tags - Array of tags for the room
       */
      socket.on('create-room', ({ name, tags = [] }: { name: string; tags?: string[] }) => {
        if (!currentUser) return;
        if (!name || typeof name !== 'string') {
          socket.emit('error', { message: 'Room name is required' });
          return;
        }

        const room = this.roomManager.createRoom(currentUser, name, tags);
        socket.join(room.id);
        currentRoom = room;

        this.io.emit('room-created', this.serializeRoom(room));
        socket.emit('joined-room', {
          role: 'host',
          room: this.serializeRoom(room)
        });
      });

      /**
       * Handles joining an existing room
       * @event join-room
       * @param roomId - The ID of the room to join
       */
      socket.on('join-room', (roomId: string) => {
        if (!currentUser) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room || !room.active) {
          socket.emit('error', { message: 'Room not found or inactive' });
          return;
        }

        socket.join(roomId);
        currentRoom = room;

        const role = room.speakers.has(currentUser.fid) ? 'speaker' : 'listener';
        room.listeners.add(currentUser.fid);

        socket.emit('joined-room', {
          role,
          room: this.serializeRoom(room)
        });
        this.io.to(roomId).emit('user-joined', { fid: currentUser.fid, role });
      });

      /**
       * Handles hand raising requests
       * @event raise-hand
       */
      socket.on('raise-hand', () => {
        if (!currentUser || !currentRoom) return;

        this.roomManager.raiseHand(currentRoom.id, currentUser.fid);
        this.io.to(currentRoom.id).emit('hand-raised', { fid: currentUser.fid });
      });

      /**
       * Handles hand lowering requests
       * @event lower-hand
       */
      socket.on('lower-hand', () => {
        if (!currentUser || !currentRoom) return;

        this.roomManager.lowerHand(currentRoom.id, currentUser.fid);
        this.io.to(currentRoom.id).emit('hand-lowered', { fid: currentUser.fid });
      });

      /**
       * Handles promoting a user to speaker
       * @event promote-to-speaker
       * @param targetFid - The FID of the user to promote
       */
      socket.on('promote-to-speaker', (targetFid: string) => {
        if (!currentUser || !currentRoom) return;

        if (currentRoom.hostFid !== currentUser.fid) {
          socket.emit('error', { message: 'Only host can promote speakers' });
          return;
        }

        this.roomManager.addSpeaker(currentRoom.id, targetFid);
        this.io.to(currentRoom.id).emit('user-promoted', { fid: targetFid });
      });

      /**
       * Handles demoting a speaker to listener
       * @event demote-speaker
       * @param targetFid - The FID of the speaker to demote
       */
      socket.on('demote-speaker', (targetFid: string) => {
        if (!currentUser || !currentRoom) return;

        if (currentRoom.hostFid !== currentUser.fid) {
          socket.emit('error', { message: 'Only host can demote speakers' });
          return;
        }

        this.roomManager.removeSpeaker(currentRoom.id, targetFid);
        this.io.to(currentRoom.id).emit('user-demoted', { fid: targetFid });
      });

      /**
       * Handles mute/unmute requests
       * @event toggle-mute
       * @param muted - The desired mute state
       */
      socket.on('toggle-mute', async (muted: boolean) => {
        if (!currentUser || !currentRoom) return;

        if (!currentRoom.speakers.has(currentUser.fid)) {
          socket.emit('error', { message: 'Only speakers can toggle mute' });
          return;
        }

        try {
          const isMuted = await this.broadcaster.toggleMute(currentUser.fid, muted);
          this.io.to(currentRoom.id).emit('user-muted', { fid: currentUser.fid, muted: isMuted });
        } catch (error) {
          socket.emit('error', { message: 'Failed to toggle mute' });
        }
      });

      /**
       * Handles WebRTC transport connection
       * @event connect-transport
       * @param transportId - The ID of the transport to connect
       */
      socket.on('connect-transport', async () => {
        try {
          const transport = await this.broadcaster.createTransport(currentUser);
          socket.emit('transport-connected', transport);
        } catch (error) {
          socket.emit('error', { message: 'Failed to connect transport' });
        }
      });

      /**
       * Handles consumer creation for media streams
       * @event start-consuming
       * @param producerFid - The FID of the user producing the media
       */
      socket.on('start-consuming', async ({ producerFid }) => {
        if (!currentUser || !currentRoom) return;

        try {
          const consumerData = await this.broadcaster.createConsumer(currentUser.fid, producerFid);
          socket.emit('consumer-created', consumerData);
        } catch (error) {
          socket.emit('error', { message: 'Failed to create consumer' });
        }
      });

      /**
       * Handles user reactions in a room
       * @event send-reaction
       * @param type - The type of reaction
       */
      socket.on('send-reaction', (type: string) => {
        if (!currentUser || !currentRoom) return;

        // Validate that the type is a valid ReactionType
        const validReactionTypes: ReactionType[] = ['like', 'laugh', 'clap', 'fire', 'heart'];
        if (!validReactionTypes.includes(type as ReactionType)) {
          socket.emit('error', { message: 'Invalid reaction type' });
          return;
        }

        const reaction = this.roomManager.addReaction(currentRoom.id, currentUser.fid, type as ReactionType);
        if (reaction) {
          this.io.to(currentRoom.id).emit('reaction-received', reaction);
        }
      });

      /**
       * Handles user disconnection
       * @event disconnect
       */
      socket.on('disconnect', async () => {
        if (currentRoom?.hostFid === currentUser?.fid) {
          this.roomManager.closeRoom(currentRoom.id);
          this.io.to(currentRoom.id).emit('room-closed');
        }

        if (currentUser && currentRoom) {
          await this.broadcaster.stopBroadcasting(currentUser.fid);
          this.io.to(currentRoom.id).emit('user-left', { fid: currentUser.fid });
        }
      });
    });
  }

  /**
   * Lists all active rooms in serialized format
   * @returns Array of serialized room data
   */
  public listRooms(): SerializedRoom[] {
    return this.roomManager.listRooms().map(room => this.serializeRoom(room));
  }
}