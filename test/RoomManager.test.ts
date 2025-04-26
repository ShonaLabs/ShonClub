import { RoomManager } from '../src/server/RoomManager';
import { User, ReactionType } from '../src/types/Room';

describe('RoomManager', () => {
  let roomManager: RoomManager;
  let testUser: User;

  beforeEach(() => {
    roomManager = new RoomManager();
    testUser = { fid: 'test-user-1' };
  });

  describe('createRoom', () => {
    it('should create a new room with the host as speaker', () => {
      const room = roomManager.createRoom(testUser);

      expect(room.hostFid).toBe(testUser.fid);
      expect(room.speakers.has(testUser.fid)).toBe(true);
      expect(room.listeners.size).toBe(0);
      expect(room.active).toBe(true);
    });
  });

  describe('room management', () => {
    it('should list only active rooms', () => {
      const room1 = roomManager.createRoom(testUser);
      const user2: User = { fid: 'test-user-2' };
      const room2 = roomManager.createRoom(user2);

      roomManager.closeRoom(room1.id);
      const activeRooms = roomManager.listRooms();

      expect(activeRooms.length).toBe(1);
      expect(activeRooms[0].id).toBe(room2.id);
    });

    it('should handle speaker promotion and demotion', () => {
      const room = roomManager.createRoom(testUser);
      const listener: User = { fid: 'test-listener' };

      roomManager.addSpeaker(room.id, listener.fid);
      expect(room.speakers.has(listener.fid)).toBe(true);
      expect(room.listeners.has(listener.fid)).toBe(false);

      roomManager.removeSpeaker(room.id, listener.fid);
      expect(room.speakers.has(listener.fid)).toBe(false);
      expect(room.listeners.has(listener.fid)).toBe(true);
    });

    it('should not demote the host', () => {
      const room = roomManager.createRoom(testUser);
      roomManager.removeSpeaker(room.id, testUser.fid);
      expect(room.speakers.has(testUser.fid)).toBe(true);
    });
  });

  describe('hand raising', () => {
    it('should handle hand raising and lowering', () => {
      const room = roomManager.createRoom(testUser);
      const listener: User = { fid: 'test-listener' };

      roomManager.raiseHand(room.id, listener.fid);
      expect(room.raisedHands.has(listener.fid)).toBe(true);

      roomManager.lowerHand(room.id, listener.fid);
      expect(room.raisedHands.has(listener.fid)).toBe(false);
    });

    it('should not allow speakers to raise hands', () => {
      const room = roomManager.createRoom(testUser);
      roomManager.raiseHand(room.id, testUser.fid);
      expect(room.raisedHands.has(testUser.fid)).toBe(false);
    });
  });

  describe('reactions', () => {
    it('should add and limit reactions', () => {
      const room = roomManager.createRoom(testUser);
      
      // Add more than 100 reactions
      for (let i = 0; i < 110; i++) {
        roomManager.addReaction(room.id, testUser.fid, 'like' as ReactionType);
      }

      expect(room.reactions.length).toBeLessThanOrEqual(100);
      expect(room.reactions[room.reactions.length - 1].type).toBe('like');
      expect(room.reactions[room.reactions.length - 1].fid).toBe(testUser.fid);
    });
  });
});