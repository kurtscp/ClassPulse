-- Migration 401: get_session_report function (Track C)
create or replace function get_session_report(p_session_id uuid)
returns table (
    student_name text,
    joined boolean,
    joined_at timestamptz,
    last_seen_at timestamptz,
    tracked_seconds numeric,
    active_seconds numeric,
    distracted_seconds numeric,
    idle_seconds numeric,
    offline_seconds numeric,
    attendance_pct numeric,
    checkins_sent integer,
    checkins_answered integer,
    avg_checkin_response_seconds numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_session record;
    v_session_end timestamptz;
    v_session_duration numeric;
    v_distracted_thresh numeric;
    v_idle_thresh numeric;
    v_offline_thresh numeric;
    v_checkins_sent integer;
begin
    -- 1. Fetch session under RLS (security invoker ensures instructor owns it)
    select s.id, s.started_at, s.ended_at, s.settings, s.roster_id
    into v_session
    from sessions s
    where s.id = p_session_id;

    if not found then
        return;
    end if;

    -- 2. Determine session boundaries and effective thresholds
    v_session_end := coalesce(v_session.ended_at, now());
    v_session_duration := greatest(0.0, extract(epoch from (v_session_end - v_session.started_at)));

    v_distracted_thresh := greatest(1.0, coalesce((v_session.settings->>'distracted_after_seconds')::numeric, 60.0));
    v_idle_thresh := greatest(1.0, coalesce((v_session.settings->>'idle_after_seconds')::numeric, 180.0));
    v_offline_thresh := greatest(1.0, coalesce((v_session.settings->>'offline_after_seconds')::numeric, 90.0));

    -- 3. Total check-ins sent in this session
    select count(*)::integer
    into v_checkins_sent
    from checkins
    where session_id = p_session_id;

    -- 4. Calculate report rows using CTEs and window functions
    return query
    with participant_heartbeats as (
        select
            h.id,
            h.participant_id,
            h.meet_tab_open,
            h.meet_tab_focused,
            h.system_state,
            h.created_at,
            coalesce(
                lead(h.created_at) over (partition by h.participant_id order by h.created_at, h.id),
                v_session_end
            ) as next_created_at
        from heartbeats h
        where h.session_id = p_session_id
    ),
    heartbeat_islands as (
        select
            ph.*,
            sum(case when not (ph.meet_tab_open and not ph.meet_tab_focused) then 1 else 0 end)
                over (partition by ph.participant_id order by ph.created_at, ph.id) as unfocused_grp,
            sum(case when ph.system_state = 'active' then 1 else 0 end)
                over (partition by ph.participant_id order by ph.created_at, ph.id) as idle_grp
        from participant_heartbeats ph
    ),
    heartbeats_with_streaks as (
        select
            hi.*,
            case
                when hi.meet_tab_open and not hi.meet_tab_focused then
                    min(hi.created_at) over (partition by hi.participant_id, hi.unfocused_grp)
                else null
            end as unfocused_since,
            case
                when hi.system_state in ('idle', 'locked') then
                    min(hi.created_at) over (partition by hi.participant_id, hi.idle_grp)
                else null
            end as idle_since
        from heartbeat_islands hi
    ),
    interval_classified as (
        select
            hws.participant_id,
            greatest(0.0, extract(epoch from (hws.next_created_at - hws.created_at))) as raw_dur,
            case
                when not hws.meet_tab_open then 'offline'
                when (hws.meet_tab_open and not hws.meet_tab_focused)
                     and extract(epoch from (hws.created_at - hws.unfocused_since)) > v_distracted_thresh
                     then 'distracted'
                when hws.system_state in ('idle', 'locked')
                     and extract(epoch from (hws.created_at - hws.idle_since)) > v_idle_thresh
                     then 'idle'
                else 'active'
            end as interval_status
        from heartbeats_with_streaks hws
    ),
    interval_durations as (
        select
            ic.participant_id,
            ic.raw_dur,
            least(ic.raw_dur, v_offline_thresh) as clamped_dur,
            greatest(0.0, ic.raw_dur - v_offline_thresh) as excess_offline,
            ic.interval_status
        from interval_classified ic
    ),
    participant_aggregates as (
        select
            idr.participant_id,
            round(sum(case when idr.interval_status = 'active' then idr.clamped_dur else 0.0 end))::numeric as active_seconds,
            round(sum(case when idr.interval_status = 'distracted' then idr.clamped_dur else 0.0 end))::numeric as distracted_seconds,
            round(sum(case when idr.interval_status = 'idle' then idr.clamped_dur else 0.0 end))::numeric as idle_seconds,
            round(sum(case when idr.interval_status = 'offline' then idr.raw_dur else idr.excess_offline end))::numeric as offline_seconds,
            round(sum(idr.raw_dur))::numeric as tracked_seconds
        from interval_durations idr
        group by idr.participant_id
    ),
    participant_checkins as (
        select
            cr.participant_id,
            count(*)::integer as checkins_answered,
            round(avg(greatest(0.0, extract(epoch from (cr.responded_at - c.sent_at))))::numeric, 1) as avg_checkin_response_seconds
        from checkin_responses cr
        join checkins c on c.id = cr.checkin_id
        where c.session_id = p_session_id
        group by cr.participant_id
    ),
    joined_participants as (
        select
            p.student_name,
            true as joined,
            p.joined_at,
            p.last_seen_at,
            coalesce(pa.tracked_seconds, 0)::numeric as tracked_seconds,
            coalesce(pa.active_seconds, 0)::numeric as active_seconds,
            coalesce(pa.distracted_seconds, 0)::numeric as distracted_seconds,
            coalesce(pa.idle_seconds, 0)::numeric as idle_seconds,
            coalesce(pa.offline_seconds, 0)::numeric as offline_seconds,
            case
                when v_session_duration > 0 then
                    least(100.0, round(((coalesce(pa.active_seconds, 0) + coalesce(pa.distracted_seconds, 0) + coalesce(pa.idle_seconds, 0)) * 100.0 / v_session_duration)::numeric, 1))
                else 0.0
            end as attendance_pct,
            v_checkins_sent as checkins_sent,
            coalesce(pc.checkins_answered, 0) as checkins_answered,
            pc.avg_checkin_response_seconds
        from participants p
        left join participant_aggregates pa on pa.participant_id = p.id
        left join participant_checkins pc on pc.participant_id = p.id
        where p.session_id = p_session_id
    ),
    unjoined_roster as (
        select
            re.student_name,
            false as joined,
            null::timestamptz as joined_at,
            null::timestamptz as last_seen_at,
            0::numeric as tracked_seconds,
            0::numeric as active_seconds,
            0::numeric as distracted_seconds,
            0::numeric as idle_seconds,
            0::numeric as offline_seconds,
            0.0::numeric as attendance_pct,
            v_checkins_sent as checkins_sent,
            0 as checkins_answered,
            null::numeric as avg_checkin_response_seconds
        from roster_entries re
        where re.roster_id = v_session.roster_id
          and not exists (
              select 1
              from participants p
              where p.session_id = p_session_id
                and lower(trim(p.student_name)) = lower(trim(re.student_name))
          )
    )
    select * from joined_participants
    union all
    select * from unjoined_roster
    order by joined desc, student_name asc;
end;
$$;

-- Grant permissions for authenticated and anon users
revoke execute on function get_session_report(uuid) from public;
grant execute on function get_session_report(uuid) to authenticated, anon;