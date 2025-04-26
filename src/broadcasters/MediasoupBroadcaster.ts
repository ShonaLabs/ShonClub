import * as mediasoup from 'mediasoup';
import { types } from 'mediasoup';
import { User } from '../types/Room';

/**
 * MediasoupBroadcaster handles WebRTC media transport and broadcasting functionality
 * using the mediasoup library. It manages media workers, routers, producers, and consumers
 * for real-time audio communication.
 */
export class MediasoupBroadcaster {
  private worker!: types.Worker;
  private router!: types.Router;
  private producers: Map<string, types.Producer> = new Map();
  private consumers: Map<string, types.Consumer[]> = new Map();
  private transports: Map<string, types.WebRtcTransport> = new Map();

  /**
   * Initializes a new instance of MediasoupBroadcaster
   * and sets up the mediasoup worker and router.
   */
  constructor() {
    this.initializeMediasoup();
  }

  /**
   * Initializes the mediasoup worker and router with audio codec configuration
   * @private
   */
  private async initializeMediasoup() {
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    const mediaCodecs: types.RtpCodecCapability[] = [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {},
      }
    ];

    this.router = await this.worker.createRouter({ mediaCodecs });
  }

  /**
   * Creates a WebRTC transport for a user
   * @param user - The user for whom to create the transport
   * @returns Transport details including ID, ICE parameters, and DTLS parameters
   */
  async createTransport(_user: User) {
    const transport = await this.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    this.transports.set(transport.id, transport);
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * Handles the creation of a media producer for a user
   * @param user - The user producing media
   * @param transportId - The ID of the transport to use
   * @param rtpParameters - RTP parameters for the producer
   * @returns The ID of the created producer
   * @throws Error if transport is not found
   */
  async handleProducer(user: User, transportId: string, rtpParameters: types.RtpParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({
      kind: 'audio',
      rtpParameters,
    });

    this.producers.set(user.fid, producer);
    return producer.id;
  }

  /**
   * Creates a media consumer for receiving audio from a producer
   * @param consumerFid - The FID of the consuming user
   * @param producerFid - The FID of the producing user
   * @returns Consumer details including transport ID, consumer ID, and RTP parameters
   * @throws Error if producer is not found
   */
  async createConsumer(consumerFid: string, producerFid: string) {
    const producer = this.producers.get(producerFid);
    if (!producer) throw new Error('Producer not found');

    const transport = await this.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    this.transports.set(transport.id, transport);

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: this.router.rtpCapabilities,
      paused: false,
    });

    if (!this.consumers.has(consumerFid)) {
      this.consumers.set(consumerFid, []);
    }
    this.consumers.get(consumerFid)?.push(consumer);

    return {
      transportId: transport.id,
      consumerId: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  }

  /**
   * Toggles the mute state of a user's audio producer
   * @param fid - The FID of the user
   * @param muted - Whether to mute or unmute
   * @returns The new mute state
   * @throws Error if producer is not found
   */
  async toggleMute(fid: string, muted: boolean) {
    const producer = this.producers.get(fid);
    if (!producer) throw new Error('Producer not found');

    if (muted) {
      await producer.pause();
    } else {
      await producer.resume();
    }
    return muted;
  }

  /**
   * Closes and cleans up a transport
   * @param transportId - The ID of the transport to close
   */
  async closeTransport(transportId: string) {
    const transport = this.transports.get(transportId);
    if (transport) {
      await transport.close();
      this.transports.delete(transportId);
    }
  }

  /**
   * Stops all broadcasting activity for a user and cleans up resources
   * @param fid - The FID of the user
   */
  async stopBroadcasting(fid: string) {
    const producer = this.producers.get(fid);
    if (producer) {
      await producer.close();
      this.producers.delete(fid);
    }

    const consumers = this.consumers.get(fid);
    if (consumers) {
      consumers.forEach(consumer => consumer.close());
      this.consumers.delete(fid);
    }
  }
}