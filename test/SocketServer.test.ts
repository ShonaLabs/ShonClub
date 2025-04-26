import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { createServer } from 'http';
import { SocketServer } from '../src/server/SocketServer';
import { ReactionType } from '../src/types/Room';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { mock } from 'bun:test';

// Mock mediasoup
mock.module('mediasoup', () => {
  const mockRouter = {
    rtpCapabilities: {},
    createWebRtcTransport: async ({ listenIps }) => ({
      id: 'test-transport-id',
      iceParameters: { usernameFragment: 'test', password: 'test' },
      iceCandidates: [{ foundation: '1', port: 1234 }],
      dtlsParameters: { fingerprints: [{ algorithm: 'sha-256', value: 'test' }] },
      produce: async ({ kind, rtpParameters }) => ({
        id: 'test-producer-id',
        kind,
        rtpParameters,
        pause: async () => undefined,
        resume: async () => undefined,
        close: () => {}
      }),
      consume: async ({ producerId, rtpCapabilities }) => ({
        id: 'test-consumer-id',
        kind: 'audio',
        rtpParameters: {
          codecs: [{
            payloadType: 111,
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {}
          }]
        },
        type: 'simple',
        producerPaused: false,
        close: () => {}
      }),
      close: () => {}
    }),
    close: () => {}
  };

  const mockWorker = {
    createRouter: async ({ mediaCodecs }) => mockRouter,
    close: () => {}
  };

  return {
    createWorker: async () => mockWorker,
    types: {
      RouterOptions: {},
      WebRtcTransportOptions: {},
      TransportListenIp: {},
      RtpCodecParameters: {},
      RtpParameters: {}
    }
  };
});

describe('SocketServer', () => {
  let httpServer: any;
  let socketServer: SocketServer;
  let io: Server;
  let clientSocket: any;
  let port: number;

  beforeAll((done: () => void) => {
    httpServer = createServer();
    io = new Server(httpServer);
    socketServer = new SocketServer(io);
    port = 3001;
    httpServer.listen(port, done);
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach((done: () => void) => {
    clientSocket = Client(`http://localhost:${port}`);
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    clientSocket.close();
  });

  test('should authenticate user', () => {
    return new Promise<void>((done) => {
      const testFid = 'test-fid';

      clientSocket.emit('authenticate', testFid);

      clientSocket.on('authenticated', (response: any) => {
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  test('should create and join room', () => {
    return new Promise<void>((done) => {
      const testFid = 'test-fid';

      clientSocket.emit('authenticate', testFid);
      clientSocket.emit('create-room');

      clientSocket.on('joined-room', (data: any) => {
        expect(data.role).toBe('host');
        expect(data.room.hostFid).toBe(testFid);
        expect(data.room.speakers).toContain(testFid);
        done();
      });
    });
  });

  test('should handle hand raising', () => {
    return new Promise<void>((done) => {
      const testFid = 'test-fid';

      clientSocket.emit('authenticate', testFid);
      clientSocket.emit('create-room');

      let roomId: string;

      clientSocket.on('joined-room', (data: any) => {
        roomId = data.room.id;

        // Create a second client to test hand raising
        const listener = Client(`http://localhost:${port}`);
        listener.emit('authenticate', 'listener-fid');
        listener.emit('join-room', roomId);

        listener.on('joined-room', () => {
          listener.emit('raise-hand');
        });

        clientSocket.on('hand-raised', (data: any) => {
          expect(data.fid).toBe('listener-fid');
          listener.close();
          done();
        });
      });
    });
  });

  test('should handle reactions', () => {
    return new Promise<void>((done) => {
      const testFid = 'test-fid';
      const testReaction: ReactionType = 'like';

      clientSocket.emit('authenticate', testFid);
      clientSocket.emit('create-room');

      clientSocket.on('joined-room', () => {
        clientSocket.emit('send-reaction', testReaction);
      });

      clientSocket.on('reaction-received', (reaction: any) => {
        expect(reaction.type).toBe(testReaction);
        expect(reaction.fid).toBe(testFid);
        done();
      });
    });
  });

  test('should handle speaker promotion and demotion', () => {
    return new Promise<void>((done) => {
      const hostFid = 'host-fid';
      const listenerFid = 'listener-fid';

      clientSocket.emit('authenticate', hostFid);
      clientSocket.emit('create-room');

      let roomId: string;

      clientSocket.on('joined-room', (data: any) => {
        roomId = data.room.id;

        const listener = Client(`http://localhost:${port}`);
        listener.emit('authenticate', listenerFid);
        listener.emit('join-room', roomId);

        listener.on('joined-room', () => {
          clientSocket.emit('promote-to-speaker', listenerFid);
        });

        clientSocket.on('user-promoted', (data: any) => {
          expect(data.fid).toBe(listenerFid);

          // Test demotion
          clientSocket.emit('demote-speaker', listenerFid);

          clientSocket.on('user-demoted', (demotion: any) => {
            expect(demotion.fid).toBe(listenerFid);
            listener.close();
            done();
          });
        });
      });
    });
  });
});