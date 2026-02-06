import { Injectable, Logger } from '@nestjs/common';
import { DynamicWebSocketGateway } from '../gateway/dynamic-websocket.gateway';

@Injectable()
export class WebsocketEmitService {
  private readonly logger = new Logger(WebsocketEmitService.name);
  private currentGatewayPath: string;

  constructor(
    private readonly websocketGateway: DynamicWebSocketGateway,
  ) {}

  setGatewayPath(path: string) {
    this.currentGatewayPath = path;
  }

  emit(event: string, data: any) {
    if (this.currentGatewayPath) {
      this.websocketGateway.emitToNamespace(this.currentGatewayPath, event, data);
    }
  }

  join(room: string) {
    this.logger.debug(`Join room: ${room}`);
  }

  leave(room: string) {
    this.logger.debug(`Leave room: ${room}`);
  }

  to(room: string) {
    return {
      emit: (event: string, data: any) => {
        this.websocketGateway.emitToRoom(room, event, data);
      },
    };
  }

  close() {
    this.logger.debug('Close socket');
  }

  get rooms() {
    return new Set<string>();
  }
}
