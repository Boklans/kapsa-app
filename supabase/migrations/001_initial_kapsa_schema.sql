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


