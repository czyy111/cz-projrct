import { describe, expect, it } from 'vitest';

import { parseJsonObject } from './json';

describe('model JSON parsing', () => {
  it('extracts a JSON object from a fenced answer', () => {
    expect(parseJsonObject('```json\n{"complete":true}\n```')).toEqual({ complete: true });
  });

  it('extracts JSON surrounded by a short explanation', () => {
    expect(parseJsonObject('结果如下： {"title":"计划"} 请审核')).toEqual({ title: '计划' });
  });

  it('rejects an answer without a JSON object', () => {
    expect(() => parseJsonObject('这是普通文本')).toThrow('可识别的 JSON');
  });
});
