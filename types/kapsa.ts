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

export interface TodayRound {
  round_id: string;
  round_date: string;
  reveal_at: string;
  is_fully_revealed: boolean;
  prompt_id: string;
  prompt_format: PromptFormat;
  question_text: string;
  deck_tag?: DeckTag;
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
