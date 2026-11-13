import type { AppState } from './store';

// The getting-started path shown on the home screen: one small step at a time,
// each introducing a part of the app. Nothing is locked; the path only points.

export interface StepDef {
  id: 'verse' | 'learn' | 'return' | 'explore' | 'around' | 'save' | 'trivia' | 'share';
  /** two or three words at most */
  label: string;
  /** where tapping the step takes you */
  to?: string;
  /** shown under the path while this is the next step */
  cue: string;
}

export const STEPS: StepDef[] = [
  { id: 'verse', label: 'First verse', cue: 'Receive a verse', to: '/feed' },
  { id: 'learn', label: 'Learn it', cue: 'Learn a verse by heart', to: '/memorise' },
  { id: 'return', label: 'Day two', cue: 'Come back tomorrow' },
  { id: 'explore', label: 'Explore', cue: 'Read five verses', to: '/feed?coach=explore' },
  { id: 'around', label: 'Read around', cue: 'See the verse before or after', to: '/feed?coach=around' },
  { id: 'save', label: 'Keep one', cue: 'Save a verse you love', to: '/feed?coach=save' },
  { id: 'trivia', label: 'Trivia', cue: 'Try a Bible trivia card', to: '/trivia' },
  { id: 'share', label: 'Share', cue: 'Send a verse to someone', to: '/feed?coach=share' },
];

export function journeyState(s: AppState): Record<StepDef['id'], boolean> {
  const memory = Object.values(s.memory);
  return {
    verse: !!s.intro || s.reads > 0 || Object.keys(s.saved).length > 0 || memory.length > 0,
    learn: memory.some((e) => e.reviews > 0),
    return: s.streak.best >= 2,
    explore: s.reads >= 5,
    around: !!s.journey.around,
    save: Object.keys(s.saved).length > 0,
    trivia: !!s.journey.trivia,
    share: !!s.journey.share,
  };
}

// ---------- the welcome questions ----------
export interface Choice { id: string; label: string; topics: string[] }

export const MOODS: Choice[] = [
  { id: 'joyful', label: 'Joyful', topics: ['joy', 'gratitude'] },
  { id: 'calm', label: 'Calm', topics: ['peace', 'gratitude'] },
  { id: 'tired', label: 'Tired', topics: ['strength', 'peace'] },
  { id: 'worried', label: 'Worried', topics: ['anxiety', 'fear'] },
  { id: 'sad', label: 'Sad', topics: ['grief', 'hope'] },
  { id: 'lonely', label: 'Lonely', topics: ['loneliness', 'love'] },
];
export const AREAS: Choice[] = [
  { id: 'family', label: 'Family', topics: ['family'] },
  { id: 'work', label: 'Work', topics: ['career'] },
  { id: 'health', label: 'Health', topics: ['health'] },
  { id: 'money', label: 'Money', topics: ['finances'] },
  { id: 'people', label: 'Relationships', topics: ['relationships', 'forgiveness'] },
  { id: 'future', label: 'The future', topics: ['purpose', 'wisdom'] },
];
export const NEEDS: Choice[] = [
  { id: 'peace', label: 'Peace', topics: ['peace', 'anxiety'] },
  { id: 'strength', label: 'Strength', topics: ['strength', 'faith'] },
  { id: 'hope', label: 'Hope', topics: ['hope'] },
  { id: 'guidance', label: 'Guidance', topics: ['wisdom', 'purpose'] },
  { id: 'comfort', label: 'Comfort', topics: ['grief', 'loneliness'] },
  { id: 'joy', label: 'Joy', topics: ['joy', 'gratitude'] },
];

// ---------- reflection ----------
// Open questions only. They never suggest what the answer should be.
export interface Prompt { text: string; /** refers to the verse just read */ about: 'last' | 'today' }
export const PROMPTS: Prompt[] = [
  { text: 'How would you apply this verse today?', about: 'last' },
  { text: 'Which verse stayed with you most just now?', about: 'today' },
  { text: 'What is this verse saying to you?', about: 'last' },
  { text: 'Who comes to mind as you read this?', about: 'last' },
  { text: 'Which was your favourite verse today?', about: 'today' },
  { text: 'What one word here do you want to carry with you?', about: 'last' },
  { text: 'What are you thankful for right now?', about: 'today' },
  { text: 'What would living this out look like this week?', about: 'last' },
  { text: 'Is there something here you want to pray about?', about: 'today' },
  { text: 'What small step could you take because of this verse?', about: 'last' },
  { text: 'Who could you encourage with one of these verses?', about: 'today' },
  { text: 'What is on your heart as you read today?', about: 'today' },
];
