import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import prisma from '../prisma';
import { verifyToken } from '../lib/auth';

interface LiveClient extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  role?: string;
  subscribedContactIds?: Set<string>;
}

class LiveHub {
  private wss: WebSocketServer;
  private adminClients: Set<LiveClient> = new Set();
  private userClients: Map<string, Set<LiveClient>> = new Map();
  private contactClients: Map<string, Set<LiveClient>> = new Map();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: LiveClient, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat keeper (every 30s)
    setInterval(() => {
      for (const client of this.wss.clients as Set<LiveClient>) {
        if (client.isAlive === false) {
          this.removeClient(client);
          client.terminate();
          continue;
        }
        client.isAlive = false;
        client.ping();
      }
    }, 30000);
  }

  getWebSocketServer() {
    return this.wss;
  }

  private handleConnection(ws: LiveClient, req: IncomingMessage) {
    ws.isAlive = true;
    ws.subscribedContactIds = new Set();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Parse initial query parameters
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      const contactId = url.searchParams.get('contactId');
      const role = url.searchParams.get('role');

      if (token) {
        const payload = verifyToken(token);
        if (payload?.userId) {
          this.authenticateClient(ws, payload.userId, role || undefined);
        }
      } else if (role === 'admin') {
        // Can be authenticated via cookie or later auth message
      }

      if (contactId) {
        this.subscribeContact(ws, contactId);
      }
    } catch {
      // Ignore URL parse error
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'auth': {
            if (msg.token) {
              const payload = verifyToken(msg.token);
              if (payload?.userId) {
                const user = await prisma.user.findUnique({
                  where: { id: payload.userId },
                  select: { role: true },
                }).catch(() => null);
                const role = user?.role || msg.role || 'user';
                await this.authenticateClient(ws, payload.userId, role);
                ws.send(JSON.stringify({ type: 'auth:success', userId: payload.userId, role }));
              } else {
                ws.send(JSON.stringify({ type: 'auth:error', message: 'Invalid token' }));
              }
            } else if (msg.role === 'admin' && msg.userId) {
              await this.authenticateClient(ws, msg.userId, 'admin');
              ws.send(JSON.stringify({ type: 'auth:success', userId: msg.userId, role: 'admin' }));
            }
            break;
          }

          case 'subscribe_contact': {
            if (msg.contactId) {
              this.subscribeContact(ws, msg.contactId);
              ws.send(JSON.stringify({ type: 'subscribed', contactId: msg.contactId }));
            }
            break;
          }

          case 'ack_reply': {
            // Customer acknowledges receiving or viewing admin reply
            const { contactId, status } = msg;
            if (contactId && (status === 'delivered' || status === 'read')) {
              await this.handleReplyAck(contactId, status);
            }
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          }
        }
      } catch (err: any) {
        console.warn('[LiveHub] Malformed client message:', err.message);
      }
    });

    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('error', () => {
      this.removeClient(ws);
    });

    // Send connection greeting
    ws.send(JSON.stringify({
      type: 'connected',
      channel: 'liveHub',
      serverTime: new Date().toISOString(),
    }));
  }

  private authenticateClient(ws: LiveClient, userId: string, role?: string) {
    ws.userId = userId;
    ws.role = role;

    if (role === 'admin') {
      this.adminClients.add(ws);
    }

    let userSet = this.userClients.get(userId);
    if (!userSet) {
      userSet = new Set();
      this.userClients.set(userId, userSet);
    }
    userSet.add(ws);
  }

  private subscribeContact(ws: LiveClient, contactId: string) {
    ws.subscribedContactIds?.add(contactId);

    let contactSet = this.contactClients.get(contactId);
    if (!contactSet) {
      contactSet = new Set();
      this.contactClients.set(contactId, contactSet);
    }
    contactSet.add(ws);
  }

  private removeClient(ws: LiveClient) {
    if (ws.role === 'admin') {
      this.adminClients.delete(ws);
    }
    if (ws.userId) {
      const userSet = this.userClients.get(ws.userId);
      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          this.userClients.delete(ws.userId);
        }
      }
    }
    if (ws.subscribedContactIds) {
      for (const contactId of ws.subscribedContactIds) {
        const contactSet = this.contactClients.get(contactId);
        if (contactSet) {
          contactSet.delete(ws);
          if (contactSet.size === 0) {
            this.contactClients.delete(contactId);
          }
        }
      }
    }
  }

  /**
   * Handle Customer ACK for delivery or read
   */
  async handleReplyAck(contactId: string, status: 'delivered' | 'read') {
    try {
      const now = new Date();
      const updateData: any = {};

      if (status === 'delivered') {
        updateData.replyStatus = 'delivered';
        updateData.replyDeliveredAt = now;
      } else if (status === 'read') {
        updateData.replyStatus = 'read';
        updateData.replyReadAt = now;
      }

      const updated = await prisma.contactMessage.update({
        where: { id: contactId },
        data: updateData,
        select: {
          id: true,
          replyStatus: true,
          replyDeliveredAt: true,
          replyReadAt: true,
        },
      });

      // Broadcast ACK to Admins so their double-checks update live
      this.broadcastToAdmins({
        type: 'contact:reply_status',
        contactId,
        replyStatus: updated.replyStatus,
        replyDeliveredAt: updated.replyDeliveredAt,
        replyReadAt: updated.replyReadAt,
      });

      console.log(`[LiveHub] Contact #${contactId.slice(0, 8)} ACK status updated to: ${status}`);
    } catch (err: any) {
      console.warn('[LiveHub] Error updating reply ACK:', err.message);
    }
  }

  /**
   * Broadcast payload to all connected Admins
   */
  broadcastToAdmins(payload: any) {
    const raw = JSON.stringify(payload);
    for (const ws of this.adminClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  /**
   * Broadcast payload to a specific user (across all open tabs)
   */
  broadcastToUser(userId: string, payload: any) {
    const raw = JSON.stringify(payload);
    const set = this.userClients.get(userId);
    if (set) {
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw);
        }
      }
    }
  }

  /**
   * Broadcast payload to anyone viewing a specific contact ticket
   */
  broadcastToContact(contactId: string, payload: any) {
    const raw = JSON.stringify(payload);
    const set = this.contactClients.get(contactId);
    if (set) {
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw);
        }
      }
    }
  }

  /**
   * Broadcast when a new contact message is created
   */
  broadcastNewContact(contact: any) {
    this.broadcastToAdmins({
      type: 'contact:new',
      data: contact,
    });
  }

  /**
   * Broadcast when an admin sends a reply
   */
  broadcastReply(contactId: string, userId: string | null, replyData: any) {
    const payload = {
      type: 'contact:reply',
      contactId,
      data: replyData,
    };

    // 1. Send to anyone subscribed to this contact ticket
    this.broadcastToContact(contactId, payload);

    // 2. Send to user's registered account
    if (userId) {
      this.broadcastToUser(userId, payload);
    }

    // 3. Send to other admins so their views sync
    this.broadcastToAdmins(payload);
  }

  /**
   * Broadcast real-time notification
   */
  broadcastNotification(target: { role?: string; userId?: string }, notification: any) {
    const payload = {
      type: 'notification:new',
      data: notification,
    };

    if (target.role === 'admin') {
      this.broadcastToAdmins(payload);
    }
    if (target.userId) {
      this.broadcastToUser(target.userId, payload);
    }
  }
}

export const liveHub = new LiveHub();
