export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回可识别的 JSON');
  const value: unknown = JSON.parse(trimmed.slice(start, end + 1));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型返回格式不是 JSON 对象');
  return value as Record<string, unknown>;
}
