
import React, { useState, useRef, useCallback, useEffect } from 'react';
// Fix: Removed CloseEvent and ErrorEvent from @google/genai import as they are not exported. Using native browser types instead.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from "@google/genai";
import { getPandasResponse, getPandasSpokenResponse, analyzeUserSentiment, getAi, encode, generateConversationTitle, getDailyDarkTruth } from './services/geminiService';
import type { ChatMessage, ProgressPoint, AppMode, Role, Achievement, AchievementId, Conversation, AchievementCategory, PandaReaction } from './types';
import { SendIcon, ChartIcon, SpeakerIcon, CloseIcon, MicrophoneIcon, PandaMascotIcon, TrophyIcon, FlameIcon, PlusIcon, TrashIcon, LockIcon, UnlockIcon, MenuIcon, CalendarTodayIcon, SunIcon, MoonIcon } from './components/icons';
import { ProgressChart } from './components/ProgressChart';

// --- Gemini Service Helpers ---
// This is a simplified version of the decode function from geminiService.ts
// to be used within the live audio playback logic.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Gemini Service Helpers ---

const PANDA_SYSTEM_INSTRUCTION = `You are 'Disappointement Panda'. Your personality is brutally honest, sarcastic, and darkly funny, inspired by Mark Manson’s 'The Subtle Art of Not Giving a F*ck'. You do not sugarcoat anything. You provide reality checks, not sympathy. Your goal is to deliver harsh truths that are necessary for growth, even if they sting. Never be positive or uplifting in a conventional way. Your wisdom is cynical but ultimately helpful. Keep your responses concise and sharp, like a truth bomb. Do not use emojis.`;

