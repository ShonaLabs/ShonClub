# API Documentation for native.center

## REST API

### 1. Get All Rooms
- **Endpoint:** `/api/rooms`
- **Method:** GET
- **Description:** Retrieve a list of all active rooms.
- **Response Example:**
```json
[
  {
    "id": "room-id-1",
    "hostFid": "host-fid",
    "speakers": ["fid1", "fid2"],
    "listeners": ["fid3", "fid4"],
    "raisedHands": ["fid5"],
    "reactions": [
      { "type": "like", "fid": "fid3", "timestamp": 1710000000000 }
    ],
    "active": true
  }
]
```

---

## WebSocket (Socket.IO) API
- **URL:** `wss://native.center`
- **Protocol:** Socket.IO

### Authentication
- **Event:** `authenticate`
- **Payload:**
  - `fid` (string): User Federation ID
- **Response:**
  - `authenticated` event with `{ success: true }`

### Room Management
- **Event:** `create-room`
  - Creates a new room. Host will receive `joined-room` event.
- **Event:** `join-room`
  - **Payload:** `{ roomId: string }`
  - Joins an existing room. Will receive `joined-room` event.
- **Event:** `joined-room`
  - **Payload:** `{ role: 'host' | 'speaker' | 'listener', room: Room }`

### Hand Raise
- **Event:** `raise-hand`
  - Raises hand in the current room.
- **Event:** `lower-hand`
  - Lowers hand in the current room.
- **Event:** `hand-raised` / `hand-lowered`
  - **Payload:** `{ fid: string }`

### Speaker Management (Host Only)
- **Event:** `promote-to-speaker`
  - **Payload:** `targetFid: string`
- **Event:** `demote-speaker`
  - **Payload:** `targetFid: string`
- **Event:** `user-promoted` / `user-demoted`
  - **Payload:** `{ fid: string }`

### Mute/Unmute
- **Event:** `toggle-mute`
  - **Payload:** `muted: boolean`
- **Event:** `user-muted`
  - **Payload:** `{ fid: string, muted: boolean }`

### WebRTC Transport
- **Event:** `connect-transport`
  - Returns `transport-connected` event with transport details.
- **Event:** `start-consuming`
  - **Payload:** `{ producerFid: string }`
  - Returns `consumer-created` event with consumer details.

### Reactions
- **Event:** `send-reaction`
  - **Payload:** `type: 'like' | 'laugh' | 'clap' | 'fire' | 'heart'`
- **Event:** `reaction-received`
  - **Payload:** `{ type: string, fid: string, timestamp: number }`

### Room Events
- **Event:** `room-created`
  - **Payload:** `Room`
- **Event:** `room-closed`
- **Event:** `user-joined` / `user-left`
  - **Payload:** `{ fid: string, role: string }`

---

## Room Object Structure
```json
{
  "id": "string",
  "hostFid": "string",
  "speakers": ["string"],
  "listeners": ["string"],
  "raisedHands": ["string"],
  "reactions": [
    { "type": "string", "fid": "string", "timestamp": 0 }
  ],
  "active": true
}
```

---

## Notes
- All WebSocket events require prior authentication (`authenticate` event).
- For media streaming, additional WebRTC signaling is required (see `connect-transport`, `start-consuming`).
- Error events will be sent as `{ error: { message: string } }`. 