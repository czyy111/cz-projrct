import type { Goal, GoalType, PlanDraft, QuestionRound } from '../domain/types';
import type { ApiConfig } from '../domain/types';
import { createId } from '../utils/id';
import { requestModelText } from './client';
import { parseJsonObject } from './json';

export async function generateQuestions(config: ApiConfig, goal: Goal, previous: QuestionRound[] = [], signal?: AbortSignal): Promise<QuestionRound> {
  const prompt = `你是中文个人计划助手。目标：${goal.description}\n已有问答：${JSON.stringify(previous)}\n这是第${previous.length + 1}轮，最多3轮。只返回JSON：{"introduction":"简短说明","goalTypeSuggestion":"deadline或habit","complete":false,"questions":[{"id":"q1","prompt":"问题","required":true}],"assumptions":["假设"]}。每轮最多4个必要问题；信息足够时complete为true且questions为空。`;
  const raw = parseJsonObject(await requestModelText(config, prompt, { signal }));
  const questions = Array.isArray(raw.questions) ? raw.questions.slice(0, 4).map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: typeof row.id === 'string' ? row.id : `q${index + 1}`, prompt: String(row.prompt ?? ''), required: row.required !== false };
  }).filter((item) => item.prompt) : [];
  return {
    round: previous.length + 1,
    introduction: typeof raw.introduction === 'string' ? raw.introduction : '为了制定更合适的计划，请补充以下信息。',
    goalTypeSuggestion: raw.goalTypeSuggestion === 'habit' ? 'habit' : 'deadline',
    complete: raw.complete === true || questions.length === 0,
    questions,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.filter((item): item is string => typeof item === 'string') : [],
  };
}

export async function generatePlan(config: ApiConfig, goal: Goal, rounds: QuestionRound[], goalType: GoalType, signal?: AbortSignal): Promise<PlanDraft> {
  const prompt = `你是中文个人计划助手。根据目标和已确认回答生成可执行计划。\n目标：${goal.description}\n类型：${goalType}\n问答：${JSON.stringify(rounds)}\n只返回JSON：{"title":"计划名","overview":"概述","stages":[{"id":"s1","title":"阶段名","description":"说明","order":1,"startDate":"YYYY-MM-DD或null","endDate":"YYYY-MM-DD或null"}],"tasks":[{"id":"t1","stageId":"s1或null","title":"任务","description":"说明","completionCriteria":"完成标准","date":"YYYY-MM-DD","startTime":"HH:mm或null","endTime":"HH:mm或null","estimatedMinutes":30,"reminderTime":"HH:mm或null","order":1,"dependencyIds":[]}]}。任务必须有日期或明确order，日期不得超出目标范围。`;
  return normalizePlan(parseJsonObject(await requestModelText(config, prompt, { signal })), 'ai');
}

export async function adjustPlan(config: ApiConfig, goal: Goal, current: PlanDraft, instruction: string, taskId?: string, signal?: AbortSignal): Promise<PlanDraft> {
  const scope = taskId ? `只重点调整任务ID ${taskId}，必要时可同步修正受影响时间和依赖` : '调整整份计划';
  const prompt = `你是中文个人计划助手。${scope}。用户要求：${instruction}\n目标：${goal.description}\n当前计划：${JSON.stringify(current)}\n只返回与当前计划相同结构的完整JSON，必须包含title、overview、stages、tasks。保留未受影响内容和原有ID；任务必须有日期或明确order。`;
  return normalizePlan(parseJsonObject(await requestModelText(config, prompt, { signal })), 'ai');
}

export function normalizePlan(raw: Record<string, unknown>, source: PlanDraft['source']): PlanDraft {
  const stages = Array.isArray(raw.stages) ? raw.stages.map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: typeof row.id === 'string' ? row.id : createId('stage'), title: String(row.title ?? `阶段 ${index + 1}`), description: String(row.description ?? ''), order: numberOr(row.order, index + 1), startDate: optionalString(row.startDate), endDate: optionalString(row.endDate) };
  }) : [];
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: typeof row.id === 'string' ? row.id : createId('task'), stageId: optionalString(row.stageId), title: String(row.title ?? ''), description: String(row.description ?? ''), completionCriteria: String(row.completionCriteria ?? ''), date: optionalString(row.date), startTime: optionalString(row.startTime), endTime: optionalString(row.endTime), estimatedMinutes: typeof row.estimatedMinutes === 'number' ? row.estimatedMinutes : null, reminderTime: optionalString(row.reminderTime), order: numberOr(row.order, index + 1), dependencyIds: Array.isArray(row.dependencyIds) ? row.dependencyIds.filter((id): id is string => typeof id === 'string') : [] };
  }) : [];
  return { title: String(raw.title ?? '我的计划'), overview: String(raw.overview ?? ''), stages, tasks, source };
}

const optionalString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
