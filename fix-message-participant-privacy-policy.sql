-- Restricts chat message visibility to conversation participants only:
-- the user who owns the conversation and the assigned counselor.
-- Conversation lists are scoped in the app UI; message content is enforced here.

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Counselors/admins can view all messages" ON public.messages;

CREATE POLICY "Participants can view messages from their conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND (
          public.conversations.user_id = auth.uid()
          OR public.conversations.counselor_id = auth.uid()
        )
        AND public.messages.sender_id IN (
          public.conversations.user_id,
          public.conversations.counselor_id
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Counselors/admins can insert messages" ON public.messages;

CREATE POLICY "Participants can insert messages to their conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND (
          public.conversations.user_id = auth.uid()
          OR public.conversations.counselor_id = auth.uid()
        )
    )
  );
