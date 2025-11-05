
export type Role = 'user' | 'panda';

export type PandaReaction = 'eye-roll' | 'facepalm' | 'shrug' | 'slow-clap' | 'none';

export interface ChatMessage {
  role: Role;
  text: string;
  audioBuffer?: AudioBuffer;
  isPlaying?: boolean;
  reaction?: PandaReaction;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  date: string; // ISO Date string
}

export interface ProgressPoint {
  date: string;
  score: number;
}

export type AppMode = 'standard' | 'premium' | 'elite';

export type AchievementCategory =
  | '🏆 Core Achievements'
  | '💬 Daily Life Failures'
  | '😭 Emotional Achievements'
  | '💔 Relationship Chaos'
  | '🧠 Existential & Deep Thoughts'
  | '📱 Tech & Social Media'
  | '🍕 Lifestyle & Habits'
  | '🧘 Self-Reflection & Growth (Kind of)'
  | '🧨 Hidden / Easter Egg Trophies';

export type AchievementId =
  // Core Achievements
  | 'FIRST_ROAST'
  | 'GLUTTON_FOR_PUNISHMENT'
  | 'CONSISTENT_COMPLAINER'
  | 'WEEKLY_WHINER'
  | 'BABYS_FIRST_CYNICISM'
  | 'EMOTIONAL_MASOCHIST'
  | 'VOICE_OF_DESPAIR'
  // Daily Life Failures
  | 'JUST_ANOTHER_TUESDAY'
  | 'GROUNDHOG_DAY'
  | 'MONDAY_SURVIVOR'
  | 'EXISTENTIAL_LOOP'
  | 'DEJA_DISAPPOINTMENT'
  // Emotional Achievements
  | 'MILDLY_SHATTERED'
  | 'FULLY_CRUSHED'
  | 'TEAR_STAINED_CONFESSION'
  | 'THERAPIST_WONT_HEAR_THIS'
  | 'EMOTIONAL_OVERDRAFT'
  // Relationship Chaos
  | 'GHOSTED_AGAIN'
  | 'ITS_COMPLICATED'
  | 'EMOTIONAL_GYMNAST'
  | 'ROM_COM_REJECT'
  | 'UNSENT_MESSAGE_HERO'
  // Existential & Deep Thoughts
  | 'PHILOSOPHER_IN_PAJAMAS'
  | 'UNIVERSE_DOESNT_CARE'
  | 'MIDLIFE_CRISIS_EARLY_EDITION'
  | 'SCREAMED_INTO_THE_VOID'
  | 'NIHILIST_LEVEL_10'
  // Tech & Social Media
  | 'DOOMSCROLL_MASTER'
  | 'MESSAGE_SEEN_IGNORED'
  | 'SOCIAL_MEDIA_ARCHEOLOGIST'
  | 'INFINITE_LOOP_OF_VALIDATION'
  | 'SCREEN_TIME_DONT_ASK'
  // Lifestyle & Habits
  | 'DINNER_OF_CHAMPIONS'
  | 'PRODUCTIVITY_IS_A_MYTH'
  | 'GYM_TOMORROW'
  | 'FINANCIAL_DISASTERPIECE'
  | 'SLEEP_OPTIONAL'
  // Self-Reflection & Growth (Kind of)
  | 'ACCIDENTAL_SELF_AWARENESS'
  | 'GROWTH_HURTS'
  | 'DETACHED_AND_PROUD'
  | 'MICRODOSE_OF_ACCEPTANCE'
  | 'ENLIGHTENMENT_WITH_A_HANGOVER'
  // Hidden / Easter Egg Trophies
  | 'HAPPINESS_404_NOT_FOUND'
  | 'SECRETLY_HOPEFUL'
  | 'DEVELOPERS_FAVORITE'
  | 'DISAPPOINTMENT_CONNOISSEUR'
  | 'YOU_WIN_NOTHING';


export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  goal: number;
  progress: number;
  unlocked: boolean;
  category: AchievementCategory;
}