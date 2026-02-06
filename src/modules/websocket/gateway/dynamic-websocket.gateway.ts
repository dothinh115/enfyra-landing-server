import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebsocketCacheService } from '../../../infrastructure/cache/services/websocket-cache.service';
import { RedisPubSubService } from '../../../infrastructure/cache/services/redis-pubsub.service';
import { WEBSOCKET_CACHE_SYNC_EVENT_KEY } from '../../../shared/utils/constant';
interface SocketData extends Socket {
  data: {
    user?: { id: number | string };
    userId?: number | string;
    gateway?: any;
  };
}
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
})
export class DynamicWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(DynamicWebSocketGateway.name);
  private registeredGateways = new Set<string>();
  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('ws-connection')
    private readonly connectionQueue: Queue,
    @InjectQueue('ws-event')
    private readonly eventQueue: Queue,
    private readonly websocketCache: WebsocketCacheService,
    private readonly redisPubSubService: RedisPubSubService,
  ) {
    this.jwtService = new JwtService({
      secret: this.configService.get('SECRET_KEY'),
    });
  }
  private readonly jwtService: JwtService;
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.subscribeToCacheSync();
  }
  async onApplicationBootstrap() {
    this.logger.log('WebSocket Gateway onApplicationBootstrap, waiting for cache to load...');
    setTimeout(async () => {
      await this.registerGateways();
    }, 1000);
  }
  private subscribeToCacheSync() {
    this.redisPubSubService.subscribeWithHandler(
      WEBSOCKET_CACHE_SYNC_EVENT_KEY,
      async (channel: string, message: string) => {
        if (channel === WEBSOCKET_CACHE_SYNC_EVENT_KEY) {
          try {
            const payload = JSON.parse(message);
            this.logger.log(`Received websocket cache sync with ${payload.gateways?.length || 0} gateways`);
            const oldPaths = new Set(this.registeredGateways);
            for (const path of oldPaths) {
              const namespace = this.server.of(path);
              namespace.disconnectSockets();
              namespace.removeAllListeners();
            }
            this.registeredGateways.clear();
            const gateways = payload.gateways || [];
            for (const gateway of gateways) {
              this.setupNamespace(gateway);
              this.registeredGateways.add(gateway.path);
            }
            this.logger.log(`Reloaded gateways from cache sync: ${this.registeredGateways.size} gateways registered`);
          } catch (error) {
            this.logger.error('Failed to process websocket cache sync:', error);
          }
        }
      }
    );
  }
  async registerGateways() {
    try {
      const gateways = await this.websocketCache.getGateways();
      for (const gateway of gateways) {
        if (this.registeredGateways.has(gateway.path)) {
          continue;
        }
        this.setupNamespace(gateway);
        this.registeredGateways.add(gateway.path);
      }
      this.logger.log(`Registered ${gateways.length} websocket gateways`);
    } catch (error) {
      this.logger.error('Failed to register websocket gateways:', error);
    }
  }
  private setupNamespace(gateway: any) {
    const namespace = this.server.of(gateway.path);
    namespace.use(async (socket: SocketData, next) => {
      if (gateway.requireAuth) {
        const { token } = socket.handshake.auth;
        if (!token) {
          this.logger.warn(`Connection rejected: no token provided for ${gateway.path}`);
          return next(new Error('Authentication token required'));
        }
        try {
          const user = this.jwtService.verify(token);
          socket.data.user = user;
          socket.data.userId = user.id || user.userId;
          socket.data.gateway = gateway;
          next();
        } catch (error) {
          this.logger.warn(`Connection rejected: invalid token for ${gateway.path}`);
          return next(new Error('Invalid authentication token'));
        }
      } else {
        socket.data.gateway = gateway;
        next();
      }
    });
    namespace.on('connection', async (socket: SocketData) => {
      const gatewayData = socket.data.gateway;
      const userId = socket.data.userId || socket.id;
      this.logger.debug(`Client connected to ${gatewayData.path}: ${socket.id} (user: ${userId})`);
      if (gatewayData.connectionHandlerScript) {
        try {
          await this.connectionQueue.add(
            `${gatewayData.path}:${socket.id}`,
            {
              socketId: socket.id,
              userId: socket.data.userId || null,
              clientInfo: {
                id: socket.id,
                ip: socket.handshake.address,
                headers: socket.handshake.headers,
              },
              gatewayId: gatewayData.id,
              gatewayPath: gatewayData.path,
              script: gatewayData.connectionHandlerScript,
              timeout: gatewayData.connectionHandlerTimeout,
            },
            {
              attempts: 0,
              removeOnComplete: {
                count: 100,
                age: 3600,
              },
              removeOnFail: {
                count: 500,
                age: 24 * 3600,
              },
            },
          );
        } catch (error) {
          this.logger.error(`Connection handler failed for ${socket.id}:`, error);
          socket.disconnect();
          return;
        }
      }
      const roomName = socket.data.userId ? `user_${socket.data.userId}` : `user_${socket.id}`;
      socket.join(roomName);
      this.logger.debug(`Socket ${socket.id} joined room ${roomName}`);
      for (const event of gatewayData.events) {
        socket.on(event.eventName, async (payload) => {
          this.logger.debug(`Event ${event.eventName} received from ${socket.id} on ${gatewayData.path}`);
          try {
            await this.eventQueue.add(
              `ws-event-${gatewayData.id}-${event.eventName}`,
              {
                socketId: socket.id,
                userId: socket.data.userId || null,
                eventName: event.eventName,
                payload,
                gatewayId: gatewayData.id,
                gatewayPath: gatewayData.path,
                eventId: event.id,
                script: event.handlerScript,
                timeout: event.timeout,
              },
              {
                attempts: 0,
                removeOnComplete: {
                  count: 100,
                  age: 3600,
                },
                removeOnFail: {
                  count: 500,
                  age: 24 * 3600,
                },
              },
            );
          } catch (error) {
            this.logger.error(`Event handler failed for ${event.eventName}:`, error);
            socket.emit('error', { event: event.eventName, message: error.message });
          }
        });
      }
      socket.on('disconnect', () => {
        this.logger.debug(`Client disconnected from ${gatewayData.path}: ${socket.id}`);
      });
    });
  }
  async handleConnection(client: Socket) {
  }
  async handleDisconnect(client: Socket) {
  }
  async reloadGateways() {
    this.logger.log('Reloading websocket gateways...');
    for (const path of this.registeredGateways) {
      const namespace = this.server.of(path);
      namespace.disconnectSockets();
      namespace.removeAllListeners();
    }
    this.registeredGateways.clear();
    await this.registerGateways();
    this.logger.log(`Gateways reloaded. Total registered: ${this.registeredGateways.size}`);
  }
  emitToUser(userId: number | string, event: string, data: any) {
    this.logger.debug(`Emitting to user_${userId}: ${event} ${JSON.stringify(data)}`);
    this.server.to(`user_${userId}`).emit(event, data);
  }
  emitToRoom(room: string, event: string, data: any) {
    this.logger.debug(`Emitting to room ${room}: ${event} ${JSON.stringify(data)}`);
    this.server.to(room).emit(event, data);
  }
  emitToNamespace(path: string, event: string, data: any) {
    this.logger.debug(`Emitting to namespace ${path}: ${event} ${JSON.stringify(data)}`);
    this.server.of(path).emit(event, data);
  }
  emitToAll(event: string, data: any) {
    this.logger.debug(`Emitting to all: ${event} ${JSON.stringify(data)}`);
    this.server.emit(event, data);
  }
}