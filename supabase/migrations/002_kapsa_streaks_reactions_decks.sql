-- ============================================================================
-- KAPSA MIGRATION 002: Стріки кімнати, Захист is_premium, Кворум при виході
-- учасників, Безпечний Reroll, Емодзі-реакції, Штурхани та Supabase Realtime
-- ============================================================================

-- 1. Розширюємо таблицю кімнат (ROOMS): стріки та активна колода запитань
ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS streak_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_completed_date DATE,
    ADD COLUMN IF NOT EXISTS active_deck TEXT NOT NULL DEFAULT 'core';

-- 2. ЗАХИСТ ПРИВІЛЕЙОВАНИХ ПОЛІВ КІМНАТИ (is_premium, created_by, invite_code)
-- Дозволяємо власнику оновлювати базові налаштування кімнати, але блокуємо підробку is_premium з клієнта
DROP POLICY IF EXISTS "Room creator can update room settings" ON public.rooms;
CREATE POLICY "Room creator can update room settings"
ON public.rooms FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_room_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
    -- Якщо запит іде від клієнтської ролі authenticated / anon, а не від серверного service_role (RevenueCat webhook)
    IF v_jwt_role IN ('authenticated', 'anon') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_premium := false;
            NEW.streak_count := 1;
            NEW.longest_streak := 1;
            NEW.last_completed_date := NULL;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
                RAISE EXCEPTION 'Forbidden: is_premium can only be updated by a verified server entitlement';
            END IF;
            NEW.created_by := OLD.created_by;
            NEW.invite_code := OLD.invite_code;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_room_privileged_fields ON public.rooms;
CREATE TRIGGER trg_protect_room_privileged_fields
BEFORE INSERT OR UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.protect_room_privileged_fields();

