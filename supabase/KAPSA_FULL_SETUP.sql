-- ============================================================================
-- KAPSA: Повна SQL-схема, RLS-безпека, RPC-функції та стартові запитання
-- ============================================================================

-- 1. ТИПИ ДАНИХ (ENUMS)
DO $$ BEGIN
    CREATE TYPE public.room_type AS ENUM ('friends', 'couple');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.prompt_format AS ENUM ('vote', 'show', 'answer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.member_status AS ENUM ('active', 'left', 'kicked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ТАБЛИЦЯ КІМНАТ (ROOMS)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
    type public.room_type NOT NULL DEFAULT 'friends',
    invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
    timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    reveal_hour INT NOT NULL DEFAULT 21 CHECK (reveal_hour BETWEEN 0 AND 23),
    is_premium BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. УЧАСНИКИ КІМНАТИ (ROOM_MEMBERS)
CREATE TABLE IF NOT EXISTS public.room_members (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 32),
    avatar_emoji TEXT NOT NULL DEFAULT '😎',
    status public.member_status NOT NULL DEFAULT 'active',
    push_token TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

-- 4. БІБЛІОТЕКА ЗАПИТАНЬ (PROMPTS)
CREATE TABLE IF NOT EXISTS public.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type public.room_type NOT NULL,
    format public.prompt_format NOT NULL,
    question_text TEXT NOT NULL,
    deck_tag TEXT NOT NULL DEFAULT 'core', -- 'core', 'spicy', 'deep', 'long_distance'
    is_premium BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ЩОДЕННІ РАУНДИ КІМНАТИ (ROOM_ROUNDS)
CREATE TABLE IF NOT EXISTS public.room_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    prompt_id UUID REFERENCES public.prompts(id) NOT NULL,
    round_date DATE NOT NULL,
    reveal_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, round_date)
);

-- 6. ВІДПОВІДІ ТА ГОЛОСИ УЧАСНИКІВ (ROUND_RESPONSES)
CREATE TABLE IF NOT EXISTS public.round_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES public.room_rounds(id) ON DELETE CASCADE NOT NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text_content TEXT CHECK (text_content IS NULL OR char_length(text_content) <= 400),
    media_path TEXT,
    voted_for_user_id UUID,
    is_skipped BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_id, user_id),
    -- Гарантуємо, що и сам гравець, і той, за кого він голосує, належать до цієї ж кімнати
    FOREIGN KEY (room_id, user_id) REFERENCES public.room_members(room_id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id, voted_for_user_id) REFERENCES public.room_members(room_id, user_id) ON DELETE SET NULL
);

-- 7. ЗОЛОТИЙ ФОНД КІМНАТИ (LORE_ITEMS ⭐)
CREATE TABLE IF NOT EXISTS public.lore_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.room_rounds(id) ON DELETE CASCADE NOT NULL,
    response_id UUID REFERENCES public.round_responses(id) ON DELETE CASCADE NOT NULL,
    pinned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, response_id)
);

-- Індекси для швидкодії
CREATE INDEX IF NOT EXISTS idx_room_rounds_room_date ON public.room_rounds(room_id, round_date DESC);
CREATE INDEX IF NOT EXISTS idx_round_responses_round ON public.round_responses(round_id);
CREATE INDEX IF NOT EXISTS idx_lore_items_room ON public.lore_items(room_id, created_at DESC);

-- ============================================================================
-- ЯДРО БЕЗПЕКИ: ДОПОМІЖНІ ФУНКЦІЇ ТА ТРИГЕРИ
-- ============================================================================

-- Перевірка: чи є користувач активним учасником кімнати
CREATE OR REPLACE FUNCTION public.is_active_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = p_room_id
          AND user_id = p_user_id
          AND status = 'active'
    );
$$;

