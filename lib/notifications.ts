/**
 * Notification management utilities for Rise On AI
 * Supports:
 * - Native Browser Web Notifications (Notification API)
 * - In-app notification center state per user
 * - Daily reminder scheduling
 * - Emotional distress & negative sentiment check-in alerts
 */

export type AppNotification = {
  id: string;
  type: "daily_reminder" | "emotional_checkin" | "message" | "announcement" | "system";
  title: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  href?: string;
};

// Check if browser notifications are supported
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) return "denied";
  return Notification.permission;
}

// Request browser permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return "denied";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("Failed to request notification permission:", err);
    return "denied";
  }
}

// Show native browser notification if granted
export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!isBrowserNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  try {
    const defaultOptions: NotificationOptions = {
      icon: "/logo/Without Text.png",
      badge: "/logo/Without Text.png",
      silent: false,
      ...options,
    };
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn("Could not display native notification:", err);
  }
}

// Local storage key for notifications
function getStorageKey(userId: string): string {
  return `rise_on_notifications_${userId}`;
}

// Load notifications for a user
export function loadUserNotifications(userId: string): AppNotification[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

// Save notifications for a user
export function saveUserNotifications(userId: string, list: AppNotification[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    // Keep at most 30 recent notifications
    const trimmed = list.slice(0, 30);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Error saving notifications:", err);
  }
}

// Add a notification (and optionally fire a browser push)
export function addNotification(
  userId: string,
  notification: Omit<AppNotification, "id" | "timestamp" | "isRead">
): AppNotification[] {
  const existing = loadUserNotifications(userId);
  
  // Avoid duplicates within the last 6 hours for reminders/checkins
  const isDuplicate = existing.some(
    (n) =>
      n.type === notification.type &&
      n.title === notification.title &&
      Date.now() - new Date(n.timestamp).getTime() < 6 * 60 * 60 * 1000
  );
  if (isDuplicate) return existing;

  const newNotification: AppNotification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    isRead: false,
  };

  const updated = [newNotification, ...existing];
  saveUserNotifications(userId, updated);

  // Trigger native push if granted
  showBrowserNotification(newNotification.title, {
    body: newNotification.message,
    tag: newNotification.id,
  });

  return updated;
}

// Mark single notification as read
export function markAsRead(userId: string, notificationId: string): AppNotification[] {
  const existing = loadUserNotifications(userId);
  const updated = existing.map((n) =>
    n.id === notificationId ? { ...n, isRead: true } : n
  );
  saveUserNotifications(userId, updated);
  return updated;
}

// Mark all notifications as read
export function markAllAsRead(userId: string): AppNotification[] {
  const existing = loadUserNotifications(userId);
  const updated = existing.map((n) => ({ ...n, isRead: true }));
  saveUserNotifications(userId, updated);
  return updated;
}

/**
 * Check recent entries for negative sentiment or distress.
 * If found, deliver a gentle empathetic check-in notification.
 */
export function checkEmotionalStatusAndNotify(
  userId: string,
  recentEntries: Array<{ sentiment?: string | null; mood?: string | null; created_at?: string }>
) {
  if (!userId || !recentEntries || recentEntries.length === 0) return;

  const lastEntry = recentEntries[0];
  const sentiment = (lastEntry.sentiment || "").toLowerCase();
  const mood = (lastEntry.mood || "").toLowerCase();

  const isDistress =
    sentiment.includes("distress") ||
    sentiment.includes("crisis") ||
    ["overwhelmed", "hopeless", "anxious", "sad", "angry"].includes(mood);

  if (isDistress) {
    addNotification(userId, {
      type: "emotional_checkin",
      title: "Gentle Check-in 💙",
      message:
        "We noticed your recent entry felt heavy. Remember to take a deep breath — your feelings are valid, and support is here whenever you need it.",
      href: "/support",
    });
  }
}

/**
 * Check if the daily journal reminder is due.
 */
export function checkDailyReminderAndNotify(
  userId: string,
  reminderEnabled: boolean = true,
  preferredTime: string = "20:00"
) {
  if (!userId || !reminderEnabled) return;

  const todayKey = `rise_on_reminder_${userId}_${new Date().toDateString()}`;
  if (typeof window !== "undefined" && localStorage.getItem(todayKey)) {
    return; // Already notified today
  }

  const now = new Date();
  const [targetHour, targetMinute] = preferredTime.split(":").map(Number);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // If current time is at or after preferred time today
  if (
    currentHour > targetHour ||
    (currentHour === targetHour && currentMinute >= (targetMinute || 0))
  ) {
    if (typeof window !== "undefined") {
      localStorage.setItem(todayKey, "done");
    }

    addNotification(userId, {
      type: "daily_reminder",
      title: "Time for your daily reflection ✍️",
      message:
        "How was your day? Take 2 minutes to write down your thoughts and care for your mind.",
      href: "/journal/new",
    });
  }
}
