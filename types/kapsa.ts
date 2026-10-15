export type RoomType = 'friends' | 'couple';
export type PromptFormat = 'vote' | 'show' | 'answer';
export type DeckTag = 'core' | 'spicy' | 'deep' | 'nostalgia';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  invite_code: string;
  timezone: string;
  reveal_hour: number;
  is_premium: boolean;
  streak_count?: number;
  longest_streak?: number;
  active_deck?: DeckTag;
  created_by: string;
  created_at: string;
}

// Життєвий цикл щоденного раунду згідно зі стейт-машиною KAPSA
export type RoundLifecycleState = 'scheduled' | 'open' | 'revealed' | 'archived';

export interface TodayRound {
  round_id: string;
  round_number?: number;
  round_date: string;
  reveal_at: string;
  is_fully_revealed: boolean;
  lifecycle_state?: RoundLifecycleState;
  prompt_id: string;
  prompt_format: PromptFormat;
  question_text: string;
  deck_tag?: DeckTag;
}

/**
 * Добовий цикл KAPSA (оновлення щодня о 08:00 ранку):
 * - О 08:00 ранку починається новий день: стан 'open' (збір відповідей наосліп).
 * - О 21:00 (або миттєво при 100% кворумі): стан 'revealed'.
 * - З 21:00 до 08:00 наступного ранку: вікно обговорення ('revealed') триває всю ніч
 *   і ранок, щоб друзі встигли прочитати коментарі та зберегти найкраще в Lore за кавою.
 * - О 08:00 ранку вчорашній день переходить в 'archived', а новий день стає 'open'.
 */
export function getKapsaEffectiveRoundDate(now = new Date()): string {
  const d = new Date(now);
  // До 08:00 ранку активним ще є вчорашній розкритий раунд
  if (d.getHours() < 8) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

export function computeRoundLifecycleState(
  round: {
    round_date: string;
    reveal_at: string;
    is_fully_revealed?: boolean;
    start_at?: string;
  },
  now = new Date()
): RoundLifecycleState {
  const effectiveDate = getKapsaEffectiveRoundDate(now);

  // 1. Майбутня дата — раунд заплановано
  if (round.round_date > effectiveDate) {
    return 'scheduled';
  }

  // 2. Минула дата (раніша за вчорашній розкритий раунд) — в архіві
  if (round.round_date < effectiveDate) {
    return 'archived';
  }

  // 3. Для поточної активної доби: перевіряємо умови розкриття (кворум або 21:00)
  const revealTimeMs = new Date(round.reveal_at).getTime();
  if (round.is_fully_revealed || now.getTime() >= revealTimeMs) {
    return 'revealed';
  }

  // 4. Інакше раунд відкритий для ходів користувачів
  return 'open';
}

export interface RoundCard {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  has_answered: boolean;
  is_skipped: boolean;
  answered_at: string | null;
  is_revealed: boolean;
  response_id: string | null;
  text_content: string | null;
  has_media: boolean;
  media_path: string | null;
  voted_for_user_id: string | null;
  voted_for_name: string | null;
  is_pinned_to_lore: boolean;
  reactions?: Record<string, string[]>;
  is_nudged?: boolean;
}

export interface LoreItem {
  id: string;
  room_id: string;
  round_id: string;
  response_id: string;
  pinned_by: string;
  created_at: string;
  question_text?: string;
  author_name?: string;
  author_emoji?: string;
  text_content?: string | null;
  voted_for_name?: string | null;
  media_path?: string | null;
}

export interface RoundHistoryItem {
  round_id: string;
  round_date: string;
  reveal_at: string;
  is_revealed: boolean;
  prompt_format: PromptFormat;
  question_text: string;
  deck_tag?: DeckTag;
}
