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
 * Детермінована функція розрахунку стану раунду на основі часу та кворуму:
 * 1. 'scheduled' — заплановано на майбутнє
 * 2. 'open' — раунд активний, триває збір таємних відповідей
 * 3. 'revealed' — виконано умови кворуму АБО настав час розкриття (21:00)
 * 4. 'archived' — минулий раунд відправлено в історію
 */
export function computeRoundLifecycleState(
  round: {
    round_date: string;
    reveal_at: string;
    is_fully_revealed?: boolean;
    start_at?: string;
  },
  now = new Date()
): RoundLifecycleState {
  const nowIso = now.toISOString();
  const todayDateStr = nowIso.slice(0, 10);

  // Якщо дата раунду ще не настала — раунд заплановано
  if (round.round_date > todayDateStr) {
    return 'scheduled';
  }

  // Якщо дата раунду минула (вчора або раніше) — раунд в архіві
  if (round.round_date < todayDateStr) {
    return 'archived';
  }

  // Якщо раунд вже розпечатаний за кворумом або настав час reveal_at
  const revealTimeMs = new Date(round.reveal_at).getTime();
  if (round.is_fully_revealed || now.getTime() >= revealTimeMs) {
    return 'revealed';
  }

  // Інакше раунд відкритий для ходів користувачів
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
