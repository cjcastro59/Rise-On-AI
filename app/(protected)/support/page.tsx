"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default function SupportPage() {
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [phaseCounter, setPhaseCounter] = useState(0);
  const [showBanner, setShowBanner] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, UserProfile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const supabase = useMemo(() => createClient() as any, []);

  // Breathing exercise cycle
  const breathingCycle = [
    { phase: "inhale" as const, duration: 4, text: "Inhale 4s" },
    { phase: "hold1" as const, duration: 7, text: "Hold 7s" },
    { phase: "exhale" as const, duration: 8, text: "Exhale 8s" },
    { phase: "hold2" as const, duration: 1, text: "" }
  ];

  const startBreathing = () => {
    setBreathingActive(true);
    let currentPhaseIndex = 0;
    let currentPhaseCount = 0;

    const interval = setInterval(() => {
      currentPhaseCount++;
      setPhaseCounter(currentPhaseCount);
      
      if (currentPhaseCount >= breathingCycle[currentPhaseIndex].duration) {
        currentPhaseCount = 0;
        setPhaseCounter(0);
        currentPhaseIndex = (currentPhaseIndex + 1) % breathingCycle.length;
        setBreathingPhase(breathingCycle[currentPhaseIndex].phase);
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      setBreathingActive(false);
    }, 20000);
  };

  const crisisHotlines = [
    {
      name: "National Center for Mental Health",
      phone: "1553",
      description: "24/7 Crisis Hotline",
      icon: "📞"
    },
    {
      name: "In Touch Crisis Lines",
      phone: "(02) 8893-7603",
      description: "Mon-Sun, 10AM-10PM",
      icon: "💬"
    },
    {
      name: "Rise On AI Support",
      phone: "support@riseonai.com",
      description: "Email Support",
      icon: "💌",
      isEmail: true
    },
    {
      name: "Hopeline Philippines",
      phone: "2919",
      description: "24/7 Text & Call Support",
      icon: "💙"
    }
  ];

  const groundingSteps = [
    "5 things you can see",
    "4 things you can touch",
    "3 things you can hear",
    "2 things you can smell",
    "1 thing you can taste"
  ];

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
    loadOrCreateConversation();

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (conversation) {
      loadMessages();
      subscribeToMessages();
    } else {
      // Cleanup if conversation is null
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  }, [conversation]);

  useEffect(() => {
    // Fetch sender profiles for all messages
    const fetchSenderProfiles = async () => {
      const uniqueSenderIds = [...new Set(messages.map(msg => msg.sender_id))];
      if (uniqueSenderIds.length === 0) return;

      console.log("Fetching sender profiles for IDs:", uniqueSenderIds);

      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("*")
        .in("id", uniqueSenderIds);

      console.log("Fetched profiles:", profiles, "Error:", error);

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

  const loadOrCreateConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First check for an open conversation
      const { data: openConvo } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openConvo) {
        setConversation(openConvo);
      } else {
        // If no open conversation, set to null so user can start a new one
        setConversation(null);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      setConversation(null);
    }
  };

  const loadMessages = async () => {
    if (!conversation) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    if (!conversation) return;
    
    console.log("subscribeToMessages called for conversation:", conversation.id);
    
    // Cleanup previous channel
    if (channelRef.current) {
      console.log("Removing previous channel...");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel
    const channel = supabase.channel(`support:${conversation.id}`);
    
    // Add message insert handler
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversation.id}`
      },
      async (payload: any) => {
        console.log("[USER SUPPORT] New real-time message received:", payload);
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
              console.log("[USER SUPPORT] Fetched sender profile:", profile);
              setSenderProfiles((prev) => ({
                ...prev,
                [profile.id]: profile
              }));
            }
          } catch (error) {
            console.error("[USER SUPPORT] Error fetching sender profile for new message:", error);
          }
        }
        
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(msg => msg.id === newMessage.id)) {
            console.log("[USER SUPPORT] Message already exists, skipping...");
            return prev;
          }
          console.log("[USER SUPPORT] Adding new message to state:", newMessage);
          return [...prev, newMessage];
        });
      }
    );
    
    // Add conversation update handler
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${conversation.id}`
      },
      (payload: any) => {
        console.log("[USER SUPPORT] Conversation updated:", payload);
        setConversation(payload.new as Conversation);
      }
    );

    // Subscribe
    channel.subscribe((status: any, err: any) => {
      console.log("[USER SUPPORT] Realtime subscription status:", status);
      if (err) {
        console.error("[USER SUPPORT] Realtime subscription error:", err);
      }
      if (status === 'SUBSCRIBED') {
        console.log("[USER SUPPORT] Successfully subscribed to real-time support channel!");
      } else if (status === 'CHANNEL_ERROR') {
        console.error("[USER SUPPORT] Error subscribing to real-time support channel!");
      }
    });
    
    // Store channel in ref
    channelRef.current = channel;
    console.log("[USER SUPPORT] Channel stored in ref:", channelRef.current);
  };

  const startConversation = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setConversation(newConvo);
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log("Attempting to send message...");
    console.log("newMessage:", newMessage);
    console.log("conversation:", conversation);
    console.log("currentUserId:", currentUserId);
    if (!newMessage.trim() || !conversation || !currentUserId) return;

    const messageContent = newMessage.trim();
    
    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString()
    };

    console.log("Adding optimistic message:", optimisticMessage);
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      setLoading(true);
      console.log("Inserting message into Supabase...");
      
      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: currentUserId,
          content: messageContent
        })
        .select()
        .single();

      console.log("Insert result:", { data: insertedMessage, error });
      if (error) throw error;
      
      // Update conversation's updated_at timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversation.id);
      
      // Replace optimistic message with real one
      console.log("Replacing optimistic message with real one:", insertedMessage);
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === optimisticMessage.id ? insertedMessage : msg
        )
      );
      
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message if there was an error
      setMessages((prev) => prev.filter(msg => msg.id !== optimisticMessage.id));
    } finally {
      setLoading(false);
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
      {/* Banner */}
      {showBanner && (
        <div className="bg-gradient-to-r from-soft-red/10 to-pink-100 border-2 border-soft-red/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💙</div>
            <div className="flex-1">
              <h2 className="text-lg font-dm-serif text-dark-text mb-2">
                Your recent journal entry showed signs of emotional distress.
              </h2>
              <p className="text-sm font-poppins text-dark-text/70 mb-4">
                You&apos;re not alone. Here are some resources that can help - you don&apos;t have to go through this by yourself.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-gradient-to-r from-soft-red to-pink-400 hover:from-soft-red/90 hover:to-pink-500">
                  Call a Crisis Line Now
                </Button>
                <Button variant="secondary" className="bg-gradient-to-r from-gray-200 to-gray-300">
                  Chat with a Counselor
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-dark-text/40 hover:text-dark-text"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Emergency Support</h1>
          <p className="text-sm text-dark-text/60 font-poppins">
            A safe space with grounding exercises, hotlines, and resources.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="ghost" className="text-sm bg-gradient-to-r from-gray-100 to-gray-200">← Return to Dashboard</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Breathing & Grounding */}
        <div className="space-y-6">
          {/* Breathing Exercise Card */}
          <Card className="p-6 bg-gradient-to-br from-primary-blue/5 via-lavender/10 to-soft-purple/10 border border-primary-blue/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>🌬️</span>
              Breathing Exercise
            </h3>
            <p className="text-sm font-poppins text-dark-text/70 mb-6">
              Take a moment. This 4-7-8 breathing technique can help calm your nervous system.
            </p>
            <div className="flex flex-col items-center gap-6">
              <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-1000 ${
                breathingPhase === "inhale" 
                  ? "bg-gradient-to-br from-primary-blue/30 to-lavender/30 scale-100" 
                  : breathingPhase === "hold1" 
                  ? "bg-gradient-to-br from-primary-blue/40 to-lavender/40 scale-110" 
                  : breathingPhase === "exhale" 
                  ? "bg-gradient-to-br from-lavender/30 to-soft-purple/30 scale-100" 
                  : "bg-gradient-to-br from-lavender/20 to-soft-purple/20 scale-90"
              }`}>
                <div className="text-center">
                  {breathingActive ? (
                    <>
                      <div className="text-3xl font-dm-serif text-dark-text">{phaseCounter}</div>
                      <div className="text-xs font-poppins text-dark-text/60">
                        {breathingCycle.find(c => c.phase === breathingPhase)?.text}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl">Tap to start</div>
                  )}
                </div>
              </div>
              {!breathingActive && (
                <Button className="bg-gradient-to-r from-primary-blue to-lavender hover:from-primary-blue/90 hover:to-lavender/90">
                  Start Breathing Exercise
                </Button>
              )}
            </div>
          </Card>

          {/* 5-4-3-2-1 Grounding Technique */}
          <Card className="p-6 bg-gradient-to-br from-warning-yellow/10 via-soft-pink/10 to-soft-purple/10 border border-warning-yellow/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>🧘</span>
              5-4-3-2-1 Grounding Technique
            </h3>
            <p className="text-sm font-poppins text-dark-text/70 mb-4">
              Bring yourself back to the present by noticing your surroundings.
            </p>
            <div className="space-y-3">
              {groundingSteps.map((step, index) => (
                <div
                  key={index}
                  className="p-4 bg-gradient-to-r from-white/80 to-gray-50/80 rounded-xl flex items-center gap-3 border border-warning-yellow/10"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-blue/20 to-lavender/20 text-primary-blue flex items-center justify-center text-sm font-bold">
                    {5 - index}
                  </div>
                  <div className="text-sm font-poppins text-dark-text">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Middle Column: Crisis Hotlines */}
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-success-green/5 via-primary-blue/10 to-lavender/10 border border-success-green/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>📞</span>
              Philippine Crisis Hotlines
            </h3>
            <div className="space-y-3">
              {crisisHotlines.map((hotline, index) => (
                <a
                  key={index}
                  href={hotline.isEmail ? `mailto:${hotline.phone}` : `tel:${hotline.phone}`}
                  className="block p-4 bg-gradient-to-r from-primary-blue/5 to-lavender/10 rounded-xl hover:from-primary-blue/10 hover:to-lavender/20 transition-all border border-primary-blue/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{hotline.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold font-poppins text-dark-text">
                        {hotline.name}
                      </h4>
                      <p className="text-xs text-dark-text/60 font-inter">
                        {hotline.description}
                      </p>
                    </div>
                    <Button variant="secondary" className="text-xs flex-shrink-0 bg-gradient-to-r from-primary-blue to-lavender text-white hover:from-primary-blue/90 hover:to-lavender/90">
                      {hotline.isEmail ? "Email Now" : "Call Now"}
                    </Button>
                  </div>
                  <div className="mt-2 pl-12 text-lg font-semibold text-primary-blue font-poppins">
                    {hotline.phone}
                  </div>
                </a>
              ))}
            </div>
          </Card>

          {/* Quick Coping Tips */}
          <Card className="p-6 bg-gradient-to-br from-lavender/10 via-soft-pink/10 to-success-green/10 border border-lavender/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>💡</span>
              Quick Coping Tips
            </h3>
            <div className="space-y-2 text-sm font-poppins text-dark-text/70">
              <p>• Drink a glass of cold water</p>
              <p>• Step outside for fresh air</p>
              <p>• Text a trusted friend</p>
              <p>• Listen to calming music</p>
              <p>• Squeeze a stress ball or pillow</p>
            </div>
          </Card>
        </div>

        {/* Right Column: Chat with Counselor */}
        <div className="space-y-6">
          <Card className="p-6 flex flex-col h-[600px] max-h-[600px] bg-gradient-to-br from-white/90 via-gray-50/90 to-lavender/5 border border-gray-100 overflow-hidden">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2 flex-shrink-0">
              <span>💬</span>
              Chat with a Counselor
            </h3>
            
            {!conversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 overflow-auto">
                <p className="text-sm font-poppins text-dark-text/70 mb-4">
                  Need someone to talk to? Start a conversation with a counselor.
                </p>
                <Button 
                  onClick={startConversation} 
                  disabled={loading}
                  className="bg-gradient-to-r from-primary-blue to-lavender hover:from-primary-blue/90 hover:to-lavender/90"
                >
                  {loading ? "Starting..." : "Start Chat"}
                </Button>
              </div>
            ) : conversation.status === "closed" ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 overflow-auto">
                <p className="text-sm font-poppins text-dark-text/70 mb-4">
                  This conversation has been closed. You can start a new one if you need further help.
                </p>
                <Button 
                  onClick={startConversation} 
                  disabled={loading}
                  className="bg-gradient-to-r from-primary-blue to-lavender hover:from-primary-blue/90 hover:to-lavender/90"
                >
                  {loading ? "Starting..." : "Start New Chat"}
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-gray-200 pb-4 mb-4 bg-gradient-to-r from-gray-50 to-lavender/5 -mx-6 px-6 pt-0 flex-shrink-0">
                  <p className="text-xs text-dark-text/50">
                    Status: <span className="font-semibold text-success-green">Open</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 min-h-0">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-dark-text/50 py-8">
                      <p>No messages yet. Say hi to start!</p>
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

                      console.log("Message:", msg, "Sender profile:", senderProfile, "Sender name:", senderName);

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
                
                <form onSubmit={sendMessage} className="flex gap-2 flex-shrink-0">
                  <Input
                    type="text"
                    placeholder="Type your message..."
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
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-sm font-poppins text-dark-text/60 italic">
          &quot;Ikaw ay may halaga. Ang bawat araw ay isang bagong simula.&quot;
        </p>
        <p className="text-xs text-dark-text/40 font-inter mt-2">
          &quot;You have worth. Every day is a new beginning.&quot;
        </p>
      </div>
    </div>
  );
}
