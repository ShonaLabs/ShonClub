import { Room, User, ReactionType, Reaction } from '../types/Room';

/**
 * RoomManager handles the creation and management of audio rooms
 * including user roles, reactions, and room state management.
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Creates a new room with the specified host
   * @param host - The user who will be the host of the room
   * @returns The newly created room
   */
  createRoom(host: User): Room {
    const room: Room = {
      id: crypto.randomUUID(),
      hostFid: host.fid,
      speakers: new Set([host.fid]),
      listeners: new Set(),
      raisedHands: new Set(),
      reactions: [],
      active: true
    };

    this.rooms.set(room.id, room);
    return room;
  }

  /**
   * Adds a reaction to a room
   * @param roomId - The ID of the room
   * @param fid - The FID of the user adding the reaction
   * @param type - The type of reaction
   * @returns The created reaction or undefined if room not found
   */
  addReaction(roomId: string, fid: string, type: ReactionType) {
    const room = this.rooms.get(roomId);
    if (room) {
      const reaction: Reaction = {
        type,
        fid,
        timestamp: Date.now()
      };
      room.reactions.push(reaction);
      
      // Only keep last 100 reactions
      if (room.reactions.length > 100) {
        room.reactions.shift();
      }
      return reaction;
    }
  }

  /**
   * Retrieves a room by its ID
   * @param roomId - The ID of the room to retrieve
   * @returns The room if found, undefined otherwise
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Lists all active rooms
   * @returns Array of active rooms
   */
  listRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(room => room.active);
  }

  /**
   * Marks a room as inactive/closed
   * @param roomId - The ID of the room to close
   */
  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.active = false;
    }
  }

  /**
   * Promotes a user to speaker role in a room
   * @param roomId - The ID of the room
   * @param fid - The FID of the user to promote
   */
  addSpeaker(roomId: string, fid: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.speakers.add(fid);
      room.listeners.delete(fid);
      room.raisedHands.delete(fid);
    }
  }

  /**
   * Demotes a speaker to listener role in a room
   * @param roomId - The ID of the room
   * @param fid - The FID of the speaker to demote
   */
  removeSpeaker(roomId: string, fid: string): void {
    const room = this.rooms.get(roomId);
    if (room && fid !== room.hostFid) {
      room.speakers.delete(fid);
      room.listeners.add(fid);
    }
  }

  /**
   * Adds a user to the raised hands list
   * @param roomId - The ID of the room
   * @param fid - The FID of the user raising their hand
   */
  raiseHand(roomId: string, fid: string): void {
    const room = this.rooms.get(roomId);
    if (room && !room.speakers.has(fid)) {
      room.raisedHands.add(fid);
    }
  }

  /**
   * Removes a user from the raised hands list
   * @param roomId - The ID of the room
   * @param fid - The FID of the user lowering their hand
   */
  lowerHand(roomId: string, fid: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.raisedHands.delete(fid);
    }
  }
}