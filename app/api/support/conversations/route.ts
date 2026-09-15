import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportChannel = "counselor" | "admin";
type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
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
  | "is_active"
  | "created_at"
  | "updated_at"
>;

const SUPPORT_PROFILE_SELECT =
  "id,username,full_name,first_name,last_name,email,role,avatar_url,is_online,assigned_counselor_id,is_active,created_at,updated_at";

function getServiceClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!serviceRoleKey) return null;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  ) as any;
}

async function getAuthenticatedClients() {
  const authClient = createClient() as any;
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in.", status: 401 as const };
  }

  const adminClient = getServiceClient();
  if (!adminClient) {
    return {
      error:
        "Server misconfiguration: support service key not configured. Contact the system administrator.",
      status: 500 as const,
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select(SUPPORT_PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: profileError?.message || "Your user profile could not be found.",
      status: profileError ? 500 : 404,
    };
  }

  return { adminClient, authClient, user, profile: profile as SupportProfile };
}

function getConversationChannel(
  conversation: Conversation,
  profile: SupportProfile,
  recipients: Record<string, SupportProfile>
): SupportChannel {
  if (conversation.counselor_id === profile.assigned_counselor_id) {
    return "counselor";
  }

  const recipientRole = conversation.counselor_id
    ? recipients[conversation.counselor_id]?.role
    : null;

  return recipientRole === "counselor" ? "counselor" : "admin";
}

async function loadUserConversations(
  adminClient: any,
  userId: string,
  profile: SupportProfile
) {
  const { data: conversations, error: conversationsError } = await adminClient
    .from("conversations")
    .select("id,user_id,counselor_id,status,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (conversationsError) {
    return { error: conversationsError.message, status: 500 as const };
  }

  const rows = ((conversations || []) as Conversation[]).filter(
    (conversation) => conversation.user_id === userId
  );
  const recipientIds = Array.from(
    new Set(rows.map((conversation) => conversation.counselor_id).filter(Boolean))
  ) as string[];

  const recipients: Record<string, SupportProfile> = {};
  if (recipientIds.length > 0) {
    const { data: recipientRows, error: recipientsError } = await adminClient
      .from("user_profiles")
      .select(SUPPORT_PROFILE_SELECT)
      .in("id", recipientIds);

    if (recipientsError) {
      return { error: recipientsError.message, status: 500 as const };
    }

    (recipientRows || []).forEach((recipient: SupportProfile) => {
      recipients[recipient.id] = recipient;
    });
  }

  const unreadCounts: Record<string, number> = {};
  const conversationIds = rows.map((conversation) => conversation.id);

  if (conversationIds.length > 0) {
    const { data: unreadRows, error: unreadError } = await adminClient
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("is_read", false)
      .neq("sender_id", userId);

    if (unreadError) {
      return { error: unreadError.message, status: 500 as const };
    }

    (unreadRows || []).forEach((message: { conversation_id: string }) => {
      unreadCounts[message.conversation_id] =
        (unreadCounts[message.conversation_id] || 0) + 1;
    });
  }

  const typedConversations = rows.map((conversation) => ({
    ...conversation,
    channel: getConversationChannel(conversation, profile, recipients),
    unreadCount: unreadCounts[conversation.id] || 0,
  }));

  return {
    conversations: typedConversations,
    recipients,
    unreadCounts,
    profile,
  };
}

async function resolveRecipient(
  adminClient: any,
  profile: SupportProfile,
  channel: SupportChannel
) {
  if (channel === "counselor") {
    if (!profile.assigned_counselor_id) {
      return {
        error: "No counselor is assigned to your account yet.",
        status: 409 as const,
      };
    }

    const { data: counselor, error: counselorError } = await adminClient
      .from("user_profiles")
      .select(SUPPORT_PROFILE_SELECT)
      .eq("id", profile.assigned_counselor_id)
      .eq("role", "counselor")
      .maybeSingle();

    if (counselorError || !counselor) {
      return {
        error: counselorError?.message || "Assigned counselor was not found.",
        status: counselorError ? 500 : 404,
      };
    }

    return { recipient: counselor as SupportProfile };
  }

  const { data: admins, error: adminError } = await adminClient
    .from("user_profiles")
    .select(SUPPORT_PROFILE_SELECT)
    .in("role", ["owner", "admin"])
    .eq("is_active", true)
    .order("is_online", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  const admin = admins?.[0] as SupportProfile | undefined;

  if (adminError || !admin) {
    return {
      error: adminError?.message || "No active admin support recipient was found.",
      status: adminError ? 500 : 404,
    };
  }

  return { recipient: admin };
}

export async function GET() {
  const auth = await getAuthenticatedClients();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await loadUserConversations(
    auth.adminClient,
    auth.user.id,
    auth.profile
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClients();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const channel = body?.channel === "admin" ? "admin" : "counselor";
  const recipientResult = await resolveRecipient(
    auth.adminClient,
    auth.profile,
    channel
  );

  if ("error" in recipientResult) {
    return NextResponse.json(
      { error: recipientResult.error },
      { status: recipientResult.status }
    );
  }

  const recipient = recipientResult.recipient;
  const { data: existingConversations, error: existingError } =
    await auth.adminClient
      .from("conversations")
      .select("id,user_id,counselor_id,status,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .eq("counselor_id", recipient.id)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  let conversation = existingConversations?.[0] as Conversation | undefined;
  if (!conversation) {
    const { data: insertedConversation, error: insertError } =
      await auth.adminClient
        .from("conversations")
        .insert({
          user_id: auth.user.id,
          counselor_id: recipient.id,
          status: "open",
        })
        .select("id,user_id,counselor_id,status,created_at,updated_at")
        .maybeSingle();

    if (insertError || !insertedConversation) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to start support conversation." },
        { status: insertError ? 500 : 404 }
      );
    }

    conversation = insertedConversation as Conversation;
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      ...conversation,
      channel,
      unreadCount: 0,
    },
    recipient,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedClients();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId : "";

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required." },
      { status: 400 }
    );
  }

  const { data: conversation, error: conversationError } = await auth.adminClient
    .from("conversations")
    .select("id,user_id,counselor_id,status,created_at,updated_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json(
      { error: conversationError?.message || "Conversation was not found." },
      { status: conversationError ? 500 : 404 }
    );
  }

  const isParticipant =
    conversation.user_id === auth.user.id || conversation.counselor_id === auth.user.id;

  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error: updateError } = await auth.adminClient
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", auth.user.id)
    .eq("is_read", false);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
