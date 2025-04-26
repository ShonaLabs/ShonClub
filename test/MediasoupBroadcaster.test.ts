import { MediasoupBroadcaster } from '../src/broadcasters/MediasoupBroadcaster';
import { User } from '../src/types/Room';
import { describe, test, expect, beforeEach } from 'bun:test';

// Mock mediasoup
import { mock } from 'bun:test';

// Create the mock before importing the module that uses it
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

describe('MediasoupBroadcaster', () => {
  let broadcaster: MediasoupBroadcaster;
  let testUser: User;

  beforeEach(() => {
    broadcaster = new MediasoupBroadcaster();
    testUser = { fid: 'test-user-1' };
  });

  test('should create transport', async () => {
    const transport = await broadcaster.createTransport(testUser);

    expect(transport).toHaveProperty('id', 'test-transport-id');
    expect(transport).toHaveProperty('iceParameters');
    expect(transport).toHaveProperty('iceCandidates');
    expect(transport).toHaveProperty('dtlsParameters');
  });

  test('should handle producer creation', async () => {
    const transport = await broadcaster.createTransport(testUser);

    const rtpParameters = {
      codecs: [{
        payloadType: 111,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {}
      }],
      headerExtensions: [],
      encodings: [{ ssrc: 1234 }],
      rtcp: { cname: 'test' }
    };

    const producerId = await broadcaster.handleProducer(
      testUser,
      transport.id,
      rtpParameters
    );

    expect(producerId).toBe('test-producer-id');
  });

  test('should handle consumer creation', async () => {
    // Setup producer first
    const producerTransport = await broadcaster.createTransport(testUser);
    const rtpParameters = {
      codecs: [{
        payloadType: 111,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {}
      }],
      headerExtensions: [],
      encodings: [{ ssrc: 1234 }],
      rtcp: { cname: 'test' }
    };

    await broadcaster.handleProducer(testUser, producerTransport.id, rtpParameters);

    // Test consumer creation
    const consumerUser: User = { fid: 'test-consumer' };
    const consumer = await broadcaster.createConsumer(consumerUser.fid, testUser.fid);

    expect(consumer).toHaveProperty('transportId');
    expect(consumer).toHaveProperty('consumerId', 'test-consumer-id');
    expect(consumer).toHaveProperty('rtpParameters');
  });

  test('should handle mute/unmute', async () => {
    const transport = await broadcaster.createTransport(testUser);
    const rtpParameters = {
      codecs: [{
        payloadType: 111,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {}
      }],
      headerExtensions: [],
      encodings: [{ ssrc: 1234 }],
      rtcp: { cname: 'test' }
    };

    await broadcaster.handleProducer(testUser, transport.id, rtpParameters);

    const muted = await broadcaster.toggleMute(testUser.fid, true);
    expect(muted).toBe(true);

    const unmuted = await broadcaster.toggleMute(testUser.fid, false);
    expect(unmuted).toBe(false);
  });

  test('should clean up resources on stop', async () => {
    const transport = await broadcaster.createTransport(testUser);
    const rtpParameters = {
      codecs: [{
        payloadType: 111,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {}
      }],
      headerExtensions: [],
      encodings: [{ ssrc: 1234 }],
      rtcp: { cname: 'test' }
    };

    await broadcaster.handleProducer(testUser, transport.id, rtpParameters);
    await broadcaster.stopBroadcasting(testUser.fid);

    // Trying to mute after stopping should throw an error
    await expect(broadcaster.toggleMute(testUser.fid, true))
      .rejects
      .toThrow('Producer not found');
  });
});