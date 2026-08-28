import type { ApiConfig } from '../domain/types';
import { readApiKey } from '../repositories/apiConfigs';

export type ModelErrorCode = 'network' | 'timeout' | 'cancelled' | 'authentication' | 'model_not_found' | 'quota' | 'rate_limit' | 'server' | 'format';

export class ModelRequestError extends Error {
  constructor(public code: ModelErrorCode, message: string) { super(message); }
}

export async function requestModelText(config: ApiConfig, prompt: string, options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<string> {
  const key = await readApiKey(config);
  if (!key) throw new ModelRequestError('authentication', '该配置缺少 API Key，请重新填写');
  return requestModelTextUsingKey(config, prompt, key, options);
}

export async function requestModelTextUsingKey(config: ApiConfig, prompt: string, key: string, options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<string> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort('timeout'), options.timeoutMs ?? 90_000);
  const abort = () => timeoutController.abort('cancelled');
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const endpoint = buildEndpoint(config.baseUrl, config.interfaceType);
    const body = config.interfaceType === 'responses'
      ? { model: config.model, input: prompt, store: false }
      : { model: config.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2 };
    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: timeoutController.signal });
    } catch (error) {
      if (timeoutController.signal.aborted) {
        const cancelled = options.signal?.aborted;
        throw new ModelRequestError(cancelled ? 'cancelled' : 'timeout', cancelled ? '已取消本次请求' : '请求超时，请稍后手动重试');
      }
      throw new ModelRequestError('network', '无法连接模型服务，请检查网络和 API 地址');
    }
    if (!response.ok) throw mapHttpError(response.status);
    const json = await response.json() as Record<string, unknown>;
    const text = extractText(json, config.interfaceType);
    if (!text) throw new ModelRequestError('format', '模型返回内容格式不兼容');
    return text;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

function buildEndpoint(baseUrl: string, type: ApiConfig['interfaceType']): string {
  const cleaned = baseUrl.replace(/\/$/, '');
  const suffix = type === 'responses' ? '/responses' : '/chat/completions';
  return cleaned.endsWith(suffix) ? cleaned : `${cleaned}${suffix}`;
}

function extractText(json: Record<string, unknown>, type: ApiConfig['interfaceType']): string | null {
  if (type === 'chat_completions') {
    const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content ?? null;
  }
  if (typeof json.output_text === 'string') return json.output_text;
  const output = json.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
  return output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('') || null;
}

function mapHttpError(status: number): ModelRequestError {
  if (status === 401 || status === 403) return new ModelRequestError('authentication', 'API Key 无效或没有访问权限');
  if (status === 404) return new ModelRequestError('model_not_found', 'API 地址或模型名称不存在');
  if (status === 429) return new ModelRequestError('rate_limit', '请求过于频繁或额度不足，请检查服务商账号');
  if (status === 402) return new ModelRequestError('quota', '模型服务额度不足');
  if (status >= 500) return new ModelRequestError('server', '模型服务暂时不可用');
  return new ModelRequestError('format', `模型服务拒绝了请求（${status}）`);
}

export async function testModelConnection(config: ApiConfig): Promise<void> {
  await requestModelText(config, '请只回复“连接成功”。', { timeoutMs: 15_000 });
}

export async function testModelConnectionUsingKey(config: ApiConfig, key: string): Promise<void> {
  await requestModelTextUsingKey(config, '请只回复“连接成功”。', key, { timeoutMs: 15_000 });
}