-- Перевірка: чи має право користувач бачити відкриті відповіді раунду
CREATE OR REPLACE FUNCTION public.can_reveal_round(p_round_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.room_rounds r
        JOIN public.room_members rm
          ON rm.room_id = r.room_id
         AND rm.user_id = p_user_id
         AND rm.status = 'active'
        WHERE r.id = p_round_id
          AND (
              -- Умова 1: Настав серверний час відкриття (21:00 за часом кімнати або достроковий кворум)
              now() >= r.reveal_at
              OR
              -- Умова 2: Користувач сам уже зробив активний хід у цьому раунді
              EXISTS (
                  SELECT 1 FROM public.round_responses resp
                  WHERE resp.round_id = p_round_id
                    AND resp.user_id = p_user_id
                    AND resp.is_skipped = false
              )
          )
    );
$$;

-- Тригер: якщо всі активні учасники кімнати вже відповіли, миттєво відкриваємо раунд для всіх (reveal_at = now())
CREATE OR REPLACE FUNCTION public.handle_quorum_reveal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_active_members INT;
    v_responses_count INT;
BEGIN
    SELECT count(*) INTO v_active_members
    FROM public.room_members
    WHERE room_id = NEW.room_id AND status = 'active';

    SELECT count(*) INTO v_responses_count
    FROM public.round_responses resp
    JOIN public.room_members rm
      ON rm.room_id = resp.room_id
     AND rm.user_id = resp.user_id
    WHERE resp.round_id = NEW.round_id
      AND rm.status = 'active'
      AND resp.is_skipped = false;

    IF v_active_members >= 2 AND v_responses_count >= v_active_members THEN
        UPDATE public.room_rounds
        SET reveal_at = LEAST(reveal_at, now())
        WHERE id = NEW.round_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quorum_reveal ON public.round_responses;
CREATE TRIGGER trg_check_quorum_reveal
AFTER INSERT OR UPDATE ON public.round_responses
FOR EACH ROW
EXECUTE FUNCTION public.handle_quorum_reveal();

-- ============================================================================
-- ПОЛІТИКИ ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lore_items ENABLE ROW LEVEL SECURITY;

