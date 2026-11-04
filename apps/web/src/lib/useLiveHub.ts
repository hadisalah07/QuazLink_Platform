"use client";

import * as React from "react";
import type { ContactMessageItem, PlatformNotification } from "./api";

interface UseLiveHubOptions {
  role?: "admin" | "user";
  userId?: string;
  contactId?: string;
  onNewContact?: (item: ContactMessageItem) => void;
  onReply?: (data: { contactId: string; data: ContactMessageItem }) => void;
  onReplyStatus?: (data: {
    contactId: string;
    replyStatus: "none" | "sent" | "delivered" | "read";
    replyDeliveredAt?: string | null;
    replyReadAt?: string | null;
  }) => void;
  onNotification?: (notif: PlatformNotification) => void;
}

export function useLiveHub(options: UseLiveHubOptions = {}) {
  const [isConnected, setIsConnected] = React.useState(false);
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const connect = React.useCallback(() => {
    if (typeof window === "undefined") return;

    // Resolve WS endpoint
    let base = process.env.NEXT_PUBLIC_API_URL || "https://api.quazlink.site";
    let wsBase = base.replace(/^http(s?):/, "ws$1:");
    if (wsBase.endsWith("/")) wsBase = wsBase.slice(0, -1);

    const query = new URLSearchParams();
    if (optionsRef.current.role) query.set("role", optionsRef.current.role);
    if (optionsRef.current.contactId) query.set("contactId", optionsRef.current.contactId);

    const fullWsUrl = `${wsBase}/ws/live${query.toString() ? `?${query.toString()}` : ""}`;

    try {
      const ws = new WebSocket(fullWsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (optionsRef.current.userId || optionsRef.current.role) {
          ws.send(
            JSON.stringify({
              type: "auth",
              userId: optionsRef.current.userId,
              role: optionsRef.current.role,
            })
          );
        }
        if (optionsRef.current.contactId) {
          ws.send(
            JSON.stringify({
              type: "subscribe_contact",
              contactId: optionsRef.current.contactId,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "contact:new":
              optionsRef.current.onNewContact?.(msg.data);
              break;

            case "contact:reply":
              optionsRef.current.onReply?.({
                contactId: msg.contactId,
                data: msg.data,
              });
              break;

            case "contact:reply_status":
              optionsRef.current.onReplyStatus?.({
                contactId: msg.contactId,
                replyStatus: msg.replyStatus,
                replyDeliveredAt: msg.replyDeliveredAt,
                replyReadAt: msg.replyReadAt,
              });
              break;

            case "notification:new":
              optionsRef.current.onNotification?.(msg.data);
              break;

            case "connected":
              // Server welcomed connection
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, []);

  React.useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Sync authentication and subscriptions whenever options change (e.g. user loads)
  React.useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      if (options.userId || options.role) {
        socketRef.current.send(
          JSON.stringify({
            type: "auth",
            userId: options.userId,
            role: options.role,
          })
        );
      }
      if (options.contactId) {
        socketRef.current.send(
          JSON.stringify({
            type: "subscribe_contact",
            contactId: options.contactId,
          })
        );
      }
    }
  }, [options.userId, options.role, options.contactId]);

  const sendAck = React.useCallback((contactId: string, status: "delivered" | "read") => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "ack_reply",
          contactId,
          status,
        })
      );
    }
  }, []);

  const subscribeContact = React.useCallback((contactId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "subscribe_contact",
          contactId,
        })
      );
    }
  }, []);

  return {
    isConnected,
    sendAck,
    subscribeContact,
  };
}

