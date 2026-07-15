import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

/**
 * Realtime fan-out. Clients join a per-organization room and receive events
 * like `layout:published` (customer apps live-refresh their home) and
 * `order:created` (owner dashboards update). Transport is socket.io.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    // A client may pass ?orgId=... to auto-join its tenant room.
    const orgId = client.handshake.query.orgId;
    if (typeof orgId === "string" && orgId) client.join(this.room(orgId));
  }

  @SubscribeMessage("join")
  join(@ConnectedSocket() client: Socket, @MessageBody() orgId: string) {
    if (orgId) client.join(this.room(orgId));
    return { joined: orgId };
  }

  /** Emit an event to everyone in an org's room. */
  emitToOrg(orgId: string, event: string, payload: unknown) {
    this.server?.to(this.room(orgId)).emit(event, payload);
  }

  private room(orgId: string) {
    return `org:${orgId}`;
  }
}
