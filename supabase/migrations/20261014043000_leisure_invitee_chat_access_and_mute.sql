-- Canonical event chat: invited colleagues retain read/write access after declining,
-- but are muted until they explicitly accept. No duplicate communication engine.
CREATE OR REPLACE FUNCTION public.stip_leisure_sync_series_chat(p_event uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  e public.stip_leisure_events;
  conversation uuid;
  creator uuid;
BEGIN
  SELECT * INTO e FROM public.stip_leisure_events WHERE id=p_event FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  creator:=e.organizer_agent_id;
  IF creator IS NULL THEN
    SELECT r.agent_id INTO creator FROM public.stip_leisure_responses r
    WHERE r.event_id=p_event AND NOT r.declined AND cardinality(r.selected_dates)>0
    ORDER BY r.updated_at,r.agent_id LIMIT 1;
  END IF;
  IF creator IS NULL THEN RETURN; END IF;
  SELECT conversation_id INTO conversation FROM public.stip_leisure_series_chat WHERE event_id=p_event;
  IF conversation IS NULL THEN
    INSERT INTO public.stip_conversations(kind,title,communication_family,created_by_agent_id)
    VALUES('group',left(e.title,100),e.family,creator) RETURNING id INTO conversation;
    INSERT INTO public.stip_leisure_series_chat(event_id,conversation_id)
    VALUES(p_event,conversation);
  END IF;
  UPDATE public.stip_conversations
    SET title=left(e.title,100),updated_at=now()
    WHERE id=conversation AND title IS DISTINCT FROM left(e.title,100);
  INSERT INTO public.stip_conversation_members(conversation_id,agent_id)
    SELECT conversation,candidate.agent_id FROM (
      SELECT e.organizer_agent_id AS agent_id
      UNION
      SELECT i.agent_id FROM public.stip_leisure_invites i
      WHERE i.event_id=e.id
      UNION
      SELECT r.agent_id FROM public.stip_leisure_responses r
      WHERE r.event_id=e.id AND e.visibility='team'
        AND NOT r.declined AND cardinality(r.selected_dates)>0
    ) candidate
    WHERE candidate.agent_id IS NOT NULL
    ON CONFLICT(conversation_id,agent_id) DO NOTHING;
  -- Invitations declined or pending keep the same reading/writing rights.
  -- The member-level mute flag controls message push, not group membership.
  UPDATE public.stip_conversation_members m
    SET muted = CASE
      WHEN m.agent_id=e.organizer_agent_id THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.stip_leisure_invites i
        WHERE i.event_id=e.id AND i.agent_id=m.agent_id
          AND i.status IN ('declined','pending')
      ) THEN true
      ELSE false
    END
    WHERE m.conversation_id=conversation;
  DELETE FROM public.stip_conversation_members m
    WHERE m.conversation_id=conversation AND e.status='active'
      AND NOT (
        m.agent_id=e.organizer_agent_id
        OR EXISTS (
          SELECT 1 FROM public.stip_leisure_invites i
          WHERE i.event_id=e.id AND i.agent_id=m.agent_id
        )
        OR (
          e.visibility='team' AND EXISTS (
            SELECT 1 FROM public.stip_leisure_responses r
            WHERE r.event_id=e.id AND r.agent_id=m.agent_id
              AND NOT r.declined AND cardinality(r.selected_dates)>0
          )
        )
      );
END
$function$;

-- Bring existing invitations to the same contract, including past refusals.
SELECT public.stip_leisure_sync_series_chat(e.id)
FROM public.stip_leisure_events e
WHERE EXISTS (SELECT 1 FROM public.stip_leisure_series_chat s WHERE s.event_id=e.id);
