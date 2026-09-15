"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type BaseConversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
type SupportChannel = "counselor" | "admin";

type SupportProfile = Pick<
  UserProfile,
  | "id"
  | "username"
  | "full_name"
  | "first_name"
  | "last_name"
  | "email"
  | "role"
  | "avatar_url"
  | "is_online"
  | "assigned_counselor_id"
>;

type SupportConversation = BaseConversation & {
  channel?: SupportChannel;
  unreadCount?: number;
};

const PROFILE_SELECT =
  "id,username,full_name,first_name,last_name,email,role,avatar_url,is_online,assigned_counselor_id";

const channelCopy: Record<SupportChannel, { title: string; subtitle: string; cta: string }> = {
  counselor: {
    title: "Counselor Support",
    subtitle: "Talk privately with your assigned counselor.",
    cta: "Open Counselor Chat",
  },
  admin: {
    title: "Admin Support / Feedback",
    subtitle: "Send questions, bug reports, suggestions, or platform feedback.",
    cta: "Open Admin Feedback",
  },
};

const getDisplayName = (profile?: Partial<SupportProfile> | null) => {
  if (!profile) return "Support";
  return profile.full_name || profile.username || profile.email || "Support";
};

const getRoleLabel = (role?: string | null) => {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "counselor":
      return "Counselor";
    default:
      return "Support";
  }
};

const getConversationChannel = (
  conversation: SupportConversation,
  profile: SupportProfile | null,
  recipients: Record<string, SupportProfile>
): SupportChannel => {
  if (conversation.channel) return conversation.channel;
  if (conversation.counselor_id === profile?.assigned_counselor_id) return "counselor";
  const recipientRole = conversation.counselor_id
    ? recipients[conversation.counselor_id]?.role
    : null;
  return recipientRole === "counselor" ? "counselor" : "admin";
};

const filterParticipantMessages = (
  messages: Message[],
  conversation: SupportConversation | null
) => {
  if (!conversation) return [];
  const participantIds = new Set([conversation.user_id, conversation.counselor_id].filter(Boolean));
  return messages.filter((message) => participantIds.has(message.sender_id));
};

