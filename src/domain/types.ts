export type GoalType = 'deadline' | 'habit';
export type HabitMode = 'consecutive' | 'period_count';
export type HabitPeriodUnit = 'week' | 'month';
export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'terminated';
export type PlanStatus = 'draft' | 'confirmed' | 'replaced';
export type TaskStatus = 'pending' | 'completed' | 'skipped';
export type ApiInterfaceType = 'chat_completions' | 'responses';

export type ApiConfig = {
  id: string;
  name: string;
  provider: string;
  interfaceType: ApiInterfaceType;
  baseUrl: string;
  model: string;
  secretRef: string;
  isDefault: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
};

export type DraftQuestion = {
  id: string;
  prompt: string;
  required: boolean;
  answer?: string;
};

export type QuestionRound = {
  round: number;
  introduction: string;
  goalTypeSuggestion: GoalType;
  complete: boolean;
  questions: DraftQuestion[];
  assumptions: string[];
};

export type PlanDraftTask = {
  id: string;
  stageId: string | null;
  title: string;
  description: string;
  completionCriteria: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  estimatedMinutes: number | null;
  reminderTime: string | null;
  order: number;
  dependencyIds: string[];
};

export type PlanDraftStage = {
  id: string;
  title: string;
  description: string;
  order: number;
  startDate: string | null;
  endDate: string | null;
};

export type PlanDraft = {
  title: string;
  overview: string;
  stages: PlanDraftStage[];
  tasks: PlanDraftTask[];
  source: 'ai' | 'manual';
};

export type Goal = {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  status: GoalStatus;
  startDate: string | null;
  targetDate: string | null;
  habitCycle: string | null;
  habitMode: HabitMode | null;
  habitTargetCount: number;
  habitPeriodUnit: HabitPeriodUnit | null;
  habitCurrentCount: number;
  habitBestCount: number;
  habitPeriodKey: string | null;
  habitStageStartedAt: string | null;
  habitStageAchievedAt: string | null;
  habitCelebrationSeenAt: string | null;
  completionCelebrationSeenAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  goalId: string;
  planId: string | null;
  stageId: string | null;
  title: string;
  description: string;
  completionCriteria: string;
  status: TaskStatus;
  startAt: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  reminderEnabled: boolean;
  estimatedMinutes: number | null;
  completedAt: string | null;
  skippedAt: string | null;
  deletedAt: string | null;
  replacedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskWithGoal = Task & {
  goalTitle: string;
  goalStatus: GoalStatus;
  stageTitle: string | null;
};

export type GoalStage = { id: string; title: string; description: string; order: number; startDate: string | null; endDate: string | null };
export type OperationLog = { id: string; entityType: string; entityId: string; action: string; metadata: Record<string, unknown> | null; createdAt: string };
