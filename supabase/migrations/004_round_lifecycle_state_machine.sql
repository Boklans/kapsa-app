-- ============================================================================
-- KAPSA: МІГРАЦІЯ 004 — ФОРМАЛІЗАЦІЯ СТЕЙТ-МАШИНИ ЖИТТЄВОГО ЦИКЛУ РАУНДУ
-- Схема станів згідно з архітектурним аудитом:
--   [Start] -> Scheduled -> Open -> Revealed -> Archived -> [End]
-- Переходи:
--   1. Scheduled -> Open (Раунд почався о 08:00 у часовому поясі кімнати)
--   2. Open -> Revealed (Умови розкриття виконані [кворум] АБО Настав час [21:00])
--   3. Revealed -> Archived (Раунд завершений, перехід у минулу дату / історію)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.round_lifecycle_state AS ENUM ('scheduled', 'open', 'revealed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Функція детермінованого розрахунку життєвого циклу раунду на сервері
CREATE OR REPLACE FUNCTION public.compute_round_lifecycle_state(
    p_round_date DATE,
    p_reveal_at TIMESTAMPTZ,
    p_timezone TEXT DEFAULT 'Europe/Kyiv'
)
RETURNS public.round_lifecycle_state
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_now_tz TIMESTAMP;
    v_today DATE;
BEGIN
    -- Поточний локальний час у часовому поясі кімнати
    v_now_tz := timezone(p_timezone, now());
    v_today := v_now_tz::date;

    -- Стан 1: Scheduled — майбутня дата
    IF p_round_date > v_today THEN
        RETURN 'scheduled';
    END IF;

    -- Стан 4: Archived — минула дата (вчора або старіше)
    IF p_round_date < v_today THEN
        RETURN 'archived';
    END IF;

    -- Стан 3: Revealed — настав серверний час reveal_at (або достроково спрацював кворум)
    IF now() >= p_reveal_at THEN
        RETURN 'revealed';
    END IF;

    -- Стан 2: Open — день раунду настав, триває таємний збір відповідей
    RETURN 'open';
END;
$$;

-- 2. Допоміжна функція швидкого отримання поточного стану для раунду
CREATE OR REPLACE FUNCTION public.get_round_lifecycle_state(p_round_id UUID)
RETURNS public.round_lifecycle_state
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.compute_round_lifecycle_state(
        rr.round_date,
        rr.reveal_at,
        r.timezone
    )
    FROM public.room_rounds rr
    JOIN public.rooms r ON r.id = rr.room_id
    WHERE rr.id = p_round_id;
$$;

-- 3. Оновлення get_or_create_today_round з поверненням lifecycle_state
CREATE OR REPLACE FUNCTION public.get_or_create_today_round(p_room_id UUID)
RETURNS TABLE (
    round_id UUID,
    round_date DATE,
    reveal_at TIMESTAMPTZ,
    is_fully_revealed BOOLEAN,
    lifecycle_state TEXT,
    prompt_id UUID,
    prompt_format public.prompt_format,
    question_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_tz TEXT;
    v_reveal_hour INT;
    v_room_type public.room_type;
    v_today DATE;
    v_reveal_ts TIMESTAMPTZ;
    v_prompt_id UUID;
    v_round_id UUID;
    v_active_deck TEXT;
BEGIN
    IF NOT public.is_active_room_member(p_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: not an active room member';
    END IF;

    SELECT r.timezone, r.reveal_hour, r.type, COALESCE(r.active_deck, 'core')
    INTO v_tz, v_reveal_hour, v_room_type, v_active_deck
    FROM public.rooms r
    WHERE r.id = p_room_id;

    -- Обчислюємо сьогоднішню дату в часовому поясі кімнати
    v_today := (now() AT TIME ZONE v_tz)::date;

    -- Шукаємо раунд на сьогодні
    SELECT rr.id INTO v_round_id
    FROM public.room_rounds rr
    WHERE rr.room_id = p_room_id AND rr.round_date = v_today;

    -- Якщо раунду ще немає — створюємо його
    IF v_round_id IS NULL THEN
        SELECT p.id INTO v_prompt_id
        FROM public.prompts p
        WHERE p.target_type = v_room_type
          AND p.deck_tag = v_active_deck
          AND p.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM public.room_rounds old_r
              WHERE old_r.room_id = p_room_id AND old_r.prompt_id = p.id
          )
        ORDER BY random()
        LIMIT 1;

        IF v_prompt_id IS NULL THEN
            SELECT p.id INTO v_prompt_id
            FROM public.prompts p
            WHERE p.target_type = v_room_type AND p.is_active = true
            ORDER BY random()
            LIMIT 1;
        END IF;

        v_reveal_ts := ((v_today + make_interval(hours => v_reveal_hour)) AT TIME ZONE v_tz);

        BEGIN
            INSERT INTO public.room_rounds (room_id, prompt_id, round_date, reveal_at)
            VALUES (p_room_id, v_prompt_id, v_today, v_reveal_ts);
        EXCEPTION WHEN unique_violation THEN
            NULL;
        END;

        SELECT rr.id INTO v_round_id
        FROM public.room_rounds rr
        WHERE rr.room_id = p_room_id AND rr.round_date = v_today;
    END IF;

    RETURN QUERY
    SELECT
        rr.id AS round_id,
        rr.round_date,
        rr.reveal_at,
        (now() >= rr.reveal_at) AS is_fully_revealed,
        public.compute_round_lifecycle_state(rr.round_date, rr.reveal_at, v_tz)::TEXT AS lifecycle_state,
        p.id AS prompt_id,
        p.format AS prompt_format,
        p.question_text
    FROM public.room_rounds rr
    JOIN public.prompts p ON p.id = rr.prompt_id
    WHERE rr.id = v_round_id;
END;
$$;