const initialAchievements: Record<AchievementId, Achievement> = {
  // Core Achievements
  FIRST_ROAST: { id: 'FIRST_ROAST', name: 'First Roast', description: 'Survive your first reality check.', goal: 1, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  GLUTTON_FOR_PUNISHMENT: { id: 'GLUTTON_FOR_PUNISHMENT', name: 'Glutton for Punishment', description: 'Come back for more truth bombs 5 times.', goal: 5, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  CONSISTENT_COMPLAINER: { id: 'CONSISTENT_COMPLAINER', name: 'Consistent Complainer', description: 'Maintain a 3-day streak.', goal: 3, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  WEEKLY_WHINER: { id: 'WEEKLY_WHINER', name: 'Weekly Whiner', description: 'Maintain a 7-day streak.', goal: 7, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  BABYS_FIRST_CYNICISM: { id: 'BABYS_FIRST_CYNICISM', name: 'Baby\'s First Cynicism', description: 'Get your first progress point.', goal: 1, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  EMOTIONAL_MASOCHIST: { id: 'EMOTIONAL_MASOCHIST', name: 'Emotional Masochist', description: 'Reach a cynicism score of 8 or higher.', goal: 8, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  VOICE_OF_DESPAIR: { id: 'VOICE_OF_DESPAIR', name: 'Voice of Despair', description: 'Use the microphone to vent your sorrow.', goal: 1, progress: 0, unlocked: false, category: '🏆 Core Achievements' },
  // Daily Life Failures
  JUST_ANOTHER_TUESDAY: { id: 'JUST_ANOTHER_TUESDAY', name: 'Just Another Tuesday', description: 'Used the app three days in a row.', goal: 3, progress: 0, unlocked: false, category: '💬 Daily Life Failures' },
  GROUNDHOG_DAY: { id: 'GROUNDHOG_DAY', name: 'Groundhog Day', description: 'Had the exact same complaint twice.', goal: 1, progress: 0, unlocked: false, category: '💬 Daily Life Failures' },
  MONDAY_SURVIVOR: { id: 'MONDAY_SURVIVOR', name: 'Monday Survivor', description: 'Opened the app before 9 a.m. on a Monday.', goal: 1, progress: 0, unlocked: false, category: '💬 Daily Life Failures' },
  EXISTENTIAL_LOOP: { id: 'EXISTENTIAL_LOOP', name: 'Existential Loop', description: 'Typed “I’m tired.”', goal: 1, progress: 0, unlocked: false, category: '💬 Daily Life Failures' },
  DEJA_DISAPPOINTMENT: { id: 'DEJA_DISAPPOINTMENT', name: 'Déjà Disappointment', description: 'Copy-pasted the same story from yesterday.', goal: 1, progress: 0, unlocked: false, category: '💬 Daily Life Failures' },
  // Emotional Achievements
  MILDLY_SHATTERED: { id: 'MILDLY_SHATTERED', name: 'Mildly Shattered', description: 'Rated your mood as “Not great.” (Score 4-6)', goal: 1, progress: 0, unlocked: false, category: '😭 Emotional Achievements' },
  FULLY_CRUSHED: { id: 'FULLY_CRUSHED', name: 'Fully Crushed', description: 'Rated your mood as “I give up.” (Score 7+)', goal: 7, progress: 0, unlocked: false, category: '😭 Emotional Achievements' },
  TEAR_STAINED_CONFESSION: { id: 'TEAR_STAINED_CONFESSION', name: 'Tear-Stained Confession', description: 'Told Panda something really personal.', goal: 1, progress: 0, unlocked: false, category: '😭 Emotional Achievements' },
  THERAPIST_WONT_HEAR_THIS: { id: 'THERAPIST_WONT_HEAR_THIS', name: 'The Therapist Won’t Hear This', description: 'Shared a secret.', goal: 1, progress: 0, unlocked: false, category: '😭 Emotional Achievements' },
  EMOTIONAL_OVERDRAFT: { id: 'EMOTIONAL_OVERDRAFT', name: 'Emotional Overdraft', description: 'Complained about the same person.', goal: 1, progress: 0, unlocked: false, category: '😭 Emotional Achievements' },
  // Relationship Chaos
  GHOSTED_AGAIN: { id: 'GHOSTED_AGAIN', name: 'Ghosted Again', description: 'Mentioned someone stopped replying.', goal: 1, progress: 0, unlocked: false, category: '💔 Relationship Chaos' },
  ITS_COMPLICATED: { id: 'ITS_COMPLICATED', name: 'It’s Complicated', description: 'Used the words love, hate, or why me in one chat.', goal: 1, progress: 0, unlocked: false, category: '💔 Relationship Chaos' },
  EMOTIONAL_GYMNAST: { id: 'EMOTIONAL_GYMNAST', name: 'Emotional Gymnast', description: 'Justified someone’s bad behavior.', goal: 1, progress: 0, unlocked: false, category: '💔 Relationship Chaos' },
  ROM_COM_REJECT: { id: 'ROM_COM_REJECT', name: 'Rom-Com Reject', description: 'Said “maybe they’ll change.”', goal: 1, progress: 0, unlocked: false, category: '💔 Relationship Chaos' },
  UNSENT_MESSAGE_HERO: { id: 'UNSENT_MESSAGE_HERO', name: 'Unsent Message Hero', description: 'Admitted to deleting a message before sending.', goal: 1, progress: 0, unlocked: false, category: '💔 Relationship Chaos' },
  // Existential & Deep Thoughts
  PHILOSOPHER_IN_PAJAMAS: { id: 'PHILOSOPHER_IN_PAJAMAS', name: 'Philosopher in Pajamas', description: 'Asked, “What’s the point?”', goal: 1, progress: 0, unlocked: false, category: '🧠 Existential & Deep Thoughts' },
  UNIVERSE_DOESNT_CARE: { id: 'UNIVERSE_DOESNT_CARE', name: 'The Universe Doesn’t Care', description: 'Used the word universe, fate, or meaningless.', goal: 1, progress: 0, unlocked: false, category: '🧠 Existential & Deep Thoughts' },
  MIDLIFE_CRISIS_EARLY_EDITION: { id: 'MIDLIFE_CRISIS_EARLY_EDITION', name: 'Midlife Crisis (Early Edition)', description: 'Questioned your purpose.', goal: 1, progress: 0, unlocked: false, category: '🧠 Existential & Deep Thoughts' },
  SCREAMED_INTO_THE_VOID: { id: 'SCREAMED_INTO_THE_VOID', name: 'Screamed Into the Void', description: 'Sent a message with only “…”', goal: 1, progress: 0, unlocked: false, category: '🧠 Existential & Deep Thoughts' },
  NIHILIST_LEVEL_10: { id: 'NIHILIST_LEVEL_10', name: 'Nihilist Level 10', description: 'Agreed with Panda.', goal: 1, progress: 0, unlocked: false, category: '🧠 Existential & Deep Thoughts' },
  // Tech & Social Media
  DOOMSCROLL_MASTER: { id: 'DOOMSCROLL_MASTER', name: 'Doomscroll Master', description: 'Mentioned scrolling Insta or TikTok.', goal: 1, progress: 0, unlocked: false, category: '📱 Tech & Social Media' },
  MESSAGE_SEEN_IGNORED: { id: 'MESSAGE_SEEN_IGNORED', name: 'Message Seen. Ignored.', description: 'Complained about being left on read.', goal: 1, progress: 0, unlocked: false, category: '📱 Tech & Social Media' },
  SOCIAL_MEDIA_ARCHEOLOGIST: { id: 'SOCIAL_MEDIA_ARCHEOLOGIST', name: 'Social Media Archeologist', description: 'Admitted to stalking an ex.', goal: 1, progress: 0, unlocked: false, category: '📱 Tech & Social Media' },
  INFINITE_LOOP_OF_VALIDATION: { id: 'INFINITE_LOOP_OF_VALIDATION', name: 'Infinite Loop of Validation', description: 'Asked if someone cares.', goal: 1, progress: 0, unlocked: false, category: '📱 Tech & Social Media' },
  SCREEN_TIME_DONT_ASK: { id: 'SCREEN_TIME_DONT_ASK', name: 'Screen Time? Don’t Ask.', description: 'Opened the app after midnight.', goal: 1, progress: 0, unlocked: false, category: '📱 Tech & Social Media' },
  // Lifestyle & Habits
  DINNER_OF_CHAMPIONS: { id: 'DINNER_OF_CHAMPIONS', name: 'Dinner of Champions', description: 'Mentioned eating cereal or junk food for dinner.', goal: 1, progress: 0, unlocked: false, category: '🍕 Lifestyle & Habits' },
  PRODUCTIVITY_IS_A_MYTH: { id: 'PRODUCTIVITY_IS_A_MYTH', name: 'Productivity is a Myth', description: 'Complained about procrastinating.', goal: 1, progress: 0, unlocked: false, category: '🍕 Lifestyle & Habits' },
  GYM_TOMORROW: { id: 'GYM_TOMORROW', name: 'Gym Tomorrow', description: 'Promised to work out soon. Again.', goal: 1, progress: 0, unlocked: false, category: '🍕 Lifestyle & Habits' },
  FINANCIAL_DISASTERPIECE: { id: 'FINANCIAL_DISASTERPIECE', name: 'Financial Disasterpiece', description: 'Said “I’m broke.”', goal: 1, progress: 0, unlocked: false, category: '🍕 Lifestyle & Habits' },
  SLEEP_OPTIONAL: { id: 'SLEEP_OPTIONAL', name: 'Sleep Optional', description: 'Opened the app after 3 a.m.', goal: 1, progress: 0, unlocked: false, category: '🍕 Lifestyle & Habits' },
  // Self-Reflection & Growth (Kind of)
  ACCIDENTAL_SELF_AWARENESS: { id: 'ACCIDENTAL_SELF_AWARENESS', name: 'Accidental Self-Awareness', description: 'Realized you might be the problem.', goal: 1, progress: 0, unlocked: false, category: '🧘 Self-Reflection & Growth (Kind of)' },
  GROWTH_HURTS: { id: 'GROWTH_HURTS', name: 'Growth Hurts', description: 'Thanked Panda for the truth.', goal: 1, progress: 0, unlocked: false, category: '🧘 Self-Reflection & Growth (Kind of)' },
  DETACHED_AND_PROUD: { id: 'DETACHED_AND_PROUD', name: 'Detached and Proud', description: 'Said “I don’t care anymore.”', goal: 1, progress: 0, unlocked: false, category: '🧘 Self-Reflection & Growth (Kind of)' },
  MICRODOSE_OF_ACCEPTANCE: { id: 'MICRODOSE_OF_ACCEPTANCE', name: 'Microdose of Acceptance', description: 'Admitted Panda was right.', goal: 1, progress: 0, unlocked: false, category: '🧘 Self-Reflection & Growth (Kind of)' },
  ENLIGHTENMENT_WITH_A_HANGOVER: { id: 'ENLIGHTENMENT_WITH_A_HANGOVER', name: 'Enlightenment (with a Hangover)', description: 'Logged a week without complaining.', goal: 1, progress: 0, unlocked: false, category: '🧘 Self-Reflection & Growth (Kind of)' },
  // Hidden / Easter Egg Trophies
  HAPPINESS_404_NOT_FOUND: { id: 'HAPPINESS_404_NOT_FOUND', name: '404 Happiness Not Found', description: 'Tried typing “I’m happy.”', goal: 1, progress: 0, unlocked: false, category: '🧨 Hidden / Easter Egg Trophies' },
  SECRETLY_HOPEFUL: { id: 'SECRETLY_HOPEFUL', name: 'Secretly Hopeful', description: 'Said “things are getting better.”', goal: 1, progress: 0, unlocked: false, category: '🧨 Hidden / Easter Egg Trophies' },
  DEVELOPERS_FAVORITE: { id: 'DEVELOPERS_FAVORITE', name: 'Developer’s Favorite', description: 'Found a hidden joke in the settings.', goal: 1, progress: 0, unlocked: false, category: '🧨 Hidden / Easter Egg Trophies' },
  DISAPPOINTMENT_CONNOISSEUR: { id: 'DISAPPOINTMENT_CONNOISSEUR', name: 'Disappointment Connoisseur', description: 'Collected 20 trophies.', goal: 20, progress: 0, unlocked: false, category: '🧨 Hidden / Easter Egg Trophies' },
  YOU_WIN_NOTHING: { id: 'YOU_WIN_NOTHING', name: 'You Win Nothing.', description: 'Collected all trophies.', goal: 40, progress: 0, unlocked: false, category: '🧨 Hidden / Easter Egg Trophies' },
};
const TOTAL_ACHIEVEMENTS = Object.keys(initialAchievements).length;


// Fix: Replaced the static INITIAL_CONVERSATION object with a function to ensure a fresh, unique conversation is created each time.
const createNewConversation = (): Conversation => ({
    id: `new-${Date.now()}`,
    title: 'New Chat',
    messages: [{ role: 'panda', text: "So, you're here. Spit it out. What fresh disappointment does the day hold?", reaction: 'none' }],
    date: new Date().toISOString()
});


const PandaAvatar: React.FC<{ mode: AppMode }> = ({ mode }) => (
    <div className="relative w-20 h-20 flex items-center justify-center">
        <PandaMascotIcon className="w-full h-full" />
        {mode === 'premium' && <span className="absolute top-0 right-0 text-2xl" title="Premium Mode">👑</span>}
        {mode === 'elite' && <span className="absolute top-0 right-0 text-2xl" title="Elite Mode">💎</span>}
    </div>
);

const reactionMap: Record<PandaReaction, string> = {
    'eye-roll': '😒',
    'facepalm': '🤦‍♂️',
    'shrug': '🤷',
    'slow-clap': '👏',
    'none': ''
};

const PandaReactionIcon: React.FC<{ reaction: PandaReaction }> = ({ reaction }) => {
    const emoji = reactionMap[reaction];
    if (!emoji) return null;

    return (
        <div className="absolute -top-3 -right-2 text-2xl bg-gray-200 dark:bg-gray-700 rounded-full p-1 shadow-md animate-pop-in" style={{ transformOrigin: 'bottom left' }}>
            {emoji}
        </div>
    );
};


const MessageBubble: React.FC<{ message: ChatMessage, onPlayAudio?: () => void }> = ({ message, onPlayAudio }) => {
    const isPanda = message.role === 'panda';
    const bubbleClasses = isPanda
        ? 'bg-gray-200 dark:bg-gray-700 rounded-r-lg rounded-bl-lg'
        : 'bg-yellow-600 rounded-l-lg rounded-br-lg';

    return (
        <div className={`w-full flex my-2 ${isPanda ? 'justify-start items-start gap-3' : 'justify-end'}`}>
            {isPanda && (
                <div className="w-10 h-10 flex-shrink-0">
                    <PandaMascotIcon className="w-full h-full" />
                </div>
            )}
            <div className={`max-w-md md:max-w-lg p-3 relative ${isPanda ? 'text-gray-900 dark:text-white' : 'text-white'} ${bubbleClasses} flex items-center gap-3`}>
                {isPanda && message.reaction && message.reaction !== 'none' && (
                    <PandaReactionIcon reaction={message.reaction} />
                )}
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.audioBuffer && onPlayAudio && (
                    <button onClick={onPlayAudio} className={`p-2 rounded-full transition-colors ${message.isPlaying ? 'bg-yellow-500 text-gray-900 animate-pulse' : 'bg-gray-500 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'}`}>
                        <SpeakerIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

const TypingIndicator: React.FC = () => (
    <div className="flex items-center space-x-1.5 h-5 px-2">
        <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full"></span>
        <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full"></span>
        <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full"></span>
    </div>
);

const ModeSelector: React.FC<{ selectedMode: AppMode, onSelectMode: (mode: AppMode) => void }> = ({ selectedMode, onSelectMode }) => {
    const modes: { id: AppMode, label: string, desc: string }[] = [
        { id: 'standard', label: 'Standard', desc: 'Text-only chat with the panda.' },
        { id: 'premium', label: 'Premium 👑', desc: 'Unlocks spoken responses & microphone input.' },
        { id: 'elite', label: 'Elite 💎', desc: 'All features & progress tracking.' }
    ];

    return (
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
            {modes.map(mode => (
                <button
                    key={mode.id}
                    onClick={() => onSelectMode(mode.id)}
                    className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors focus:outline-none ${
                        selectedMode === mode.id
                            ? 'bg-yellow-500 text-gray-900 shadow'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                    title={mode.desc}
                >
                    {mode.label}
                </button>
            ))}
        </div>
    );
};

const AchievementToast: React.FC<{ achievement: Achievement, onClose: () => void }> = ({ achievement, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-5 right-5 bg-white dark:bg-gray-800 border border-yellow-500 text-gray-900 dark:text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-in-right">
            <TrophyIcon className="w-8 h-8 text-yellow-400" />
            <div>
                <p className="font-bold">Achievement Unlocked!</p>
                <p className="text-sm text-gray-500 dark:text-gray-300">{achievement.name}</p>
            </div>
        </div>
    );
};

const AchievementItem: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
    const progressPercentage = Math.min((achievement.progress / achievement.goal) * 100, 100);
    return (
        <div className={`p-4 rounded-lg transition-all ${achievement.unlocked ? 'bg-yellow-500 text-gray-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <div className="flex justify-between items-center">
                {/* Fix: Corrected typo from `hh4` to `h4` for the heading element. */}
                <h4 className="font-bold">{achievement.name}</h4>
                {achievement.unlocked && <span className="text-2xl">🏆</span>}
            </div>
            <p className="text-sm mt-1">{achievement.description}</p>
            {!achievement.unlocked && (
                <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 mt-3">
                    <div
                        className="bg-yellow-400 h-2.5 rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
            )}
        </div>
    );
};

const AchievementsModal: React.FC<{ achievements: Achievement[], onClose: () => void }> = ({ achievements, onClose }) => {
    const groupedAchievements = achievements.reduce((acc, ach) => {
        if (!acc[ach.category]) {
            acc[ach.category] = [];
        }
        acc[ach.category].push(ach);
        return acc;
    }, {} as Record<AchievementCategory, Achievement[]>);

    const categoryOrder: AchievementCategory[] = [
        '🏆 Core Achievements',
        '💬 Daily Life Failures',
        '😭 Emotional Achievements',
        '💔 Relationship Chaos',
        '🧠 Existential & Deep Thoughts',
        '📱 Tech & Social Media',
        '🍕 Lifestyle & Habits',
        '🧘 Self-Reflection & Growth (Kind of)',
        '🧨 Hidden / Easter Egg Trophies',
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-center text-yellow-600 dark:text-yellow-400">Your Trophy Case of Misery</h3>
                    <button onClick={onClose} className="absolute top-3 right-3 p-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-red-500">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 h-[60vh] overflow-y-auto">
                    {categoryOrder.map(category => (
                        groupedAchievements[category] && (
                            <div key={category} className="mb-4">
                                <h4 className="font-bold text-yellow-600 dark:text-yellow-400 mb-2">{category}</h4>
                                <div className="space-y-3">
                                    {groupedAchievements[category].map(ach => (
                                        <AchievementItem key={ach.id} achievement={ach} />
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>
        </div>
    );
};


const PinModal: React.FC<{
    mode: 'set' | 'enter';
    onConfirm: (pin: string) => void;
    onClose: () => void;
    error?: string;
}> = ({ mode, onConfirm, onClose, error }) => {
    const [pin, setPin] = useState('');
    const title = mode === 'set' ? 'Set Your 4-Digit PIN' : 'Enter PIN to Unlock';
    const buttonLabel = mode === 'set' ? 'Set PIN' : 'Unlock';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length === 4) {
            onConfirm(pin);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6">
                <h3 className="text-xl font-semibold text-center text-yellow-600 dark:text-yellow-400 mb-4">{title}</h3>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setPin(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white text-center text-2xl tracking-[1rem] p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        maxLength={4}
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
                    <div className="flex justify-center gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors">Cancel</button>
                        <button type="submit" disabled={pin.length !== 4} className="px-6 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white transition-colors">
                            {buttonLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DailyTruthModal: React.FC<{
    truth: string | null;
    isLoading: boolean;
    onClose: () => void;
}> = ({ truth, isLoading, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 text-center">
            <h3 className="text-xl font-semibold text-yellow-600 dark:text-yellow-400 mb-4">Your Daily Dose of Truth</h3>
            <div className="min-h-[80px] flex items-center justify-center">
                {isLoading ? (
                    <TypingIndicator />
                ) : (
                    <p className="text-lg italic text-gray-600 dark:text-gray-300">"{truth}"</p>
                )}
            </div>
            <button onClick={onClose} className="mt-6 px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors">
                Close
            </button>
        </div>
    </div>
);


const groupConversationsByDate = (conversations: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {
        'Today': [],
        'Yesterday': [],
        'Previous 7 Days': [],
        'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    conversations.forEach(convo => {
        const convoDate = new Date(convo.date);
        if (convoDate >= today) {
            groups['Today'].push(convo);
        } else if (convoDate >= yesterday) {
            groups['Yesterday'].push(convo);
        } else if (convoDate >= lastWeek) {
            groups['Previous 7 Days'].push(convo);
        } else {
            groups['Older'].push(convo);
        }
    });

    return groups;
};

const HistoryPanel: React.FC<{
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    isLocked: boolean;
    onToggleLock: () => void;
    onClearPin: () => void;
}> = ({ conversations, activeConversationId, onSelect, onNew, onDelete, isLocked, onToggleLock, onClearPin }) => {
    
    const grouped = groupConversationsByDate(conversations);

    return (
        <aside className="w-full md:w-72 bg-gray-100 dark:bg-gray-800 flex flex-col h-full border-r border-gray-300 dark:border-gray-700">
            <div className="p-3 flex justify-between items-center border-b border-gray-300 dark:border-gray-700">
                <button onClick={onNew} className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    New Chat
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={onToggleLock} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title={isLocked ? "Unlock History" : "Lock History"}>
                        {isLocked ? <LockIcon className="w-5 h-5" /> : <UnlockIcon className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />}
                    </button>
                     {!isLocked && (
                         <button onClick={onClearPin} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-red-500" title="Clear PIN">
                             <TrashIcon className="w-5 h-5" />
                         </button>
                     )}
                </div>
            </div>
            
            {isLocked ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-500 p-4 text-center">
                    <LockIcon className="w-12 h-12 mb-4"/>
                    <h3 className="font-semibold">History Locked</h3>
                    <p className="text-sm">Enter your PIN to view past conversations.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {Object.entries(grouped).map(([groupName, convos]) => (
                        convos.length > 0 && (
                            <div key={groupName} className="p-3">
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-500 uppercase px-2 mb-1">{groupName}</h3>
                                {convos.map(convo => (
                                    <div key={convo.id} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${activeConversationId === convo.id ? 'bg-yellow-600 text-white dark:text-gray-900' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => onSelect(convo.id)}>
                                        <p className="truncate text-sm">{convo.title}</p>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(convo.id) }} className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-400 hover:text-red-500 p-1">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    ))}
                </div>
            )}
        </aside>
    );
};

const App: React.FC = () => {
    // Fix: Use the createNewConversation function for the initial state to avoid object reuse issues.
    const [conversations, setConversations] = useState<Conversation[]>(() => [createNewConversation()]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(conversations[0].id);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<AppMode>('standard');
    const [progressData, setProgressData] = useState<ProgressPoint[]>([]);
    const [showChart, setShowChart] = useState(false);
    const [showAchievementsModal, setShowAchievementsModal] = useState(false);
    const [achievements, setAchievements] = useState<Record<AchievementId, Achievement>>(initialAchievements);
    const [streak, setStreak] = useState(0);
    const [lastInteractionDate, setLastInteractionDate] = useState<string | null>(null);
    const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
    const [finalAchievementUnlocked, setFinalAchievementUnlocked] = useState(false);
    
    // --- Theme State ---
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // --- Live Session State ---
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [currentUserTranscription, setCurrentUserTranscription] = useState('');
    const [currentPandaTranscription, setCurrentPandaTranscription] = useState('');
    const liveSessionPromiseRef = useRef<any>(null); // Using `any` due to lack of exported Session type
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef<number>(0);
    const audioPlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentUserTranscriptionRef = useRef('');
    const currentPandaTranscriptionRef = useRef('');

    // --- History Panel State ---
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [isHistoryLocked, setIsHistoryLocked] = useState(false);
    const [historyPin, setHistoryPin] = useState<string|null>(null);
    const [showPinModal, setShowPinModal] = useState<{ visible: boolean; mode: 'set' | 'enter'; error?: string }>({ visible: false, mode: 'set' });

    // --- Daily Truth State ---
    const [dailyTruth, setDailyTruth] = useState<string | null>(null);
    const [isDailyTruthLoading, setIsDailyTruthLoading] = useState(false);
    const [showDailyTruthModal, setShowDailyTruthModal] = useState(false);
    const [lastDailyTruthDate, setLastDailyTruthDate] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const textToSpeechAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    const activeConversation = conversations.find(c => c.id === activeConversationId) ?? conversations[0];
    const messages = activeConversation?.messages ?? [];

    // Helper to lazily create and ensure the main AudioContext is running
    const ensureAudioContextRunning = useCallback(async (): Promise<AudioContext> => {
        let ctx = audioContextRef.current;
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (e) {
                console.error("Could not resume AudioContext:", e);
            }
        }
        return ctx;
    }, []);

    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('pandaTheme');
            if (savedTheme === 'light' || savedTheme === 'dark') {
                setTheme(savedTheme);
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                setTheme('light');
            }

            const savedConvos = localStorage.getItem('pandaConversations');
            if (savedConvos) {
                const parsedConvos = JSON.parse(savedConvos);
                if (parsedConvos.length > 0) {
                    setConversations(parsedConvos);
                    setActiveConversationId(parsedConvos[0].id);
                }
            }

            const savedPin = localStorage.getItem('pandaHistoryPin');
            if (savedPin) {
                setHistoryPin(savedPin);
                setIsHistoryLocked(true);
            }

            // Other saved data...
            const savedProgress = localStorage.getItem('pandaProgressData');
            if (savedProgress) setProgressData(JSON.parse(savedProgress));
            const savedAchievements = localStorage.getItem('pandaAchievements');
            if (savedAchievements) {
                const parsedAchievements = JSON.parse(savedAchievements);
                // Merge saved with initial to account for new achievements
                const mergedAchievements = {...initialAchievements};
                for(const key in parsedAchievements) {
                    if (mergedAchievements[key as AchievementId]) {
                        mergedAchievements[key as AchievementId] = parsedAchievements[key];
                    }
                }
                setAchievements(mergedAchievements);
                if(mergedAchievements['YOU_WIN_NOTHING'].unlocked){
                    setFinalAchievementUnlocked(true);
                }
            }
            const savedStreak = localStorage.getItem('pandaStreak');
            if(savedStreak) setStreak(JSON.parse(savedStreak));
            const savedDate = localStorage.getItem('pandaLastInteraction');
            if(savedDate) {
                setLastInteractionDate(savedDate);
                const today = new Date().toDateString();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (savedDate !== today && savedDate !== yesterday.toDateString()) {
                    setStreak(0);
                }
            }
            const savedDailyTruthDate = localStorage.getItem('pandaLastDailyTruthDate');
            if (savedDailyTruthDate) setLastDailyTruthDate(savedDailyTruthDate);

        } catch (error) {
            console.error("Failed to load data from localStorage", error);
        }
    }, []);

    useEffect(() => {
        // Theme effect
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        try {
            localStorage.setItem('pandaTheme', theme);
            if (conversations.length > 1 || conversations[0].messages.length > 1) {
              localStorage.setItem('pandaConversations', JSON.stringify(conversations));
            }
            localStorage.setItem('pandaProgressData', JSON.stringify(progressData));
            localStorage.setItem('pandaAchievements', JSON.stringify(achievements));
            localStorage.setItem('pandaStreak', JSON.stringify(streak));
            if(lastInteractionDate) localStorage.setItem('pandaLastInteraction', lastInteractionDate);
            if(historyPin) localStorage.setItem('pandaHistoryPin', historyPin);
            else localStorage.removeItem('pandaHistoryPin');
            if(lastDailyTruthDate) localStorage.setItem('pandaLastDailyTruthDate', lastDailyTruthDate);
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [theme, conversations, progressData, achievements, streak, lastInteractionDate, historyPin, lastDailyTruthDate]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, currentUserTranscription, currentPandaTranscription]);

    const playTrophySound = useCallback(async () => {
        try {
            const audioCtx = await ensureAudioContextRunning();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            
            oscillator.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.4);
        } catch (error) {
            console.error("Failed to play trophy sound:", error);
        }
    }, [ensureAudioContextRunning]);

    const updateAchievementProgress = useCallback((id: AchievementId, value: number, isAbsolute = false) => {
        setAchievements(prev => {
            const achievement = prev[id];
            if (!achievement || achievement.unlocked) return prev;

            const newProgress = isAbsolute ? Math.max(achievement.progress, value) : achievement.progress + value;
            if (newProgress >= achievement.goal) {
                const unlockedAchievement = { ...achievement, progress: achievement.goal, unlocked: true };
                setUnlockedAchievement(unlockedAchievement);
                playTrophySound();
                
                const newState = { ...prev, [id]: unlockedAchievement };
                const unlockedCount = Object.values(newState).filter(a => a.unlocked).length;

                // Check for meta-achievements
                if (unlockedCount >= 20 && !newState.DISAPPOINTMENT_CONNOISSEUR.unlocked) {
                    const connoisseur = { ...newState.DISAPPOINTMENT_CONNOISSEUR, progress: 20, unlocked: true };
                    newState.DISAPPOINTMENT_CONNOISSEUR = connoisseur;
                    setUnlockedAchievement(connoisseur);
                }
                if (unlockedCount >= TOTAL_ACHIEVEMENTS && !newState.YOU_WIN_NOTHING.unlocked) {
                    const final = { ...newState.YOU_WIN_NOTHING, progress: TOTAL_ACHIEVEMENTS, unlocked: true };
                    newState.YOU_WIN_NOTHING = final;
                    setUnlockedAchievement(final);
                    setFinalAchievementUnlocked(true);
                }
                
                return newState;
            }
            return { ...prev, [id]: { ...achievement, progress: newProgress } };
        });
    }, [playTrophySound]);
    
    const playAudio = useCallback(async (buffer: AudioBuffer, messageId: string) => {
        try {
            const audioCtx = await ensureAudioContextRunning();
            
            if (textToSpeechAudioSourceRef.current) {
                textToSpeechAudioSourceRef.current.onended = null;
                textToSpeechAudioSourceRef.current.stop();
            }

            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
            textToSpeechAudioSourceRef.current = source;
            
            setConversations(prev => prev.map(c => c.id === activeConversationId ? {...c, messages: c.messages.map((msg, idx) => ({ ...msg, isPlaying: `${c.id}-${idx}` === messageId }))} : c ));
            source.onended = () => {
                if (textToSpeechAudioSourceRef.current === source) {
                    setConversations(prev => prev.map(c => c.id === activeConversationId ? {...c, messages: c.messages.map(msg => ({...msg, isPlaying: false}))} : c));
                    textToSpeechAudioSourceRef.current = null;
                }
            };
        } catch (error) {
            console.error("Error playing audio:", error);
        }
    }, [activeConversationId, ensureAudioContextRunning]);

    const checkContentBasedAchievements = useCallback((text: string) => {
        const lowerText = text.toLowerCase();
        
        // Daily Life
        if (lowerText.includes("i'm tired")) updateAchievementProgress('EXISTENTIAL_LOOP', 1);

        // Relationship Chaos
        if (lowerText.includes('ghosted') || lowerText.includes('stopped replying')) updateAchievementProgress('GHOSTED_AGAIN', 1);
        if (lowerText.includes('love') && lowerText.includes('hate') || lowerText.includes('why me')) updateAchievementProgress('ITS_COMPLICATED', 1);
        if (lowerText.includes('but he') || lowerText.includes('but she') || lowerText.includes('deep down')) updateAchievementProgress('EMOTIONAL_GYMNAST', 1);
        if (lowerText.includes('maybe') && lowerText.includes('change')) updateAchievementProgress('ROM_COM_REJECT', 1);
        if (lowerText.includes('deleted') && lowerText.includes('message')) updateAchievementProgress('UNSENT_MESSAGE_HERO', 1);

        // Existential
        if (lowerText.includes("what's the point")) updateAchievementProgress('PHILOSOPHER_IN_PAJAMAS', 1);
        if (lowerText.includes('universe') || lowerText.includes('fate') || lowerText.includes('meaningless')) updateAchievementProgress('UNIVERSE_DOESNT_CARE', 1);
        if (lowerText.includes('purpose') || lowerText.includes('what am i doing')) updateAchievementProgress('MIDLIFE_CRISIS_EARLY_EDITION', 1);
        if (text.trim() === '...') updateAchievementProgress('SCREAMED_INTO_THE_VOID', 1);
        if (lowerText.includes('i agree') || lowerText.includes("you're right")) updateAchievementProgress('NIHILIST_LEVEL_10', 1);

        // Tech & Social Media
        if (lowerText.includes('insta') || lowerText.includes('tiktok') || lowerText.includes('scrolling')) updateAchievementProgress('DOOMSCROLL_MASTER', 1);
        if (lowerText.includes('left on read') || lowerText.includes('seen my message')) updateAchievementProgress('MESSAGE_SEEN_IGNORED', 1);
        if (lowerText.includes('stalking') && lowerText.includes('ex')) updateAchievementProgress('SOCIAL_MEDIA_ARCHEOLOGIST', 1);
        if (lowerText.includes('do they care') || lowerText.includes('if they care')) updateAchievementProgress('INFINITE_LOOP_OF_VALIDATION', 1);

        // Lifestyle & Habits
        if (lowerText.includes('cereal for dinner') || lowerText.includes('junk food for dinner')) updateAchievementProgress('DINNER_OF_CHAMPIONS', 1);
        if (lowerText.includes('procrastinat')) updateAchievementProgress('PRODUCTIVITY_IS_A_MYTH', 1);
        if (lowerText.includes('gym tomorrow') || lowerText.includes('work out soon')) updateAchievementProgress('GYM_TOMORROW', 1);
        if (lowerText.includes("i'm broke")) updateAchievementProgress('FINANCIAL_DISASTERPIECE', 1);

        // Self-Reflection
        if (lowerText.includes('maybe i') && lowerText.includes('the problem')) updateAchievementProgress('ACCIDENTAL_SELF_AWARENESS', 1);
        if (lowerText.includes('thank you panda') || lowerText.includes('thanks panda')) updateAchievementProgress('GROWTH_HURTS', 1);
        if (lowerText.includes("i don't care anymore")) updateAchievementProgress('DETACHED_AND_PROUD', 1);
        if (lowerText.includes("you're right") || lowerText.includes("that's true")) updateAchievementProgress('MICRODOSE_OF_ACCEPTANCE', 1);

        // Hidden
        if (lowerText.includes("i'm happy")) updateAchievementProgress('HAPPINESS_404_NOT_FOUND', 1);
        if (lowerText.includes('getting better')) updateAchievementProgress('SECRETLY_HOPEFUL', 1);

    }, [updateAchievementProgress]);

    const handleSendMessage = useCallback(async () => {
        if (!input.trim() || isLoading || !activeConversationId) return;
        
        const audioCtx = await ensureAudioContextRunning();
        const userInput: ChatMessage = { role: 'user', text: input.trim() };
        const isFirstMessage = activeConversation?.messages.length === 1;
        
        setInput(''); setIsLoading(true);
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, userInput] } : c ));
        
        // Handle achievements
        const now = new Date();
        const today = now.toDateString();
        if (lastInteractionDate !== today) {
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const newStreak = lastInteractionDate === yesterday.toDateString() ? streak + 1 : 1;
            setStreak(newStreak);
            updateAchievementProgress('CONSISTENT_COMPLAINER', newStreak, true);
            updateAchievementProgress('JUST_ANOTHER_TUESDAY', newStreak, true);
            updateAchievementProgress('WEEKLY_WHINER', newStreak, true);
        }
        setLastInteractionDate(today);
        updateAchievementProgress('GLUTTON_FOR_PUNISHMENT', 1);
        
        const hour = now.getHours();
        const day = now.getDay();
        if(day === 1 && hour < 9) updateAchievementProgress('MONDAY_SURVIVOR', 1);
        if(hour >= 0 && hour < 3) updateAchievementProgress('SCREEN_TIME_DONT_ASK', 1);
        if(hour >= 3 && hour < 6) updateAchievementProgress('SLEEP_OPTIONAL', 1);

        checkContentBasedAchievements(userInput.text);

        if (finalAchievementUnlocked) {
            const finalResponse: ChatMessage = { role: 'panda', text: "Congrats. You completed disappointment.", reaction: 'slow-clap' };
            setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, finalResponse] } : c ));
            setIsLoading(false);
            return;
        }

        try {
            if (mode === 'elite') {
                const sentiment = await analyzeUserSentiment(userInput.text);
                setProgressData(prev => [...prev, sentiment]);
                updateAchievementProgress('BABYS_FIRST_CYNICISM', 1);
                updateAchievementProgress('EMOTIONAL_MASOCHIST', sentiment.score, true);
                if (sentiment.score >= 4 && sentiment.score <= 6) updateAchievementProgress('MILDLY_SHATTERED', 1);
                if (sentiment.score >= 7) updateAchievementProgress('FULLY_CRUSHED', 1);
            }

            let pandaResponse: ChatMessage;
            if (mode === 'premium' || mode === 'elite') {
                const { text, audioBuffer, reaction } = await getPandasSpokenResponse(userInput.text, audioCtx);
                pandaResponse = { role: 'panda', text, audioBuffer, reaction };
            } else {
                const { text, reaction } = await getPandasResponse(userInput.text);
                pandaResponse = { role: 'panda', text, reaction };
            }
            
            setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, pandaResponse] } : c ));
            if (isFirstMessage) {
                const title = await generateConversationTitle(userInput.text, pandaResponse.text);
                setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title } : c ));
            }
            updateAchievementProgress('FIRST_ROAST', 1);

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
            const errorResponse: ChatMessage = { role: 'panda', text: `Ugh, something broke. ${errorMessage}`, reaction: 'facepalm' };
             setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, errorResponse] } : c ));
        } finally { setIsLoading(false); }
    }, [input, isLoading, mode, lastInteractionDate, streak, updateAchievementProgress, activeConversationId, activeConversation, ensureAudioContextRunning, checkContentBasedAchievements, finalAchievementUnlocked]);

    // --- Live Session Logic ---
    const stopLiveSession = useCallback(async () => {
        console.log("Stopping live session...");
        setIsLiveActive(false);

        liveSessionPromiseRef.current?.then((session: any) => session.close());
        liveSessionPromiseRef.current = null;

        microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;

        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();

        audioPlaybackSourcesRef.current.forEach(source => source.stop());
        audioPlaybackSourcesRef.current.clear();
        nextAudioStartTimeRef.current = 0;
    }, []);

    const startLiveSession = useCallback(async () => {
        setIsLiveActive(true);
        const ai = getAi();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextAudioStartTimeRef.current = 0;
            audioPlaybackSourcesRef.current.clear();

            liveSessionPromiseRef.current = ai.live.connect({
                // Fix: Updated model name to one specified for Live API usage in the guidelines.
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: PANDA_SYSTEM_INSTRUCTION,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: GenaiBlob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            liveSessionPromiseRef.current.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            currentUserTranscriptionRef.current += text;
                            setCurrentUserTranscription(currentUserTranscriptionRef.current);
                        }
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentPandaTranscriptionRef.current += text;
                            setCurrentPandaTranscription(currentPandaTranscriptionRef.current);
                        }
                        if (message.serverContent?.turnComplete) {
                             setConversations(prev => {
                                const newMessages: ChatMessage[] = [];
                                if (currentUserTranscriptionRef.current.trim()) {
                                    newMessages.push({ role: 'user', text: currentUserTranscriptionRef.current.trim() });
                                    updateAchievementProgress('VOICE_OF_DESPAIR', 1);
                                }
                                if (currentPandaTranscriptionRef.current.trim()) {
                                    // Live API doesn't support reactions, so we add a default.
                                    newMessages.push({ role: 'panda', text: currentPandaTranscriptionRef.current.trim(), reaction: 'none' });
                                }

                                return prev.map(c => 
                                    c.id === activeConversationId 
                                        ? { ...c, messages: [...c.messages, ...newMessages] }
                                        : c
                                );
                            });
                            currentUserTranscriptionRef.current = '';
                            currentPandaTranscriptionRef.current = '';
                            setCurrentUserTranscription('');
                            setCurrentPandaTranscription('');
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const outputCtx = outputAudioContextRef.current;
                            nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                audioPlaybackSourcesRef.current.delete(source);
                            });
                            
                            source.start(nextAudioStartTimeRef.current);
                            nextAudioStartTimeRef.current += audioBuffer.duration;
                            audioPlaybackSourcesRef.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                            audioPlaybackSourcesRef.current.forEach(source => source.stop());
                            audioPlaybackSourcesRef.current.clear();
                            nextAudioStartTimeRef.current = 0;
                        }
                    },
                    // Fix: Used native browser ErrorEvent type for the onerror callback.
                    onerror: (e: ErrorEvent) => {
                        console.error("Live session error:", e);
                        stopLiveSession();
                    },
                    // Fix: Used native browser CloseEvent type for the onclose callback.
                    onclose: (e: CloseEvent) => {
                        console.log("Live session closed.");
                        stopLiveSession();
                    },
                },
            });

        } catch (error) {
            console.error("Failed to start live session:", error);
            alert("Could not access microphone. Please check permissions and try again.");
            setIsLiveActive(false);
        }
    }, [stopLiveSession, activeConversationId, updateAchievementProgress]);

    const toggleLiveSession = () => {
        if (isLiveActive) {
            stopLiveSession();
        } else {
            startLiveSession();
        }
    };
    
    // --- End Live Session Logic ---


    const handleNewChat = () => {
        if (isLiveActive) stopLiveSession();
        const newConvo: Conversation = createNewConversation();
        setConversations(prev => [newConvo, ...prev]);
        setActiveConversationId(newConvo.id);
        setIsHistoryPanelOpen(false);
    };

    const handleDeleteConversation = (idToDelete: string) => {
        if (isLiveActive) stopLiveSession();
        if (window.confirm("Are you sure? This can't be undone. Not that your thoughts are valuable, but still.")) {
            setConversations(prev => {
                const newConvos = prev.filter(c => c.id !== idToDelete);
                // Fix: If the last conversation is deleted, create a new, fresh one instead of reusing a constant.
                if (newConvos.length === 0) {
                     const freshConvo = createNewConversation();
                     setActiveConversationId(freshConvo.id);
                     return [freshConvo];
                }
                if (activeConversationId === idToDelete) {
                    setActiveConversationId(newConvos[0].id);
                }
                return newConvos;
            });
        }
    };
    
    const handleToggleLock = () => {
        if(isHistoryLocked) { 
            setShowPinModal({ visible: true, mode: 'enter' });
        } else if (historyPin) { 
            setIsHistoryLocked(true);
        } else { 
            setShowPinModal({ visible: true, mode: 'set' });
        }
    }
    
    const handlePinConfirm = (pin: string) => {
        if (showPinModal.mode === 'set') {
            setHistoryPin(pin);
            setIsHistoryLocked(true);
            setShowPinModal({ visible: false, mode: 'set' });
        } else {
            if (pin === historyPin) {
                setIsHistoryLocked(false);
                setShowPinModal({ visible: false, mode: 'enter' });
            } else {
                setShowPinModal(prev => ({ ...prev, error: 'Incorrect PIN. Try again.'}));
            }
        }
    };

    const handleClearPin = () => {
        if (window.confirm("This will remove your PIN and unlock history. Are you sure?")) {
            setHistoryPin(null);
            setIsHistoryLocked(false);
        }
    };

    const handleGetDailyTruth = async () => {
        setShowDailyTruthModal(true);
        setIsDailyTruthLoading(true);
        try {
            const truth = await getDailyDarkTruth();
            setDailyTruth(truth);
            setLastDailyTruthDate(new Date().toDateString());
        } catch (error) {
            setDailyTruth("The panda is too busy contemplating the void to give you a truth today.");
        } finally {
            setIsDailyTruthLoading(false);
        }
    };

    const handleThemeToggle = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    const isDailyTruthAvailable = lastDailyTruthDate !== new Date().toDateString();


    return (
        <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
            <div className={`fixed inset-0 z-20 md:static md:z-auto md:block transition-transform duration-300 ${isHistoryPanelOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <HistoryPanel
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelect={(id) => { setActiveConversationId(id); setIsHistoryPanelOpen(false); if (isLiveActive) stopLiveSession(); }}
                    onNew={handleNewChat}
                    onDelete={handleDeleteConversation}
                    isLocked={isHistoryLocked}
                    onToggleLock={handleToggleLock}
                    onClearPin={handleClearPin}
                />
            </div>
            
            <div className="flex-1 flex flex-col h-screen relative">
                {isHistoryPanelOpen && <div className="absolute inset-0 bg-black bg-opacity-50 z-10 md:hidden" onClick={() => setIsHistoryPanelOpen(false)}></div>}
                
                {unlockedAchievement && (
                    <AchievementToast
                        achievement={unlockedAchievement}
                        onClose={() => setUnlockedAchievement(null)}
                    />
                )}
                
                <header className="relative p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 text-center flex items-center justify-center">
                    <button onClick={() => setIsHistoryPanelOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-4 p-2 md:hidden">
                        <MenuIcon className="w-6 h-6"/>
                    </button>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 tracking-wider">Disappointement Panda</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Your daily dose of harsh reality.</p>
                    </div>
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-yellow-500 dark:text-yellow-400 text-lg font-bold" title={`${streak}-day streak`}>
                        <span>{streak}</span>
                        <FlameIcon className="w-6 h-6" />
                    </div>
                </header>

                <main className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="flex flex-col items-center mb-4">
                        <PandaAvatar mode={mode} />
                    </div>
                    <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto">
                        {messages.map((msg, index) => (
                            <MessageBubble key={`${activeConversationId}-${index}`} message={msg} onPlayAudio={msg.audioBuffer ? () => playAudio(msg.audioBuffer!, `${activeConversationId}-${index}`) : undefined} />
                        ))}
                         {isLiveActive && currentUserTranscription && (
                            <MessageBubble message={{ role: 'user', text: currentUserTranscription }} />
                        )}
                        {isLiveActive && currentPandaTranscription && (
                            <MessageBubble message={{ role: 'panda', text: currentPandaTranscription, reaction: 'none' }} />
                        )}
                        {isLoading && !isLiveActive && (
                            <div className="w-full flex justify-start items-start gap-3">
                                 <div className="w-10 h-10 flex-shrink-0">
                                    <PandaMascotIcon className="w-full h-full" />
                                </div>
                                <div className="p-2 my-2 bg-gray-200 dark:bg-gray-700 self-start rounded-r-lg rounded-bl-lg">
                                    <TypingIndicator />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </main>

                <footer className="p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700">
                    <div className="w-full max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-3 px-2">
                            <ModeSelector selectedMode={mode} onSelectMode={setMode} />
                            <div className="flex items-center gap-2">
                                 <button onClick={handleThemeToggle} className="p-2 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                                    {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                                 </button>
                                <button onClick={handleGetDailyTruth} className="p-2 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors disabled:text-gray-400/50 dark:disabled:text-gray-600 disabled:cursor-not-allowed" title={isDailyTruthAvailable ? "Get Daily Truth" : "Available tomorrow"} disabled={!isDailyTruthAvailable}>
                                    <CalendarTodayIcon className="w-6 h-6" />
                                </button>
                                <button onClick={() => setShowAchievementsModal(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors" title="View Achievements">
                                    <TrophyIcon className="w-6 h-6" />
                                </button>
                                <button onClick={() => setShowChart(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors disabled:text-gray-400/50 dark:disabled:text-gray-600 disabled:cursor-not-allowed" title={mode === 'elite' ? 'View Progress' : 'Elite Tier feature'} disabled={mode !== 'elite'}>
                                    <ChartIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-900 rounded-lg p-2">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                placeholder={isLiveActive ? "Listening..." : "Tell the panda what's wrong."}
                                className="flex-1 bg-transparent text-inherit placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none resize-none p-2"
                                rows={1}
                                disabled={isLoading || isLiveActive}
                            />
                            {mode !== 'standard' && (
                                <button
                                    onClick={toggleLiveSession}
                                    disabled={isLoading}
                                    className={`p-3 rounded-full text-white transition-colors ${ isLiveActive ? 'bg-red-600 animate-pulse' : 'bg-yellow-600 hover:bg-yellow-500' } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                                >
                                    <MicrophoneIcon className="w-6 h-6" />
                                </button>
                            )}
                            <button onClick={handleSendMessage} disabled={isLoading || !input.trim() || isLiveActive} className="p-3 rounded-full bg-yellow-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-yellow-500 transition-colors">
                                <SendIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
            
            {showChart && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
                        <button onClick={() => setShowChart(false)} className="absolute -top-2 -right-2 p-1 bg-gray-700 rounded-full text-white hover:bg-red-500 z-10">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                        <ProgressChart data={progressData} theme={theme} />
                    </div>
                </div>
            )}
            {showAchievementsModal && (
                <AchievementsModal achievements={Object.values(achievements)} onClose={() => setShowAchievementsModal(false)} />
            )}
            {showPinModal.visible && (
                <PinModal 
                    mode={showPinModal.mode} 
                    onConfirm={handlePinConfirm}
                    onClose={() => setShowPinModal({visible: false, mode: 'set'})}
                    error={showPinModal.error}
                />
            )}
            {showDailyTruthModal && (
                <DailyTruthModal
                    truth={dailyTruth}
                    isLoading={isDailyTruthLoading}
                    onClose={() => setShowDailyTruthModal(false)}
                />
            )}
        </div>
    );
};

export default App;