-- ROOMS
DROP POLICY IF EXISTS "Members can view their rooms" ON public.rooms;
CREATE POLICY "Members can view their rooms"
ON public.rooms FOR SELECT TO authenticated
USING (public.is_active_room_member(id, auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms"
ON public.rooms FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND is_premium = false);

-- ROOM_MEMBERS
DROP POLICY IF EXISTS "Members can view other members in same room" ON public.room_members;
CREATE POLICY "Members can view other members in same room"
ON public.room_members FOR SELECT TO authenticated
USING (public.is_active_room_member(room_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can join room as themselves" ON public.room_members;
CREATE POLICY "Users can join room as themselves"
ON public.room_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own member profile" ON public.room_members;
CREATE POLICY "Users can update own member profile"
ON public.room_members FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- PROMPTS
DROP POLICY IF EXISTS "Authenticated users can read prompts" ON public.prompts;
CREATE POLICY "Authenticated users can read prompts"
ON public.prompts FOR SELECT TO authenticated
USING (is_active = true);

-- ROOM_ROUNDS
DROP POLICY IF EXISTS "Room members can view rounds" ON public.room_rounds;
CREATE POLICY "Room members can view rounds"
ON public.room_rounds FOR SELECT TO authenticated
USING (public.is_active_room_member(room_id, auth.uid()));

-- ROUND_RESPONSES (Захищено від підглядання до виконання умови відкриття!)
DROP POLICY IF EXISTS "Users can view own response or revealed round responses" ON public.round_responses;
CREATE POLICY "Users can view own response or revealed round responses"
ON public.round_responses FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.can_reveal_round(round_id, auth.uid())
);

DROP POLICY IF EXISTS "Active members can insert own response" ON public.round_responses;
CREATE POLICY "Active members can insert own response"
ON public.round_responses FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_room_member(room_id, auth.uid())
);

-- LORE_ITEMS
DROP POLICY IF EXISTS "Room members can view lore" ON public.lore_items;
CREATE POLICY "Room members can view lore"
ON public.lore_items FOR SELECT TO authenticated
USING (public.is_active_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Room members can pin revealed responses to lore" ON public.lore_items;
CREATE POLICY "Room members can pin revealed responses to lore"
ON public.lore_items FOR INSERT TO authenticated
WITH CHECK (
    pinned_by = auth.uid()
    AND public.is_active_room_member(room_id, auth.uid())
    AND public.can_reveal_round(round_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can unpin own lore items" ON public.lore_items;
CREATE POLICY "Members can unpin own lore items"
ON public.lore_items FOR DELETE TO authenticated
USING (pinned_by = auth.uid());

-- ============================================================================
-- RPC-ФУНКЦІЇ ДЛЯ КЛІЄНТА (LAZY ROUND GENERATION + КАРТКИ + ПРИЄДНАННЯ)
-- ============================================================================

-- 1. Приєднання до кімнати за 6-значним invite_code
CREATE OR REPLACE FUNCTION public.join_room_by_code(
    p_invite_code TEXT,
    p_display_name TEXT,
    p_avatar_emoji TEXT DEFAULT '😎'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id UUID;
    v_room_type public.room_type;
    v_active_count INT;
BEGIN
    SELECT id, type INTO v_room_id, v_room_type
    FROM public.rooms
    WHERE upper(invite_code) = upper(trim(p_invite_code));

    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Кімнату з таким кодом не знайдено';
    END IF;

    SELECT count(*) INTO v_active_count
    FROM public.room_members
    WHERE room_id = v_room_id AND status = 'active' AND user_id <> auth.uid();

    IF v_room_type = 'couple' AND v_active_count >= 2 THEN
        RAISE EXCEPTION 'Ця кімнату створена для пари (максимум 2 учасники)';
    ELSIF v_room_type = 'friends' AND v_active_count >= 8 THEN
        RAISE EXCEPTION 'У кімнаті вже максимальна кількість учасників (8)';
    END IF;

    INSERT INTO public.room_members (room_id, user_id, display_name, avatar_emoji, status)
    VALUES (v_room_id, auth.uid(), trim(p_display_name), COALESCE(p_avatar_emoji, '😎'), 'active')
    ON CONFLICT (room_id, user_id)
    DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_emoji = EXCLUDED.avatar_emoji,
        status = 'active';

    RETURN v_room_id;
END;
$$;

-- 2. Ідемпотентне отримання або створення сьогоднішнього раунду кімнати
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

    -- Обчислюємо сьогоднішню дату в часовому поясі кімнати
    v_today := (now() AT TIME ZONE v_tz)::date;

    -- Шукаємо раунд на сьогодні
    SELECT rr.id INTO v_round_id
    FROM public.room_rounds rr
    WHERE rr.room_id = p_room_id AND rr.round_date = v_today;

    -- Якщо раунду ще немає — атомарно створюємо його
    IF v_round_id IS NULL THEN
        -- Обираємо випадкове питання для цього типу кімнати, якого ще не було
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

        -- Якщо всі питання вже пройшли по колу — беремо будь-яке активне
        IF v_prompt_id IS NULL THEN
            SELECT p.id INTO v_prompt_id
            FROM public.prompts p
            WHERE p.target_type = v_room_type AND p.is_active = true
            ORDER BY random()
            LIMIT 1;
        END IF;

        -- Серверний timestamp 21:00 у часовому поясі кімнати
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

-- 3. Безпечне отримання карток учасників раунду (відкриті або замасковані)
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

-- Обмежуємо прямий доступ до SECURITY DEFINER функцій лише для authenticated
REVOKE ALL ON FUNCTION public.is_active_room_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_reveal_round(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_room_by_code(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_today_round(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_round_cards(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_room_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_reveal_round(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_by_code(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_today_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_round_cards(UUID) TO authenticated;

-- ============================================================================
-- СТАРТОВИЙ НАБІР ЗАПИТАНЬ (SEED DATA: 10 ДЛЯ ДРУЗІВ + 10 ДЛЯ ПАР, ІДЕМПОТЕНТНО)
-- ============================================================================

INSERT INTO public.prompts (target_type, format, question_text, deck_tag)
SELECT v.target_type::public.room_type, v.format::public.prompt_format, v.question_text, v.deck_tag
FROM (VALUES
    -- БАНДА ДРУЗІВ (FRIENDS)
    ('friends', 'vote', 'Хто з нашої компанії найімовірніше заблукає навіть з увімкненим Google Maps? 🗺️', 'core'),
    ('friends', 'show', 'Сфотографуй те, що прямо зараз перед твоїми очима (без підготовки!) 📸', 'core'),
    ('friends', 'vote', 'Хто з нас першим би витратив усі гроші в перший же день після виграшу в лотерею? 💸', 'core'),
    ('friends', 'answer', 'Яка найбільш абсурдна відмазка, яку ти колись вигадував, щоб нікуди не йти? 🛋️', 'core'),
    ('friends', 'vote', 'Чий телефон найстрашніше було б відкрити на вкладці "Галерея" при батьках? 📱', 'core'),
    ('friends', 'show', 'Покажи свій сьогоднішній напій або перекус прямо зараз ☕', 'core'),
    ('friends', 'vote', 'Хто з нас найімовірніше випадково опиниться в іншій країні після вечірки? ✈️', 'core'),
    ('friends', 'answer', 'Яку одну пісню ти зараз слухаєш на повторі, хоча трохи соромно зізнатися? 🎧', 'core'),
    ('friends', 'vote', 'Хто з нашої банди вижив би найдовше на безлюдному острові? 🏝️', 'core'),
    ('friends', 'vote', 'Хто з нас запізниться навіть на власне весілля? ⏰', 'core'),
    -- ПАРА (COUPLE)
    ('couple', 'vote', 'Хто з нас двох довше збирається перед виходом з дому? 🪞', 'core'),
    ('couple', 'show', 'Покажи свій вид з вікна або робочого місця прямо в цю секунду 🌤️', 'core'),
    ('couple', 'vote', 'Хто з нас першим піде миритися після дрібної суперечки? 🏳️', 'core'),
    ('couple', 'answer', 'Яка маленька деталь у поведінці партнера сьогодні або цього тижня змусила тебе усміхнутися? ❤️', 'core'),
    ('couple', 'vote', 'Хто з нас частіше засинає на 15-й хвилині фільму, який сам і обрав? 🍿', 'core'),
    ('couple', 'show', 'Скинь селфі зі своїм поточним настроєм без жодних фільтрів 🤳', 'core'),
    ('couple', 'vote', 'Хто з нас більш схильний до імпульсивних покупок о 2-й годині ночі? 🛒', 'core'),
    ('couple', 'answer', 'Куди б ти найбільше хотів(ла) поїхати вдвох хоча б на одні вихідні найближчим часом? 🧳', 'core'),
    ('couple', 'vote', 'Хто з нас краще готує сніданки? 🍳', 'core'),
    ('couple', 'answer', 'Який наш спільний спогад миттєво піднімає тобі настрій? ✨', 'core')
) AS v(target_type, format, question_text, deck_tag)
WHERE NOT EXISTS (
    SELECT 1 FROM public.prompts p WHERE p.question_text = v.question_text
);

-- ============================================================================
-- ЗАХИСТ МЕДІАФАЙЛІВ У SUPABASE STORAGE (ПРИВАТНИЙ БАКЕТ room-media)
-- Очікуваний формат шляху файлу: {room_id}/{round_id}/{user_id}.jpg
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('room-media', 'room-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Active members can upload own round photo" ON storage.objects;
CREATE POLICY "Active members can upload own round photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'room-media'
    AND public.is_active_room_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Members can view round photos only after reveal condition" ON storage.objects;
CREATE POLICY "Members can view round photos only after reveal condition"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'room-media'
    AND (
        owner = auth.uid()
        OR public.can_reveal_round(((storage.foldername(name))[2])::uuid, auth.uid())
    )
);




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


-- ============================================================================
-- KAPSA: МІГРАЦІЯ 003 — КОНТЕНТНЕ ЯДРО (100+ УКРАЇНСЬКИХ ЗАПИТАНЬ)
-- ТА ПРИВ'ЯЗКА ЩОДЕННОГО РАУНДУ ДО ОБРАНОЇ КОЛОДИ (active_deck)
-- ============================================================================

-- 1. Оновлюємо get_or_create_today_round так, щоб він враховував rooms.active_deck
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
    v_deck TEXT;
    v_today DATE;
    v_reveal_ts TIMESTAMPTZ;
    v_prompt_id UUID;
    v_round_id UUID;
BEGIN
    IF NOT public.is_active_room_member(p_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: not an active room member';
    END IF;

    SELECT r.timezone, r.reveal_hour, r.type, COALESCE(r.active_deck, 'core')
    INTO v_tz, v_reveal_hour, v_room_type, v_deck
    FROM public.rooms r
    WHERE r.id = p_room_id;

    v_today := (now() AT TIME ZONE v_tz)::date;

    SELECT rr.id INTO v_round_id
    FROM public.room_rounds rr
    WHERE rr.room_id = p_room_id AND rr.round_date = v_today;

    IF v_round_id IS NULL THEN
        -- Крок 1: Шукаємо непройдене питання в активній колоді кімнати (v_deck)
        SELECT p.id INTO v_prompt_id
        FROM public.prompts p
        WHERE p.target_type = v_room_type
          AND p.is_active = true
          AND (v_deck = 'all' OR p.deck_tag = v_deck)
          AND NOT EXISTS (
              SELECT 1 FROM public.room_rounds old_r
              WHERE old_r.room_id = p_room_id AND old_r.prompt_id = p.id
          )
        ORDER BY random()
        LIMIT 1;

        -- Крок 2: Якщо в цій колоді всі нові питання вичерпано — беремо будь-яке непройдене для цього типу кімнати
        IF v_prompt_id IS NULL THEN
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
        END IF;

        -- Крок 3: Якщо всі питання пройшли по колу — беремо будь-яке активне з обраної колоди або загального пулу
        IF v_prompt_id IS NULL THEN
            SELECT p.id INTO v_prompt_id
            FROM public.prompts p
            WHERE p.target_type = v_room_type AND p.is_active = true
            ORDER BY (CASE WHEN p.deck_tag = v_deck THEN 0 ELSE 1 END), random()
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

-- 2. Наповнення бази 75+ новими запитаннями (Загальний банк: 100+ запитань для 30+ днів гри)
INSERT INTO public.prompts (target_type, format, question_text, deck_tag, is_premium)
SELECT v.target_type::public.room_type, v.format::public.prompt_format, v.question_text, v.deck_tag, v.is_premium
FROM (VALUES
    -- ========================================================================
    -- ДРУЗІ: CORE ⚡ (Повсякденний гумор, ситуації, голосування та моменти)
    -- ========================================================================
    ('friends', 'vote', 'Хто з нас найімовірніше запізниться на власне весілля і скаже, що були затори? 🚗', 'core', false),
    ('friends', 'vote', 'Хто з нашої компанії виживе першим на безлюдному острові, а хто здасться за 15 хвилин? 🏝️', 'core', false),
    ('friends', 'vote', 'Хто з нас найімовірніше купить абонемент у зал на рік і сходить туди рівно двічі? 🏋️', 'core', false),
    ('friends', 'vote', 'Кому з нас найкраще довірити плейлист у довгу дорогу на авто? 🎵', 'core', false),
    ('friends', 'vote', 'Хто з нас найімовірніше стане мемом у TikTok абсолютно випадково? 📱', 'core', false),
    ('friends', 'vote', 'Хто з компанії найдовше обирає страву в меню, а в кінці замовляє те саме, що й завжди? 🍔', 'core', false),
    ('friends', 'show', 'Покажи останній мем або скріншот у своїй галереї без пояснень 🖼️', 'core', false),
    ('friends', 'show', 'Сфотографуй те, що лежить праворуч від тебе прямо зараз 👉', 'core', false),
    ('friends', 'show', 'Покажи свій сьогоднішній обід, перекус або напій без прикрас ☕', 'core', false),
    ('friends', 'show', 'Зроби фото свого взуття або виходу з дому сьогодні 👟', 'core', false),
    ('friends', 'show', 'Покажи екран свого ноутбука, столу або місце, де ти зараз сидиш 💻', 'core', false),
    ('friends', 'answer', 'Яку одну фразу знають і розуміють тільки учасники нашої компанії? 🤫', 'core', false),
    ('friends', 'answer', 'Якби про нашу компанію знімали серіал на Netflix, як би називалася перша серія? 🎬', 'core', false),
    ('friends', 'answer', 'Яка твоя найдивніша звичка у побуті, про яку мало хто здогадується? 🧠', 'core', false),
    ('friends', 'answer', 'Яка покупка до 1000 грн за останній час принесла тобі найбільше кайфу? 🛍️', 'core', false),

    -- ========================================================================
    -- ДРУЗІ: SPICY 🔥 (Гострі питання, підколи, вечірки, секрети)
    -- ========================================================================
    ('friends', 'vote', 'Хто з нас найімовірніше напише колишньому/колишній о 2-й ночі в п''ятницю? 🍷', 'spicy', false),
    ('friends', 'vote', 'У кого з нас найпідозріліша історія пошуку в браузері за останній тиждень? 🔍', 'spicy', false),
    ('friends', 'vote', 'Хто з компанії найкраще вміє викрутитися з будь-якої халепи з невинним обличчям? 😇', 'spicy', false),
    ('friends', 'vote', 'Хто з нас найімовірніше витратить усю зарплату за три дні «бо живемо один раз»? 💸', 'spicy', false),
    ('friends', 'vote', 'Хто з нас першим би проговорився на допиті за порцію шаурми? 🌯', 'spicy', false),
    ('friends', 'vote', 'Хто з нашої банди найбільше любить драму, навіть коли каже, що ненавидить її? 🎭', 'spicy', false),
    ('friends', 'answer', 'Яке виправдання ти використовував(ла), щоб не йти на зустріч, коли просто хотілося полежати вдома? 🛋️', 'spicy', false),
    ('friends', 'answer', 'За яку дрібницю тобі досі трохи соромно, хоча всі інші про неї давно забули? 😳', 'spicy', false),
    ('friends', 'answer', 'Який найдивніший комплімент ти коли-небудь отримував(ла) у житті? 👀', 'spicy', false),
    ('friends', 'answer', 'Що б ти зробив(ла) у першу чергу, якби на 24 години став(ла) невидимим(ою)? 👻', 'spicy', false),
    ('friends', 'show', 'Покажи своє найсмішніше селфі з фронтальної камери, зроблене прямо зараз без підготовки 🤪', 'spicy', false),

    -- ========================================================================
    -- ДРУЗІ: DEEP 🌙 (Чесні розмови, цінності, рефлексія у колі своїх)
    -- ========================================================================
    ('friends', 'vote', 'Хто з нас дає наймудріші поради у складних життєвих ситуаціях? 🦉', 'deep', false),
    ('friends', 'vote', 'До кого з компанії ти зателефонуєш першим, якщо опинишся о 3-й ночі в чужому місті без грошей? 📞', 'deep', false),
    ('friends', 'vote', 'Хто з нас найбільше приховує втому за жартами та гарним настроєм? 🫂', 'deep', false),
    ('friends', 'answer', 'Яку одну пораду ти б дав(ла) собі 3 роки тому, знаючи те, що знаєш зараз? ⏳', 'deep', false),
    ('friends', 'answer', 'За що ти найбільше вдячний(на) людям у цій кімнаті за останній рік? ❤️', 'deep', false),
    ('friends', 'answer', 'Яка ціль або мрія зараз найбільше заряджає тебе рухатися вперед? 🚀', 'deep', false),
    ('friends', 'answer', 'Що допомагає тобі найшвидше перезавантажитися, коли все навколо тисне? 🌿', 'deep', false),
    ('friends', 'answer', 'Яка риса характеру в друзях для тебе є абсолютно безцінною? 🤝', 'deep', false),

    -- ========================================================================
    -- ДРУЗІ: NOSTALGIA 📼 (Легендарні історії, минуле, спогади компанії)
    -- ========================================================================
    ('friends', 'vote', 'У кого з нас було найбільш епічне перше враження під час нашого знайомства? 👋', 'nostalgia', false),
    ('friends', 'vote', 'Хто з нас зберігає найбільше компромату та старих фото нашої компанії в телефоні? 📸', 'nostalgia', false),
    ('friends', 'vote', 'Хто з нас зовсім не змінився характером зі шкільних або студентських часів? 🎒', 'nostalgia', false),
    ('friends', 'answer', 'Який наш спільний виїзд, вечірка або посиденьки запам''яталися тобі як абсолютна легенда? 🔥', 'nostalgia', false),
    ('friends', 'answer', 'Яка пісня у тебе миттєво асоціюється з нашою компанією або минулим літом? 🎶', 'nostalgia', false),
    ('friends', 'answer', 'Що ти подумав(ла) у перші 5 хвилин, коли вперше познайомився(лася) з учасниками цієї кімнати? 🤔', 'nostalgia', false),
    ('friends', 'show', 'Знайди в галереї й покажи будь-яке старе архівне фото, яке викликає теплу усмішку 🎞️', 'nostalgia', false),

    -- ========================================================================
    -- ПАРА: CORE ⚡ (Теплі щоденні ритуали, звички двох, посмішки)
    -- ========================================================================
    ('couple', 'vote', 'Хто з нас двох частіше каже «мені все одно, що їсти», але потім відхиляє всі варіанти? 🍕', 'core', false),
    ('couple', 'vote', 'Хто з нас швидше засинає ввечері, щойно голова торкається подушки? 😴', 'core', false),
    ('couple', 'vote', 'Хто з нас частіше губить ключі, навушники або телефон удома? 🔑', 'core', false),
    ('couple', 'vote', 'Хто з нас двох головний ініціатор спонтанних прогулянок і пригод? 👟', 'core', false),
    ('couple', 'vote', 'Хто з нас більше перетягує ковдру на себе вночі? 🛌', 'core', false),
    ('couple', 'show', 'Покажи, що ти бачиш перед собою просто в цю хвилину 👀', 'core', false),
    ('couple', 'show', 'Скинь селфі-привіт для своєї половинки посеред дня 😘', 'core', false),
    ('couple', 'show', 'Сфотографуй свій напій, каву або перекус прямо зараз ☕', 'core', false),
    ('couple', 'show', 'Покажи деталь навколо себе, яка сьогодні підняла тобі настрій ✨', 'core', false),
    ('couple', 'answer', 'Яку страву або смаколик тобі найбільше хочеться з''їсти разом сьогодні чи завтра? 🍣', 'core', false),
    ('couple', 'answer', 'Якби у нас сьогодні видався повністю вільний вечір без жодних справ, як би ти хотів(ла) його провести? 🕯️', 'core', false),
    ('couple', 'answer', 'Яка наша маленька щоденна традиція подобається тобі найбільше? 💑', 'core', false),
    ('couple', 'answer', 'Який фільм чи серіал нам обов''язково варто подивитися разом найближчим часом? 🍿', 'core', false),

    -- ========================================================================
    -- ПАРА: SPICY 🔥 (Флірт, іскра, сміливі бажання, грайливість)
    -- ========================================================================
    ('couple', 'vote', 'Хто з нас двох більше ревнує, навіть коли вдає, що абсолютно спокійний? 👀', 'spicy', false),
    ('couple', 'vote', 'Хто з нас першим робить крок до примирення після дрібної суперечки? 🏳️', 'spicy', false),
    ('couple', 'vote', 'Хто з нас двох частіше починає обійматися та чіплятися без приводу посеред дня? 🔥', 'spicy', false),
    ('couple', 'vote', 'Хто з нас сміливіший у бажаннях та експериментах? 🌶️', 'spicy', false),
    ('couple', 'answer', 'Який образ або одяг на мені притягує твій погляд найсильніше? 😍', 'spicy', false),
    ('couple', 'answer', 'Який комплімент від мене завжди змушує твоє серце битися швидше? 💓', 'spicy', false),
    ('couple', 'answer', 'Опиши наше ідеальне побачення на двох, де нас ніхто не потурбує цілий вечір 🍷', 'spicy', false),
    ('couple', 'answer', 'Який поцілунок або момент близькості між нами за останній час запам''ятався тобі найбільше? 💋', 'spicy', false),
    ('couple', 'show', 'Зроби селфі з найхитрішим або найзагадковішим поглядом прямо зараз 😏', 'spicy', false),

    -- ========================================================================
    -- ПАРА: DEEP 🌙 (Близькість, довіра, майбутнє, вдячність)
    -- ========================================================================
    ('couple', 'vote', 'Хто з нас двох краще відчуває настрій іншого навіть без слів? 🫂', 'deep', false),
    ('couple', 'vote', 'Хто з нас більше мріє вголос про наше спільне майбутнє? 🏡', 'deep', false),
    ('couple', 'answer', 'У який момент за останній місяць ти відчув(ла) найбільшу гордість або ніжність до мене? 🥹', 'deep', false),
    ('couple', 'answer', 'Як я можу підтримати тебе цього тижня, щоб тобі стало трохи легше й тепліше? 🤍', 'deep', false),
    ('couple', 'answer', 'Що в наших стосунках дає тобі найбільше відчуття спокою та дому? 🏠', 'deep', false),
    ('couple', 'answer', 'Яку спільну мрію або подорож ти найбільше хочеш здійснити разом протягом наступного року? ✈️', 'deep', false),
    ('couple', 'answer', 'Чого наші стосунки навчили тебе про себе самого(у)? 🌱', 'deep', false),

    -- ========================================================================
    -- ПАРА: NOSTALGIA 📼 (Історія кохання, перші побачення, теплі моменти)
    -- ========================================================================
    ('couple', 'vote', 'Хто з нас двох сильніше хвилювався на нашому найпершому побаченні? 💓', 'nostalgia', false),
    ('couple', 'vote', 'Хто з нас першим зрозумів, що між нами щось значно більше, ніж просто симпатія? ✨', 'nostalgia', false),
    ('couple', 'answer', 'Яку дрібницю з нашого першого місяця знайомства ти досі пам''ятаєш у деталях? 📼', 'nostalgia', false),
    ('couple', 'answer', 'Яка наша спільна поїздка або прогулянка назавжди залишиться в твоєму особистому золотому фонді? 🌅', 'nostalgia', false),
    ('couple', 'answer', 'Яка пісня або місце в місті миттєво нагадує тобі про початок нашої історії? 🎵', 'nostalgia', false),
    ('couple', 'show', 'Покажи улюблене фото з галереї, яке нагадує про класний день, проведений удвох 📸', 'nostalgia', false)
) AS v(target_type, format, question_text, deck_tag, is_premium)
WHERE NOT EXISTS (
    SELECT 1 FROM public.prompts p WHERE p.question_text = v.question_text
);
