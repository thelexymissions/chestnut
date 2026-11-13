import type { Mood } from '../lib/scenes';

export interface Topic {
  id: string;
  label: string;
  /** Background moods for this topic's cards, most characteristic first. */
  moods: Mood[];
}

// Order is the order shown on the welcome screen.
export const TOPICS: Topic[] = [
  { id: 'anxiety', label: 'Anxiety & Worry', moods: ['deep', 'sky'] },
  { id: 'fear', label: 'Fear', moods: ['deep', 'dusk'] },
  { id: 'finances', label: 'Finances', moods: ['earth', 'forest'] },
  { id: 'health', label: 'Health & Healing', moods: ['forest', 'sky'] },
  { id: 'relationships', label: 'Relationships', moods: ['ember', 'dawn'] },
  { id: 'family', label: 'Marriage & Family', moods: ['ember', 'earth'] },
  { id: 'forgiveness', label: 'Forgiveness', moods: ['dawn', 'sky'] },
  { id: 'grace', label: 'Grace', moods: ['dawn', 'light'] },
  { id: 'love', label: 'Love', moods: ['ember', 'dusk'] },
  { id: 'career', label: 'Career & Work', moods: ['earth', 'sky'] },
  { id: 'peace', label: 'Peace', moods: ['sky', 'forest'] },
  { id: 'hope', label: 'Hope', moods: ['dawn', 'sky'] },
  { id: 'faith', label: 'Faith', moods: ['sky', 'earth'] },
  { id: 'strength', label: 'Strength', moods: ['earth', 'deep'] },
  { id: 'wisdom', label: 'Wisdom & Guidance', moods: ['forest', 'earth'] },
  { id: 'purpose', label: 'Purpose', moods: ['earth', 'dawn'] },
  { id: 'gratitude', label: 'Gratitude', moods: ['dawn', 'forest'] },
  { id: 'joy', label: 'Joy', moods: ['light', 'dawn'] },
  { id: 'patience', label: 'Patience', moods: ['forest', 'dusk'] },
  { id: 'grief', label: 'Grief & Comfort', moods: ['dusk', 'deep'] },
  { id: 'loneliness', label: 'Loneliness', moods: ['deep', 'dusk'] },
  { id: 'temptation', label: 'Temptation', moods: ['dusk', 'earth'] },
  { id: 'prayer', label: 'Prayer', moods: ['dusk', 'sky'] },
  { id: 'salvation', label: 'Salvation', moods: ['light', 'dawn'] },
];

export const topicById = (id: string): Topic | undefined => TOPICS.find((t) => t.id === id);
export const topicLabel = (id: string): string => topicById(id)?.label ?? id;
