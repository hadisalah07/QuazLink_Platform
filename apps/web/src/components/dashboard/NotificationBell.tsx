"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
} from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type PlatformNotification,
} from "@/lib/api";

interface NotificationBellProps {
  variant?: "dashboard" | "header";
}

export function NotificationBell({ variant = "dashboard" }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<PlatformNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifs = React.useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await getNotifications();
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Ignore background fetch failures (e.g. unauthenticated)
    }
  }, []);

  React.useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // Poll every 15s

    const onVisibilityChange = () => {
      if (!document.hidden) fetchNotifs();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchNotifs]);

  // Close on click outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClickItem = async (notif: PlatformNotification) => {
    if (!notif.isRead) {
      markNotificationRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "contact_new":
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      case "contact_reply":
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case "contact_received":
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "الآن • Just now";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications / الإشعارات"
        className={`relative p-2 rounded-full transition-all cursor-pointer ${
          isOpen
            ? "bg-white/10 text-white"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-gradient-to-b from-[#0F172A] to-[#070B16] border border-white/10 shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-extrabold text-white">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                  {unreadCount} جديد
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-gray-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
          </div>

          {/* List Container */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-gray-600" />
                <span className="text-xs font-bold text-gray-400">لا توجد إشعارات حالياً</span>
                <span className="text-[11px] text-gray-500">أنت على اطلاع دائم بكافة التحديثات!</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                    item.isRead
                      ? "bg-transparent hover:bg-white/[0.03] opacity-75"
                      : "bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-white truncate">
                        {item.title}
                      </h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-300 leading-snug line-clamp-2 mt-0.5 font-sans">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-gray-500 mt-1 block font-mono">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

