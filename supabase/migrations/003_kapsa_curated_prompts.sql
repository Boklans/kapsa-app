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
