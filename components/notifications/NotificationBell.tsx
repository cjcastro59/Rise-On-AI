"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  type AppNotification,
  loadUserNotifications,
  markAllAsRead,
  markAsRead,
  getNotificationPermission,
  requestNotificationPermission,
  isBrowserNotificationSupported,
} from "@/lib/notifications";

interface NotificationBellProps {
  userId: string;
  className?: string;
}

export default function NotificationBell({ userId, className = "" }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshNotifications = useCallback(() => {
    if (!userId) return;
    setNotifications(loadUserNotifications(userId));
    setPermission(getNotificationPermission());
  }, [userId]);

  useEffect(() => {
    refreshNotifications();

    // Check periodically for new notifications in local state
    const interval = setInterval(refreshNotifications, 15_000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const handleMarkAllRead = () => {
    if (!userId) return;
    const updated = markAllAsRead(userId);
    setNotifications(updated);
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!userId) return;
    const updated = markAsRead(userId, notification.id);
    setNotifications(updated);
    setIsOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = Date.now();
    const diff = now - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getTypeIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "emotional_checkin":
        return "💙";
      case "daily_reminder":
        return "✍️";
      case "message":
        return "💬";
      case "announcement":
        return "📢";
      default:
        return "🔔";
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-dark-text/80 hover:text-dark-text hover:bg-light-gray/70 transition-all focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error-red px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-light-gray z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 text-dark-text">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-light-gray bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <span className="font-poppins font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-primary-blue/15 text-primary-blue text-xs font-semibold px-2 py-0.5 rounded-full font-poppins">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-poppins text-primary-blue hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Browser Permission Banner (if not yet granted) */}
          {isBrowserNotificationSupported() && permission === "default" && (
            <div className="bg-gradient-to-r from-primary-blue/10 to-lavender/15 p-3 border-b border-light-gray flex items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-semibold text-dark-text">Enable push notifications</p>
                <p className="text-dark-text/70 text-[11px]">Get daily reminders & counselor messages</p>
              </div>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-2.5 py-1 bg-primary-blue text-white text-xs font-poppins font-medium rounded-lg hover:opacity-90 transition-opacity shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-light-gray/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-dark-text/60">
                <span className="text-3xl mb-2 block">✨</span>
                <p className="text-sm font-poppins font-medium">All caught up!</p>
                <p className="text-xs font-inter text-dark-text/50 mt-1">
                  You have no notifications right now.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                      n.isRead ? "bg-white hover:bg-light-gray/40" : "bg-primary-blue/5 hover:bg-primary-blue/10"
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="text-xl shrink-0 mt-0.5">{getTypeIcon(n.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-poppins ${n.isRead ? "font-medium" : "font-bold text-dark-text"}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-dark-text/50 shrink-0 font-inter">
                          {formatTimeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs font-inter text-dark-text/75 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary-blue shrink-0 mt-1.5" />
                    )}
                  </div>
                );

                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => handleNotificationClick(n)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
