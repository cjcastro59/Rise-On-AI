"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { useAuth } from "@/hooks/useAuth";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  user?: Database["public"]["Tables"]["user_profiles"]["Row"];
};
type Message = Database["public"]["Tables"]["messages"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default function AdminSupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, UserProfile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [closingConversation, setClosingConversation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const conversationsChannelRef = useRef<any>(null);
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        // Fetch current user profile
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setCurrentUserProfile(profile);
      }
    };
    getCurrentUser();
    loadConversations();

    // Subscribe to all conversations for real-time updates
    const subscribeToConversations = () => {
      console.log("[ADMIN SUPPORT] Subscribing to conversations...");
      if (conversationsChannelRef.current) {
        console.log("[ADMIN SUPPORT] Removing previous conversations channel...");
        supabase.removeChannel(conversationsChannelRef.current);
      }

      const channel = supabase.channel("admin:conversations");

      // Listen for new conversations
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations"
        },
        async (payload: any) => {
          console.log("[ADMIN SUPPORT] New conversation received:", payload);
          // Fetch the user profile for the new conversation
          const { data: newConversationWithUser } = await supabase
            .from("conversations")
            .select(`
              *,
              user:user_profiles!user_id(*)
            `)
            .eq("id", payload.new.id)
            .single();
          
          if (newConversationWithUser) {
            console.log("[ADMIN SUPPORT] Adding new conversation to state:", newConversationWithUser);
            setConversations((prev) => [newConversationWithUser, ...prev]);
          }
        }
      );

      // Listen for conversation updates
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations"
        },
        async (payload: any) => {
          console.log("[ADMIN SUPPORT] Conversation updated:", payload);
          // Fetch the updated conversation with user profile
          const { data: updatedConversationWithUser } = await supabase
            .from("conversations")
            .select(`
              *,
              user:user_profiles!user_id(*)
            `)
            .eq("id", payload.new.id)
            .single();
          
          if (updatedConversationWithUser) {
            console.log("[ADMIN SUPPORT] Updating conversation in state:", updatedConversationWithUser);
            // Update conversations list
            setConversations((prev) => 
              prev.map(c => c.id === updatedConversationWithUser.id ? updatedConversationWithUser : c)
            );
            // Update selected conversation if it's the one being updated
            setSelectedConversation((prev) => 
              prev && prev.id === updatedConversationWithUser.id ? updatedConversationWithUser : prev
            );
          }
        }
      );

      channel.subscribe((status: any, err: any) => {
        console.log("[ADMIN SUPPORT] Conversations realtime status:", status);
        if (err) {
          console.error("[ADMIN SUPPORT] Conversations realtime error:", err);
        }
      });

      conversationsChannelRef.current = channel;
      console.log("[ADMIN SUPPORT] Conversations channel stored in ref:", conversationsChannelRef.current);
    };

    subscribeToConversations();

    return () => {
      console.log("[ADMIN SUPPORT] Unsubscribing from channels...");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current);
        conversationsChannelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Fetch sender profiles for all messages
    const fetchSenderProfiles = async () => {
      const uniqueSenderIds = [...new Set(messages.map(msg => msg.sender_id))];
      if (uniqueSenderIds.length === 0) return;

      console.log("Admin: Fetching sender profiles for IDs:", uniqueSenderIds);

      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("*")
        .in("id", uniqueSenderIds);

      console.log("Admin: Fetched profiles:", profiles, "Error:", error);

      if (profiles) {
        const profileMap: Record<string, UserProfile> = {};
        profiles.forEach(profile => {
          profileMap[profile.id] = profile;
        });
        setSenderProfiles(profileMap);
      }
    };

    fetchSenderProfiles();
  }, [messages, supabase]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const { data } = await supabase
        .from("conversations")
        .select(`
          *,
          user:user_profiles!user_id(*)
        `)
        .order("created_at", { ascending: false });
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const subscribeToMessages = (conversationId: string) => {
    console.log("[ADMIN SUPPORT] subscribeToMessages called for conversation:", conversationId);
    // Cleanup previous channel
    if (channelRef.current) {
      console.log("[ADMIN SUPPORT] Removing previous messages channel...");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel
    const channel = supabase.channel(`admin-support:${conversationId}`);
    
    // Add message insert handler
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      async (payload: any) => {
        console.log("[ADMIN SUPPORT] New real-time message received:", payload);
        const newMessage = payload.new as Message;
        
        // Fetch sender profile if we don't have it
        if (!senderProfiles[newMessage.sender_id]) {
          try {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", newMessage.sender_id)
              .single();
            
            if (profile) {
              console.log("[ADMIN SUPPORT] Fetched sender profile:", profile);
              setSenderProfiles((prev) => ({
                ...prev,
                [profile.id]: profile
              }));
            }
          } catch (error) {
            console.error("[ADMIN SUPPORT] Error fetching sender profile for new message:", error);
          }
        }
        
        setMessages((prev) => {
          if (prev.some(msg => msg.id === newMessage.id)) {
            console.log("[ADMIN SUPPORT] Message already exists, skipping...");
            return prev;
          }
          console.log("[ADMIN SUPPORT] Adding new message to state:", newMessage);
          return [...prev, newMessage];
        });
      }
    );
    
    // Add conversation update handler for the selected conversation
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${conversationId}`
      },
      async (payload: any) => {
        console.log("[ADMIN SUPPORT] Selected conversation updated:", payload);
        // Fetch the updated conversation with user profile
        const { data: updatedConversationWithUser } = await supabase
          .from("conversations")
          .select(`
            *,
            user:user_profiles!user_id(*)
          `)
          .eq("id", payload.new.id)
          .single();
        
        if (updatedConversationWithUser) {
          console.log("[ADMIN SUPPORT] Updating selected conversation in state:", updatedConversationWithUser);
          setSelectedConversation(updatedConversationWithUser);
        }
      }
    );

    // Subscribe
    channel.subscribe((status: any, err: any) => {
      console.log("[ADMIN SUPPORT] Messages realtime subscription status:", status);
      if (err) {
        console.error("[ADMIN SUPPORT] Messages realtime subscription error:", err);
      }
      if (status === 'SUBSCRIBED') {
        console.log("[ADMIN SUPPORT] Successfully subscribed to real-time support channel!");
      } else if (status === 'CHANNEL_ERROR') {
        console.error("[ADMIN SUPPORT] Error subscribing to real-time support channel!");
      }
    });
    
    // Store channel in ref
    channelRef.current = channel;
    console.log("[ADMIN SUPPORT] Messages channel stored in ref:", channelRef.current);
  };

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    subscribeToMessages(conversation.id);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log("Admin: Attempting to send message...");
    console.log("Admin: newMessage:", newMessage);
    console.log("Admin: selectedConversation:", selectedConversation);
    console.log("Admin: currentUserId:", currentUserId);
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;

    const messageContent = newMessage.trim();
    
    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString()
    };

    console.log("Admin: Adding optimistic message:", optimisticMessage);
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      setLoading(true);
      console.log("Admin: Inserting message into Supabase...");
      
      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content: messageContent
        })
        .select()
        .single();

      console.log("Admin: Insert result:", { data: insertedMessage, error });
      if (error) throw error;
      
      // Update conversation's updated_at timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);
      
      // Replace optimistic message with real one
      console.log("Admin: Replacing optimistic message with real one:", insertedMessage);
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === optimisticMessage.id ? insertedMessage : msg
        )
      );
      
    } catch (error) {
      console.error("Admin: Error sending message:", error);
      // Remove optimistic message if there was an error
      setMessages((prev) => prev.filter(msg => msg.id !== optimisticMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const closeConversation = async () => {
    if (!selectedConversation) return;

    try {
      setClosingConversation(true);

      const { error } = await supabase
        .from("conversations")
        .update({ status: "closed" })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      // Update the conversation in the list
      setConversations((prev) => 
        prev.map((c) => 
          c.id === selectedConversation.id 
            ? { ...c, status: "closed" } 
            : c
        )
      );

      // Update the selected conversation
      setSelectedConversation((prev) => 
        prev ? { ...prev, status: "closed" } : null
      );

    } catch (error) {
      console.error("Error closing conversation:", error);
    } finally {
      setClosingConversation(false);
    }
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return "User";
    switch (role) {
      case "owner":
        return "Owner";
      case "admin":
        return "Admin";
      case "counselor":
        return "Counselor";
      default:
        return "User";
    }
  };

  const getMessageBgColor = (role: string | null, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "bg-gradient-to-r from-primary-blue to-lavender text-white";
    }
    switch (role) {
      case "owner":
        return "bg-gradient-to-r from-soft-red to-pink-300 text-white";
      case "admin":
        return "bg-gradient-to-r from-success-green to-teal-300 text-white";
      case "counselor":
        return "bg-gradient-to-r from-warning-yellow to-amber-300 text-white";
      default:
        return "bg-gradient-to-r from-gray-100 to-gray-200 text-dark-text";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Support Chat</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Respond to user inquiries and manage conversations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card className="p-0 h-[600px] max-h-[600px] flex flex-col bg-gradient-to-br from-white/90 via-gray-50/90 to-lavender/5 border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-blue/5 to-lavender/10 flex-shrink-0">
              <h3 className="font-poppins font-semibold text-dark-text">Conversations</h3>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-dark-text/50">
                  <p>No conversations yet.</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => selectConversation(convo)}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gradient-to-r from-primary-blue/5 to-lavender/10 transition-all ${
                      selectedConversation?.id === convo.id 
                        ? "bg-gradient-to-r from-primary-blue/10 to-lavender/15 border-l-4 border-primary-blue" 
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm text-dark-text">
                        {(() => {
                          const getFirstName = (name: string | undefined | null) => {
                            if (!name) return "Unknown User";
                            return name.split(' ')[0];
                          };
                          return getFirstName(convo.user?.full_name) || getFirstName(convo.user?.username) || "Unknown User";
                        })()}
                      </p>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        convo.status === "open" 
                          ? "bg-gradient-to-r from-success-green/20 to-teal-200 text-success-green" 
                          : "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500"
                      }`}>
                        {convo.status}
                      </span>
                    </div>
                    <p className="text-xs text-dark-text/50">
                      {new Date(convo.created_at).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          <Card className="p-6 h-[600px] max-h-[600px] flex flex-col bg-gradient-to-br from-white/90 via-gray-50/90 to-lavender/5 border border-gray-100 overflow-hidden">
            {selectedConversation ? (
              <>
                <div className="border-b border-gray-200 pb-4 mb-4 bg-gradient-to-r from-gray-50 to-lavender/5 -mx-6 px-6 pt-0 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-poppins font-semibold text-dark-text mb-1">
                        Chat with {(() => {
                          const getFirstName = (name: string | undefined | null) => {
                            if (!name) return "Unknown User";
                            return name.split(' ')[0];
                          };
                          return getFirstName(selectedConversation.user?.full_name) || getFirstName(selectedConversation.user?.username) || "Unknown User";
                        })()}
                      </h3>
                      <p className="text-xs text-dark-text/50">
                        Status: <span className={`font-semibold ${selectedConversation.status === "open" ? "text-success-green" : "text-gray-500"}`}>
                          {selectedConversation.status}
                        </span>
                      </p>
                    </div>
                    {selectedConversation.status === "open" && currentUserProfile && (['owner', 'admin', 'counselor'].includes(currentUserProfile.role || '')) && (
                      <Button
                        onClick={closeConversation}
                        disabled={closingConversation}
                        className="bg-gradient-to-r from-soft-red to-pink-400 hover:from-soft-red/90 hover:to-pink-500"
                      >
                        {closingConversation ? "Closing..." : "Close Conversation"}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 min-h-0">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-dark-text/50 py-8">
                      <p>No messages yet.</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isCurrentUser = currentUserId && msg.sender_id === currentUserId;
                      const senderProfile = senderProfiles[msg.sender_id];
                      const role = senderProfile?.role;
                      const roleLabel = getRoleLabel(role);
                      // Get first name
                      const getFirstName = (name: string | undefined | null) => {
                        if (!name) return "Unknown";
                        return name.split(' ')[0];
                      };

                      const senderName = getFirstName(senderProfile?.full_name) || getFirstName(senderProfile?.username) || "Unknown";
                      const currentUserName = getFirstName(currentUserProfile?.full_name) || getFirstName(currentUserProfile?.username) || "Me";
                      const shouldShowRoleLabel = role && ['owner', 'admin', 'counselor'].includes(role);
                      const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);

                      console.log("Admin: Message:", msg, "Sender profile:", senderProfile, "Sender name:", senderName);

                      return (
                        <div 
                          key={msg.id}
                          className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} items-start gap-2 mb-1`}
                        >
                          {!isCurrentUser && (
                            <>
                              {showAvatar ? (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-blue/20 to-lavender/20 flex items-center justify-center flex-shrink-0 border border-primary-blue/10 mt-1">
                                  {senderProfile?.avatar_url ? (
                                    <img 
                                      src={senderProfile.avatar_url} 
                                      alt={senderName} 
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-bold text-primary-blue">
                                      {senderName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="w-8 flex-shrink-0" />
                              )}
                            </>
                          )}
                          <div className="flex flex-col gap-1 max-w-[80%]">
                            {!isCurrentUser && shouldShowRoleLabel && (index === 0 || messages[index - 1].sender_id !== msg.sender_id) && (
                              <p className="text-xs font-bold text-gray-600 ml-1 mb-1">
                                {roleLabel} {senderName}
                              </p>
                            )}
                            <div 
                              className={`rounded-2xl px-4 py-2 shadow-sm ${
                                isCurrentUser
                                  ? "bg-gradient-to-r from-primary-blue to-lavender text-white rounded-tr-none"
                                  : "bg-gray-100 text-dark-text rounded-tl-none"
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 opacity-70 ${isCurrentUser ? "text-right" : "text-left"}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          {isCurrentUser && (
                            <div className="w-8 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {selectedConversation.status !== "closed" ? (
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Type your response..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={loading}
                      className="flex-1 border-2 border-primary-blue/10 bg-white focus:border-primary-blue/30 focus:ring-2 focus:ring-primary-blue/20"
                    />
                    <Button 
                      type="submit" 
                      disabled={loading || !newMessage.trim()}
                      className="bg-gradient-to-r from-primary-blue to-lavender hover:from-primary-blue/90 hover:to-lavender/90"
                    >
                      Send
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-dark-text/50">This conversation has been closed.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div className="text-dark-text/50">
                  <p className="text-lg mb-2">Select a conversation</p>
                  <p className="text-sm">Choose a conversation from the list to view and respond.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