-- 3. Таблиця швидких емодзі-реакцій на відкриті картки (CARD_REACTIONS)
CREATE TABLE IF NOT EXISTS public.card_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.room_rounds(id) ON DELETE CASCADE NOT NULL,
    response_id UUID REFERENCES public.round_responses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (response_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_card_reactions_round ON public.card_reactions(round_id);

ALTER TABLE public.card_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reactions on revealed rounds" ON public.card_reactions;
CREATE POLICY "Members can view reactions on revealed rounds"
ON public.card_reactions FOR SELECT TO authenticated
USING (
    public.is_active_room_member(room_id, auth.uid())
    AND public.can_reveal_round(round_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can add reactions to revealed responses" ON public.card_reactions;
CREATE POLICY "Members can add reactions to revealed responses"
ON public.card_reactions FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_room_member(room_id, auth.uid())
    AND public.can_reveal_round(round_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can remove own reactions" ON public.card_reactions;
CREATE POLICY "Members can remove own reactions"
ON public.card_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 4. Таблиця "Штурханів" (ROOM_NUDGES) для нагадування друзям, які ще не відповіли
CREATE TABLE IF NOT EXISTS public.room_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.room_rounds(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_id, from_user_id, to_user_id)
);

ALTER TABLE public.room_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room members can view nudges in their room" ON public.room_nudges;
CREATE POLICY "Room members can view nudges in their room"
ON public.room_nudges FOR SELECT TO authenticated
USING (public.is_active_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Room members can send nudges" ON public.room_nudges;
CREATE POLICY "Room members can send nudges"
ON public.room_nudges FOR INSERT TO authenticated
WITH CHECK (
    from_user_id = auth.uid()
    AND public.is_active_room_member(room_id, auth.uid())
);

-- 5. ЯДРО КВОРУМУ: Прив'язка до активних учасників + перерахунок при виході/кіку учасника
CREATE OR REPLACE FUNCTION public.evaluate_round_quorum(p_room_id UUID, p_round_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_active_members INT;
    v_active_responses INT;
    v_round_date DATE;
    v_last_date DATE;
    v_current_streak INT;
BEGIN
    IF p_room_id IS NULL OR p_round_id IS NULL THEN
        RETURN;
    END IF;

    -- Кількість поточних активних учасників кімнати
    SELECT count(*) INTO v_active_members
    FROM public.room_members
    WHERE room_id = p_room_id AND status = 'active';

    -- Кількість активних відповідей у раунді ТІЛЬКИ від поточних активних учасників кімнати
    SELECT count(*) INTO v_active_responses
    FROM public.round_responses resp
    JOIN public.room_members rm
      ON rm.room_id = resp.room_id
     AND rm.user_id = resp.user_id
    WHERE resp.round_id = p_round_id
      AND rm.status = 'active'
      AND resp.is_skipped = false;

    -- Якщо в кімнаті >= 2 активних учасників і всі вони відповіли — відкриваємо капсулу
    IF v_active_members >= 2 AND v_active_responses >= v_active_members THEN
        UPDATE public.room_rounds
        SET reveal_at = LEAST(reveal_at, now())
        WHERE id = p_round_id
        RETURNING round_date INTO v_round_date;

        SELECT last_completed_date, streak_count
        INTO v_last_date, v_current_streak
        FROM public.rooms
        WHERE id = p_room_id;

        IF v_round_date IS NOT NULL AND v_last_date IS DISTINCT FROM v_round_date THEN
            IF v_last_date = (v_round_date - INTERVAL '1 day')::date THEN
                v_current_streak := v_current_streak + 1;
            ELSE
                v_current_streak := 1;
            END IF;

            UPDATE public.rooms
            SET streak_count = v_current_streak,
                longest_streak = GREATEST(longest_streak, v_current_streak),
                last_completed_date = v_round_date
            WHERE id = p_room_id;
        END IF;
    END IF;
END;
$$;

-- Тригер 5A: Перевірка кворуму після нової відповіді
CREATE OR REPLACE FUNCTION public.handle_quorum_reveal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.evaluate_round_quorum(NEW.room_id, NEW.round_id);
    RETURN NEW;
END;
$$;

-- Тригер 5B: Перерахунок кворуму, якщо учасник вийшов (status = 'left') або був видалений посеред раунду
CREATE OR REPLACE FUNCTION public.handle_member_status_quorum_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id UUID := COALESCE(NEW.room_id, OLD.room_id);
    v_open_round_id UUID;
BEGIN
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
        SELECT id INTO v_open_round_id
        FROM public.room_rounds
        WHERE room_id = v_room_id
          AND reveal_at > now()
        ORDER BY round_date DESC
        LIMIT 1;

        IF v_open_round_id IS NOT NULL THEN
            PERFORM public.evaluate_round_quorum(v_room_id, v_open_round_id);
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_member_status_quorum_recalc ON public.room_members;
CREATE TRIGGER trg_member_status_quorum_recalc
AFTER UPDATE OF status OR DELETE ON public.room_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_member_status_quorum_recalc();

-- 6. БЕЗПЕЧНИЙ REROLL: Заборонено змінювати питання дня, якщо хтось уже відповів у раунді
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

    -- КРИТИЧНА ПЕРЕВІРКА БЕЗПЕКИ: якщо в раунді вже є хоча б одна відповідь — reroll заборонено!
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

REVOKE ALL ON FUNCTION public.evaluate_round_quorum(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reroll_today_round(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroll_today_round(UUID, TEXT) TO authenticated;

-- 7. Дозволяємо власнику файла перезаписувати власне фото раунду в Storage
DROP POLICY IF EXISTS "Active members can update own round photo" ON storage.objects;
CREATE POLICY "Active members can update own round photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'room-media'
    AND owner = auth.uid()
)
WITH CHECK (
    bucket_id = 'room-media'
    AND public.is_active_room_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- 8. Вмикаємо Supabase Realtime для миттєвого оновлення без перезавантаження
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_rounds;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_responses;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.card_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Додаткові колоди запитань (SPICY 🔥, DEEP 🌙, NOSTALGIA 📼, ІДЕМПОТЕНТНО)
INSERT INTO public.prompts (target_type, format, question_text, deck_tag, is_premium)
SELECT v.target_type::public.room_type, v.format::public.prompt_format, v.question_text, v.deck_tag, v.is_premium
FROM (VALUES
    -- FRIENDS: SPICY 🔥
    ('friends', 'vote', 'Хто з нас першим би вибовкав секрет через 5 хвилин після слів "тільки нікому"? 🤫', 'spicy', false),
    ('friends', 'vote', 'Хто з компанії найімовірніше почне зустрічатися з колишнім/колишньою друга? 👀', 'spicy', true),
    ('friends', 'answer', 'Який найбільш крінжовий підкат або повідомлення ти коли-небудь отримував(ла) в дірект? 💀', 'spicy', false),
    -- FRIENDS: NOSTALGIA 📼
    ('friends', 'answer', 'Який день або вечір нашої компанії ти б хотів(ла) прожити ще раз від початку до кінця? 📼', 'nostalgia', false),
    ('friends', 'vote', 'Хто з нас найбільше змінився з моменту нашого першого знайомства? ⏳', 'nostalgia', false),
    -- COUPLE: DEEP 🌙
    ('couple', 'answer', 'У який момент ти вперше зрозумів(ла), що закохався(лася) в мене по-справжньому? 🌙', 'deep', false),
    ('couple', 'vote', 'Хто з нас двох більше переживає через дрібниці, але приховує це за усмішкою? 🫂', 'deep', false),
    -- COUPLE: SPICY 🌶️
    ('couple', 'answer', 'Яке місце або ідею для побачення лише для нас двох ти давно хочеш спробувати? 🔥', 'spicy', true),
    ('couple', 'vote', 'Хто з нас першим знімає офіційний тон і починає фліртувати посеред робочого дня? 😏', 'spicy', false)
) AS v(target_type, format, question_text, deck_tag, is_premium)
WHERE NOT EXISTS (
    SELECT 1 FROM public.prompts p WHERE p.question_text = v.question_text
);