export default function SupportPage() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [recipients, setRecipients] = useState<Record<string, SupportProfile>>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<SupportProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null);
  const [activeChannel, setActiveChannel] = useState<SupportChannel>("counselor");
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SupportProfile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [startingChannel, setStartingChannel] = useState<SupportChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<SupportConversation | null>(null);
  const conversationsRef = useRef<SupportConversation[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient() as any, []);

  const displayToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const loadSupportState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/support/conversations", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Failed to load support conversations.");
      }

      const nextConversations = (result.conversations || []) as SupportConversation[];
      const nextRecipients = (result.recipients || {}) as Record<string, SupportProfile>;
      const profile = (result.profile || null) as SupportProfile | null;

      setCurrentUserProfile(profile);
      setCurrentUserId(profile?.id || null);
      setRecipients(nextRecipients);
      setConversations(nextConversations);

      const currentSelected = selectedConversationRef.current;
      const selectedStillExists = currentSelected
        ? nextConversations.find((conversation) => conversation.id === currentSelected.id)
        : null;

      if (selectedStillExists) {
        setSelectedConversation(selectedStillExists);
        setActiveChannel(getConversationChannel(selectedStillExists, profile, nextRecipients));
      } else if (nextConversations.length > 0) {
        setSelectedConversation(nextConversations[0]);
        setActiveChannel(getConversationChannel(nextConversations[0], profile, nextRecipients));
      } else {
        setSelectedConversation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support.");
    } finally {
      setLoading(false);
    }
  }, []);

  const markConversationRead = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )
    );

    await fetch("/api/support/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch((err) => console.error("[support] mark read failed:", err));
  }, []);

  const loadMessages = useCallback(async (conversation: SupportConversation | null) => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setMessages([]);
      return;
    }

    setMessages(filterParticipantMessages((data || []) as Message[], conversation));
    void markConversationRead(conversation.id);
  }, [markConversationRead, supabase]);

  const openChannel = useCallback(async (channel: SupportChannel) => {
    try {
      setStartingChannel(channel);
      setError(null);
      const response = await fetch("/api/support/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Failed to open support channel.");
      }

      const conversation = result.conversation as SupportConversation;
      const recipient = result.recipient as SupportProfile;

      setRecipients((prev) => ({ ...prev, [recipient.id]: recipient }));
      setConversations((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== conversation.id);
        return [conversation, ...withoutCurrent];
      });
      setActiveChannel(channel);
      setSelectedConversation(conversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open channel.");
    } finally {
      setStartingChannel(null);
    }
  }, []);

  const selectConversation = (conversation: SupportConversation) => {
    setActiveChannel(getConversationChannel(conversation, currentUserProfile, recipients));
    setSelectedConversation(conversation);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedConversation || !currentUserId || !newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setNewMessage("");
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content: messageContent,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === optimisticMessage.id ? (data as Message) : message
        )
      );
      void loadSupportState();
    } catch (err) {
      console.error("[support] send failed:", err);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      setError(err instanceof Error ? err.message : "Failed to send message.");
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void loadSupportState();
  }, [loadSupportState]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    void loadMessages(selectedConversation);
  }, [loadMessages, selectedConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const senderIds = Array.from(new Set(messages.map((message) => message.sender_id)));
    if (senderIds.length === 0) return;

    supabase
      .from("user_profiles")
      .select(PROFILE_SELECT)
      .in("id", senderIds)
      .then(({ data, error }: { data: SupportProfile[] | null; error: Error | null }) => {
        if (error || !data) return;
        setSenderProfiles((prev) => {
          const next = { ...prev };
          data.forEach((profile) => {
            next[profile.id] = profile;
          });
          return next;
        });
      });
  }, [messages, supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`member-support:${currentUserId}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `user_id=eq.${currentUserId}` },
      () => void loadSupportState()
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload: any) => {
        const incoming = payload.new as Message;
        const conversation = conversationsRef.current.find(
          (item) => item.id === incoming.conversation_id
        );
        const signedInUserId = currentUserIdRef.current;

        if (!conversation || !signedInUserId || incoming.sender_id === signedInUserId) return;
        if (![conversation.user_id, conversation.counselor_id].includes(incoming.sender_id)) return;

        const sender =
          senderProfiles[incoming.sender_id] ||
          (conversation.counselor_id ? recipients[conversation.counselor_id] : null);
        const senderLabel = `${getRoleLabel(sender?.role)} ${getDisplayName(sender)}`;

        if (selectedConversationRef.current?.id === incoming.conversation_id) {
          setMessages((prev) =>
            prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]
          );
          void markConversationRead(incoming.conversation_id);
        } else {
          setConversations((prev) =>
            prev.map((item) =>
              item.id === incoming.conversation_id
                ? { ...item, unreadCount: (item.unreadCount || 0) + 1 }
                : item
            )
          );
        }

        displayToast(`${senderLabel} sent you a message.`);
        void loadSupportState();
      }
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    displayToast,
    loadSupportState,
    markConversationRead,
    recipients,
    senderProfiles,
    supabase,
  ]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const groupedConversations = useMemo(() => {
    return conversations.reduce<Record<SupportChannel, SupportConversation[]>>(
      (groups, conversation) => {
        const channel = getConversationChannel(conversation, currentUserProfile, recipients);
        groups[channel].push(conversation);
        return groups;
      },
      { counselor: [], admin: [] }
    );
  }, [conversations, currentUserProfile, recipients]);

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unreadCount || 0),
    0
  );

  const selectedRecipient = selectedConversation?.counselor_id
    ? recipients[selectedConversation.counselor_id]
    : null;
  const selectedChannel = selectedConversation
    ? getConversationChannel(selectedConversation, currentUserProfile, recipients)
    : activeChannel;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-success-green/30 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-success-green/15 text-sm font-bold text-success-green">
              !
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold font-poppins text-dark-text">New support message</p>
              <p className="mt-1 text-xs font-inter text-dark-text/70">{toast}</p>
            </div>
            <button
              type="button"
              className="text-sm text-dark-text/40 hover:text-dark-text"
              onClick={() => setToast(null)}
            >
              x
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Support Center</h1>
          <p className="text-sm text-dark-text/60 font-poppins">
            Choose counselor support for wellbeing concerns or admin feedback for platform help.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="ghost" className="text-sm bg-gradient-to-r from-gray-100 to-gray-200">
            Return to Dashboard
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-soft-red/30 bg-soft-red/10 px-4 py-3 text-sm font-poppins text-dark-text">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.4fr] gap-6">
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-primary-blue/5 via-white to-lavender/10 border border-primary-blue/10">
            <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60">Immediate Resources</p>
            <div className="mt-4 space-y-3">
              {[
                ["National Center for Mental Health", "1553", "24/7 Crisis Hotline"],
                ["In Touch Crisis Lines", "(02) 8893-7603", "Mon-Sun, 10AM-10PM"],
                ["Rise On AI Support", "support@riseonai.com", "Email support"],
                ["Hopeline Philippines", "2919", "24/7 text and call support"],
              ].map(([name, phone, description]) => (
                <a
                  key={name}
                  href={phone.includes("@") ? `mailto:${phone}` : `tel:${phone}`}
                  className="block rounded-xl border border-primary-blue/10 bg-white/80 p-4 transition hover:border-primary-blue/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold font-poppins text-dark-text">{name}</p>
                      <p className="text-xs font-inter text-dark-text/60">{description}</p>
                    </div>
                    <span className="text-sm font-semibold font-poppins text-primary-blue">{phone}</span>
                  </div>
                </a>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-warning-yellow/10 via-white to-success-green/10 border border-warning-yellow/10">
            <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60">Grounding Check</p>
            <div className="mt-4 grid gap-3">
              {[
                "5 things you can see",
                "4 things you can touch",
                "3 things you can hear",
                "2 things you can smell",
                "1 thing you can taste",
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-blue/15 text-sm font-bold text-primary-blue">
                    {5 - index}
                  </span>
                  <p className="text-sm font-poppins text-dark-text">{step}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex h-[720px] max-h-[720px] flex-col overflow-hidden border border-gray-100 bg-white/95 p-0">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60">Support Channels</p>
                <p className="text-sm font-inter text-dark-text/60">
                  {unreadTotal > 0 ? `${unreadTotal} unread message${unreadTotal === 1 ? "" : "s"}` : "No unread messages"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(channelCopy) as SupportChannel[]).map((channel) => (
                  <Button
                    key={channel}
                    type="button"
                    size="sm"
                    variant={activeChannel === channel ? "primary" : "secondary"}
                    disabled={startingChannel === channel}
                    onClick={() => openChannel(channel)}
                  >
                    {startingChannel === channel ? "Opening..." : channelCopy[channel].cta}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
            <aside className="min-h-0 border-b border-gray-100 md:border-b-0 md:border-r">
              <div className="max-h-[260px] overflow-y-auto p-4 md:max-h-none md:h-full">
                {(Object.keys(channelCopy) as SupportChannel[]).map((channel) => (
                  <section key={channel} className="mb-5 last:mb-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold font-poppins uppercase tracking-wide text-dark-text/70">
                          {channelCopy[channel].title}
                        </p>
                        <p className="text-[11px] font-inter text-dark-text/45">
                          {channelCopy[channel].subtitle}
                        </p>
                      </div>
                      {groupedConversations[channel].some((conversation) => (conversation.unreadCount || 0) > 0) && (
                        <span className="h-2.5 w-2.5 rounded-full bg-soft-red" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {groupedConversations[channel].length === 0 ? (
                        <button
                          type="button"
                          onClick={() => openChannel(channel)}
                          className="w-full rounded-xl border border-dashed border-gray-200 p-3 text-left text-xs font-poppins text-dark-text/55 hover:border-primary-blue/30 hover:text-dark-text"
                        >
                          Start this channel
                        </button>
                      ) : (
                        groupedConversations[channel].map((conversation) => {
                          const recipient = conversation.counselor_id
                            ? recipients[conversation.counselor_id]
                            : null;
                          const unread = conversation.unreadCount || 0;
                          return (
                            <button
                              key={conversation.id}
                              type="button"
                              onClick={() => selectConversation(conversation)}
                              className={`w-full rounded-xl border p-3 text-left transition ${
                                selectedConversation?.id === conversation.id
                                  ? "border-primary-blue/40 bg-primary-blue/10"
                                  : "border-gray-100 bg-gray-50 hover:border-primary-blue/20"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold font-poppins text-dark-text">
                                  {getDisplayName(recipient)}
                                </p>
                                {unread > 0 && (
                                  <span className="rounded-full bg-soft-red px-2 py-0.5 text-[10px] font-bold text-white">
                                    {unread}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] font-inter text-dark-text/50">
                                {conversation.status} - {new Date(conversation.updated_at).toLocaleDateString()}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </aside>

            <div className="flex min-h-0 flex-col">
              {selectedConversation ? (
                <>
                  <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60">
                          {channelCopy[selectedChannel].title}
                        </p>
                        <h2 className="mt-1 text-lg font-dm-serif text-dark-text">
                          {getDisplayName(selectedRecipient)}
                        </h2>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold font-poppins ${
                        selectedConversation.status === "open"
                          ? "bg-success-green/15 text-success-green"
                          : "bg-gray-100 text-dark-text/50"
                      }`}>
                        {selectedConversation.status}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {loading ? (
                      <p className="text-center text-sm font-inter text-dark-text/50">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-center">
                        <div>
                          <p className="text-sm font-semibold font-poppins text-dark-text">No messages yet</p>
                          <p className="mt-1 text-xs font-inter text-dark-text/50">
                            Send the first message in this support channel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const isMine = message.sender_id === currentUserId;
                          const sender = senderProfiles[message.sender_id];
                          return (
                            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[82%] rounded-2xl px-4 py-2 shadow-sm ${
                                isMine
                                  ? "rounded-tr-none bg-gradient-to-r from-primary-blue to-lavender text-white"
                                  : "rounded-tl-none bg-gray-100 text-dark-text"
                              }`}>
                                {!isMine && (
                                  <p className="mb-1 text-[11px] font-semibold font-poppins opacity-75">
                                    {getRoleLabel(sender?.role)} {getDisplayName(sender)}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap text-sm font-inter">{message.content}</p>
                                <p className={`mt-1 text-[11px] opacity-65 ${isMine ? "text-right" : "text-left"}`}>
                                  {new Date(message.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {selectedConversation.status === "open" ? (
                    <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-100 p-4">
                      <Input
                        type="text"
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        disabled={sending}
                        placeholder={
                          selectedChannel === "admin"
                            ? "Share a question, bug report, feedback, or suggestion..."
                            : "Type your message..."
                        }
                        className="flex-1 border-2 border-primary-blue/10 bg-white"
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>
                        {sending ? "Sending..." : "Send"}
                      </Button>
                    </form>
                  ) : (
                    <div className="border-t border-gray-100 p-4 text-center text-sm font-inter text-dark-text/50">
                      This conversation is closed.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-lg font-dm-serif text-dark-text">Choose a support channel</p>
                    <p className="mt-2 text-sm font-inter text-dark-text/60">
                      Start counselor support for assigned care, or admin feedback for platform help.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
