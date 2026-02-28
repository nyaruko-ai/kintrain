export type ConditionRating = 1 | 2 | 3 | 4 | 5;

export interface SetDetail {
  setIndex: number;
  weightKg: number;
  reps: number;
}

export interface TrainingMenuItem {
  id: string;
  machineName: string;
  defaultWeightKg: number;
  defaultReps: number;
  defaultSets: number;
  order: number;
  isActive: boolean;
}

export interface ExerciseEntry {
  id: string;
  menuItemId: string;
  machineName: string;
  weightKg: number;
  reps: number;
  sets: number;
  setDetails?: SetDetail[];
}

export interface GymVisit {
  id: string;
  date: string;
  startedAtLocal: string;
  endedAtLocal: string;
  timeZoneId: string;
  entries: ExerciseEntry[];
}

export interface DraftEntry {
  menuItemId: string;
  weightKg?: number;
  reps?: number;
  sets?: number;
  setDetails?: SetDetail[];
}

export interface TrainingSessionDraft {
  startedAtLocal: string;
  updatedAtLocal: string;
  entriesByItemId: Record<string, DraftEntry>;
}

export interface DailyRecord {
  date: string;
  timeZoneId: string;
  bodyWeightKg?: number;
  bodyFatPercent?: number;
  bodyMetricRecordedAtLocal?: string;
  conditionRating?: ConditionRating;
  conditionComment?: string;
  diary?: string;
  otherActivities: string[];
}

export interface Goal {
  targetWeightKg: number;
  targetBodyFatPercent: number;
}

export type TonePreset = 'polite' | 'friendly-coach' | 'strict-coach';

export interface AiCharacterProfile {
  characterId: string;
  characterName: string;
  avatarImageUrl: string;
  tonePreset: TonePreset;
  expressions: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAtLocal: string;
  expressionKey?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAtLocal: string;
}

export interface AppData {
  timeZoneId: string;
  menuItems: TrainingMenuItem[];
  gymVisits: GymVisit[];
  dailyRecords: Record<string, DailyRecord>;
  trainingDraft: TrainingSessionDraft | null;
  goal: Goal;
  aiAgentRoleName: string;
  aiCharacterProfile: AiCharacterProfile;
  aiChatSessions: ChatSession[];
  activeAiChatSessionId: string;
}
