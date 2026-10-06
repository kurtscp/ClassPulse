-- 1. create_session
create or replace function create_session(p_class_name text, p_meet_link text)
returns sessions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_class_name text := trim(p_class_name);
    v_code text;
    v_session sessions;
    v_uid uuid := auth.uid();
    v_attempts int := 0;
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    if length(v_class_name) < 1 or length(v_class_name) > 100 then
        raise exception 'Class name must be between 1 and 100 characters';
    end if;

    loop
        v_attempts := v_attempts + 1;
        -- generate 3 letters + '-' + 4 digits
        v_code := chr(floor(random() * 26 + 65)::integer) ||
                  chr(floor(random() * 26 + 65)::integer) ||
                  chr(floor(random() * 26 + 65)::integer) || '-' ||
                  lpad(floor(random() * 10000)::integer::text, 4, '0');
        
        begin
            insert into sessions (instructor_id, class_name, meet_link, class_code)
            values (v_uid, v_class_name, p_meet_link, v_code)
            returning * into v_session;
            
            return v_session;
        exception when unique_violation then
            if v_attempts >= 10 then
                raise exception 'Failed to generate unique class code';
            end if;
        end;
    end loop;
end;
$$;

-- 2. join_session
create or replace function join_session(p_class_code text, p_student_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(p_class_code));
    v_name text := trim(p_student_name);
    v_session record;
    v_participant_id uuid;
    v_token uuid;
begin
    if length(v_name) < 1 or length(v_name) > 60 then
        raise exception 'Student name must be between 1 and 60 characters';
    end if;

    select id, class_name, meet_link, status into v_session from sessions where class_code = v_code;

    if not found then
        raise exception 'Session not found';
    end if;

    if v_session.status = 'ended' then
        raise exception 'Session has ended';
    end if;

    insert into participants (session_id, student_name)
    values (v_session.id, v_name)
    returning id into v_participant_id;

    insert into participant_tokens (participant_id)
    values (v_participant_id)
    returning token into v_token;

    return jsonb_build_object(
        'participant_id', v_participant_id,
        'token', v_token,
        'session_id', v_session.id,
        'class_name', v_session.class_name,
        'meet_link', v_session.meet_link
    );
end;
$$;

-- 3. send_heartbeat
create or replace function send_heartbeat(
    p_token uuid,
    p_meet_tab_open boolean,
    p_meet_tab_focused boolean,
    p_system_state text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_participant record;
    v_session_status text;
    v_state text;
    v_pending_checkin record;
begin
    select p.id, p.session_id, p.unfocused_since, p.idle_since 
    into v_participant
    from participants p
    join participant_tokens pt on p.id = pt.participant_id
    where pt.token = p_token;

    if not found then
        raise exception 'Invalid token';
    end if;

    select status into v_session_status from sessions where id = v_participant.session_id;
    
    if v_session_status = 'ended' then
        return jsonb_build_object('session_status', 'ended', 'pending_checkin', null);
    end if;

    v_state := p_system_state;
    if v_state not in ('active', 'idle', 'locked') then
        v_state := 'active';
    end if;

    insert into heartbeats (participant_id, session_id, meet_tab_open, meet_tab_focused, system_state)
    values (v_participant.id, v_participant.session_id, p_meet_tab_open, p_meet_tab_focused, v_state);

    update participants
    set last_seen_at = now(),
        meet_tab_open = p_meet_tab_open,
        meet_tab_focused = p_meet_tab_focused,
        system_state = v_state,
        unfocused_since = case when p_meet_tab_focused then null else coalesce(unfocused_since, now()) end,
        idle_since = case when v_state = 'active' then null else coalesce(idle_since, now()) end
    where id = v_participant.id;

    select id, sent_at, expires_at into v_pending_checkin
    from checkins c
    where c.session_id = v_participant.session_id
      and c.expires_at > now()
      and not exists (
          select 1 from checkin_responses cr
          where cr.checkin_id = c.id and cr.participant_id = v_participant.id
      )
    order by c.sent_at desc
    limit 1;

    if found then
        return jsonb_build_object(
            'session_status', 'live',
            'pending_checkin', jsonb_build_object(
                'id', v_pending_checkin.id,
                'sent_at', v_pending_checkin.sent_at,
                'expires_at', v_pending_checkin.expires_at
            )
        );
    else
        return jsonb_build_object(
            'session_status', 'live',
            'pending_checkin', null
        );
    end if;
end;
$$;

-- 4. respond_checkin
create or replace function respond_checkin(p_token uuid, p_checkin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_participant record;
    v_checkin record;
begin
    select p.id, p.session_id into v_participant
    from participants p
    join participant_tokens pt on p.id = pt.participant_id
    where pt.token = p_token;

    if not found then
        raise exception 'Invalid token';
    end if;

    select id into v_checkin
    from checkins
    where id = p_checkin_id 
      and session_id = v_participant.session_id
      and expires_at > now();

    if not found then
        return false;
    end if;

    begin
        insert into checkin_responses (checkin_id, participant_id)
        values (p_checkin_id, v_participant.id);
        return true;
    exception when unique_violation then
        return true;
    end;
end;
$$;

-- Permissions
revoke execute on function create_session(text, text) from public;
revoke execute on function join_session(text, text) from public;
revoke execute on function send_heartbeat(uuid, boolean, boolean, text) from public;
revoke execute on function respond_checkin(uuid, uuid) from public;

grant execute on function create_session(text, text) to authenticated;
grant execute on function join_session(text, text) to anon, authenticated;
grant execute on function send_heartbeat(uuid, boolean, boolean, text) to anon, authenticated;
grant execute on function respond_checkin(uuid, uuid) to anon, authenticated;
