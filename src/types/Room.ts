/**
 * Represents a user in the system
 */
export interface User {
  /** Unique Federation ID for the user */
  fid: string;
  /** Whether the user's audio is muted */
  isMuted?: boolean;
}

/** Role of a user in a room */
export type RoomRole = 'host' | 'speaker' | 'listener';

/** Types of reactions that can be sent in a room */
export type ReactionType = 'like' | 'laugh' | 'clap' | 'fire' | 'heart';

/**
 * Represents a reaction in a room
 */
export interface Reaction {
  /** Type of the reaction */
  type: ReactionType;
  /** FID of the user who sent the reaction */
  fid: string;
  /** Timestamp when the reaction was sent */
  timestamp: number;
}

/**
 * Represents an audio room in the system
 */
export interface Room {
  /** Unique identifier for the room */
  id: string;
  /** FID of the room host */
  hostFid: string;
  /** Set of FIDs of users who can speak */
  speakers: Set<string>;
  /** Set of FIDs of users who are listening */
  listeners: Set<string>;
  /** Set of FIDs of users who have raised their hands */
  raisedHands: Set<string>;
  /** Array of reactions in the room */
  reactions: Reaction[];
  /** Whether the room is currently active */
  active: boolean;
}

/**
 * Represents the current state of a room
 */
export interface RoomState {
  /** Map of user FIDs to their user objects */
  users: Map<string, User>;
  /** Map of user FIDs to their roles in the room */
  roles: Map<string, RoomRole>;
}