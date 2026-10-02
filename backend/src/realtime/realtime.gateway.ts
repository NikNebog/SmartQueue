import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:5173'],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Клиент подключился: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Клиент отключился: ${client.id}`);
  }

  sendTicketCalled(ticketNumber: string, roomName: string) {
    this.server.emit('ticket_called', {
      event: 'ticket_called',
      data: {
        ticketNumber,
        roomName,
        status: 'called',
      },
    });
  }

  sendStatusUpdate(ticketNumber: string, status: string, roomName: string) {
    this.server.emit('status_update', {
      event: 'status_update',
      data: {
        ticketNumber,
        roomName,
        status,
      },
    });
  }
}