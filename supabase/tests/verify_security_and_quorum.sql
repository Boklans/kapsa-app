-- ============================================================================
-- KAPSA: ОНОВЛЕННЯ RPC (#variable_conflict) + АВТОМАТИЧНИЙ ТЕСТ БЕЗПЕКИ ТА КВОРУМУ
-- Інструкція: Очисти поточну вкладку SQL Editor (Ctrl+A -> Backspace), встав цей файл і натисни Run.
-- ============================================================================

-- 1. Оновлюємо RPC-функції з директивою #variable_conflict use_column (зберігається в БД назавжди)
CREATE OR REPLACE FUNCTION public.get_or_create_today_round(p_room_id UUID)
RETURNS TABLE (
    round_id UUID,
    round_date DATE,
    reveal_at TIMESTAMPTZ,
    is_fully_revealed BOOLEAN,
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
BEGIN
    IF NOT public.is_active_room_member(p_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: not an active room member';
    END IF;

    SELECT r.timezone, r.reveal_hour, r.type
    INTO v_tz, v_reveal_hour, v_room_type
    FROM public.rooms r
    WHERE r.id = p_room_id;

    v_today := (now() AT TIME ZONE v_tz)::date;

    SELECT rr.id INTO v_round_id
    FROM public.room_rounds rr
    WHERE rr.room_id = p_room_id AND rr.round_date = v_today;

    IF v_round_id IS NULL THEN
        SELECT p.id INTO v_prompt_id
        FROM public.prompts p
        WHERE p.target_type = v_room_type
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
        p.id AS prompt_id,
        p.format AS prompt_format,
        p.question_text
    FROM public.room_rounds rr
    JOIN public.prompts p ON p.id = rr.prompt_id
    WHERE rr.id = v_round_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_round_cards(p_round_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_emoji TEXT,
    has_answered BOOLEAN,
    is_skipped BOOLEAN,
    answered_at TIMESTAMPTZ,
    is_revealed BOOLEAN,
    response_id UUID,
    text_content TEXT,
    has_media BOOLEAN,
    media_path TEXT,
    voted_for_user_id UUID,
    voted_for_name TEXT,
    is_pinned_to_lore BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_room_id UUID;
    v_can_reveal BOOLEAN;
BEGIN
    SELECT r.room_id INTO v_room_id
    FROM public.room_rounds r
    WHERE r.id = p_round_id;

    IF v_room_id IS NULL OR NOT public.is_active_room_member(v_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied or round not found';
    END IF;

    v_can_reveal := public.can_reveal_round(p_round_id, auth.uid());

    RETURN QUERY
    SELECT
        rm.user_id,
        rm.display_name,
        rm.avatar_emoji,
        (resp.id IS NOT NULL) AS has_answered,
        COALESCE(resp.is_skipped, false) AS is_skipped,
        resp.created_at AS answered_at,
        (resp.id IS NOT NULL AND (v_can_reveal OR rm.user_id = auth.uid())) AS is_revealed,
        resp.id AS response_id,
        CASE WHEN (v_can_reveal OR rm.user_id = auth.uid()) THEN resp.text_content ELSE NULL END,
        (resp.media_path IS NOT NULL) AS has_media,
        CASE WHEN (v_can_reveal OR rm.user_id = auth.uid()) THEN resp.media_path ELSE NULL END,
        CASE WHEN (v_can_reveal OR rm.user_id = auth.uid()) THEN resp.voted_for_user_id ELSE NULL END,
        CASE WHEN (v_can_reveal OR rm.user_id = auth.uid()) THEN target_m.display_name ELSE NULL END,
        EXISTS (
            SELECT 1 FROM public.lore_items li
            WHERE li.room_id = v_room_id AND li.response_id = resp.id
        ) AS is_pinned_to_lore
    FROM public.room_members rm
    LEFT JOIN public.round_responses resp
        ON resp.round_id = p_round_id AND resp.user_id = rm.user_id
    LEFT JOIN public.room_members target_m
        ON target_m.room_id = v_room_id AND target_m.user_id = resp.voted_for_user_id
    WHERE rm.room_id = v_room_id
      AND rm.status = 'active'
    ORDER BY resp.created_at ASC NULLS LAST, rm.joined_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.reroll_today_round(
    p_room_id UUID,
    p_deck_tag TEXT DEFAULT NULL
)
RETURNS TABLE (
    round_id UUID,
    round_date DATE,
    reveal_at TIMESTAMPTZ,
    is_fully_revealed BOOLEAN,
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
    v_room_type public.room_type;
    v_deck TEXT;
    v_today DATE;
    v_round_id UUID;
    v_old_prompt_id UUID;
    v_new_prompt_id UUID;
BEGIN
    IF NOT public.is_active_room_member(p_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: not an active room member';
    END IF;

    SELECT r.timezone, r.type, r.active_deck
    INTO v_tz, v_room_type, v_deck
    FROM public.rooms r
    WHERE r.id = p_room_id;

    v_today := (now() AT TIME ZONE v_tz)::date;

    SELECT rr.id, rr.prompt_id INTO v_round_id, v_old_prompt_id
    FROM public.room_rounds rr
    WHERE rr.room_id = p_room_id AND rr.round_date = v_today;

    IF v_round_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.round_responses resp WHERE resp.round_id = v_round_id
    ) THEN
        RAISE EXCEPTION 'Неможливо змінити питання: учасники вже почали відповідати в сьогоднішньому раунді';
    END IF;

    IF p_deck_tag IS NOT NULL THEN
        UPDATE public.rooms SET active_deck = p_deck_tag WHERE id = p_room_id;
        v_deck := p_deck_tag;
    END IF;

    SELECT p.id INTO v_new_prompt_id
    FROM public.prompts p
    WHERE p.target_type = v_room_type
      AND p.is_active = true
      AND (v_deck = 'all' OR p.deck_tag = v_deck)
      AND p.id IS DISTINCT FROM v_old_prompt_id
    ORDER BY random()
    LIMIT 1;

    IF v_new_prompt_id IS NULL THEN
        SELECT p.id INTO v_new_prompt_id
        FROM public.prompts p
        WHERE p.target_type = v_room_type
          AND p.is_active = true
          AND p.id IS DISTINCT FROM v_old_prompt_id
        ORDER BY random()
        LIMIT 1;
    END IF;

    IF v_round_id IS NOT NULL AND v_new_prompt_id IS NOT NULL THEN
        UPDATE public.room_rounds SET prompt_id = v_new_prompt_id WHERE id = v_round_id;
    END IF;

    RETURN QUERY SELECT * FROM public.get_or_create_today_round(p_room_id);
END;
$$;

-- 2. ПРОГОНЯЄМО АВТОМАТИЧНІ ТЕСТИ БЕЗПЕКИ (ІЗ ОЧИЩЕННЯМ ТЕСТОВИХ ДАНИХ У КІНЦІ)
DO $$
DECLARE
    v_user1 UUID := '00000000-0000-0000-0000-000000000001';
    v_user2 UUID := '00000000-0000-0000-0000-000000000002';
    v_user3 UUID := '00000000-0000-0000-0000-000000000003';
    v_stranger UUID := '00000000-0000-0000-0000-000000000099';
    v_room_id UUID;
    v_invite_code TEXT;
    v_round_id UUID;
    v_is_premium BOOLEAN;
    v_leaked_text TEXT;
    v_is_revealed BOOLEAN;
    v_reroll_blocked BOOLEAN := false;
    v_premium_blocked BOOLEAN := false;
BEGIN
    INSERT INTO auth.users (id, email, role, aud)
    VALUES
        (v_user1, 'u1@kapsa.test', 'authenticated', 'authenticated'),
        (v_user2, 'u2@kapsa.test', 'authenticated', 'authenticated'),
        (v_user3, 'u3@kapsa.test', 'authenticated', 'authenticated'),
        (v_stranger, 'stranger@kapsa.test', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user1::text, true);

    -- ТЕСТ 1 (P0): Захист is_premium на INSERT та UPDATE
    INSERT INTO public.rooms (name, type, is_premium, created_by, reveal_hour)
    VALUES ('Тестова Банда', 'friends', true, v_user1, 23)
    RETURNING id, invite_code, is_premium INTO v_room_id, v_invite_code, v_is_premium;

    IF v_is_premium = true THEN
        RAISE EXCEPTION 'FAIL [Test 1A]: Клієнт зміг створити кімнату з is_premium = true!';
    END IF;

    BEGIN
        UPDATE public.rooms SET is_premium = true WHERE id = v_room_id;
    EXCEPTION WHEN OTHERS THEN
        v_premium_blocked := true;
    END;

    IF NOT v_premium_blocked THEN
        RAISE EXCEPTION 'FAIL [Test 1B]: Клієнт зміг змінити is_premium через UPDATE!';
    END IF;

    INSERT INTO public.room_members (room_id, user_id, display_name, avatar_emoji)
    VALUES (v_room_id, v_user1, 'Алекс', '😎');

    PERFORM set_config('request.jwt.claim.sub', v_user2::text, true);
    PERFORM public.join_room_by_code(v_invite_code, 'Макс', '🦊');

    PERFORM set_config('request.jwt.claim.sub', v_user3::text, true);
    PERFORM public.join_room_by_code(v_invite_code, 'Діма', '🍕');

    -- Генеруємо сьогоднішній раунд
    SELECT r.round_id INTO v_round_id FROM public.get_or_create_today_round(v_room_id) r;

    -- User 1 робить хід
    PERFORM set_config('request.jwt.claim.sub', v_user1::text, true);
    INSERT INTO public.round_responses (round_id, room_id, user_id, text_content, voted_for_user_id)
    VALUES (v_round_id, v_room_id, v_user1, 'Секретна відповідь Алекса', v_user2);

    -- ТЕСТ 2 (P0): User 2 ще НЕ відповів — перевіряємо, що він НЕ бачить текст відповіді User 1
    PERFORM set_config('request.jwt.claim.sub', v_user2::text, true);
    SELECT c.text_content, c.is_revealed INTO v_leaked_text, v_is_revealed
    FROM public.get_round_cards(v_round_id) c
    WHERE c.user_id = v_user1;

    IF v_leaked_text IS NOT NULL OR v_is_revealed = true THEN
        RAISE EXCEPTION 'FAIL [Test 2]: Відповідь User 1 витекла до того, як User 2 зробив свій хід!';
    END IF;

    -- ТЕСТ 3 (P0): Спроба викликати reroll_today_round, коли вже є відповідь, має бути заблокована
    BEGIN
        PERFORM public.reroll_today_round(v_room_id, 'spicy');
    EXCEPTION WHEN OTHERS THEN
        v_reroll_blocked := true;
    END;

    IF NOT v_reroll_blocked THEN
        RAISE EXCEPTION 'FAIL [Test 3]: reroll_today_round дозволив скинути раунд із наявними відповідями!';
    END IF;

    -- ТЕСТ 4: Щойно User 2 відповідає — йому миттєво відкривається відповідь User 1
    INSERT INTO public.round_responses (round_id, room_id, user_id, text_content, voted_for_user_id)
    VALUES (v_round_id, v_room_id, v_user2, 'Відповідь Макса', v_user3);

    SELECT c.text_content, c.is_revealed INTO v_leaked_text, v_is_revealed
    FROM public.get_round_cards(v_round_id) c
    WHERE c.user_id = v_user1;

    IF v_leaked_text IS NULL OR v_is_revealed = false THEN
        RAISE EXCEPTION 'FAIL [Test 4]: Після власного ходу User 2 не побачив відкриту картку User 1!';
    END IF;

    -- ТЕСТ 5 (P0): User 3 (який ще не відповідав) виходить із кімнати (status = 'left').
    -- Оскільки активних залишилося 2 з 2, раунд має автоматично стати is_fully_revealed = true!
    PERFORM set_config('request.jwt.claim.sub', v_user3::text, true);
    UPDATE public.room_members
    SET status = 'left'
    WHERE room_id = v_room_id AND user_id = v_user3;

    PERFORM set_config('request.jwt.claim.sub', v_user1::text, true);
    SELECT r.is_fully_revealed INTO v_is_revealed
    FROM public.get_or_create_today_round(v_room_id) r;

    IF v_is_revealed = false THEN
        RAISE EXCEPTION 'FAIL [Test 5]: Після виходу неактивного учасника кворум не перерахувався автоматично!';
    END IF;

    -- Очищаємо тестові дані
    PERFORM set_config('request.jwt.claim.role', 'postgres', true);
    DELETE FROM public.rooms WHERE id = v_room_id;
    DELETE FROM auth.users WHERE id IN (v_user1, v_user2, v_user3, v_stranger);
END $$;

SELECT
    '✅ PASS' AS status,
    'Усі 5 тестів безпеки (is_premium, маскування відповідей, захист reroll, розкриття та перерахунок кворуму при виході учасника) успішно пройдено!' AS verification_summary;
