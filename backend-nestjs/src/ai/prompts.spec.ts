import {
  buildQCPrompt,
  buildClassificationPrompt,
  formatChatTranscript,
  wrapBatchPrompt,
  formatBatchTranscript,
} from './prompts';
import { ChatMessage, BatchItem } from './providers/ai-provider.interface';

describe('buildQCPrompt', () => {
  it('should contain the rules content', () => {
    const rules = '## Ph\u1EA3i ch\u00E0o h\u1ECFi l\u1ECBch s\u1EF1';
    const prompt = buildQCPrompt(rules);

    expect(prompt).toContain(rules);
  });

  it('should mention violations in output format', () => {
    const prompt = buildQCPrompt('rules');

    expect(prompt).toContain('violations');
  });

  it('should request JSON output', () => {
    const prompt = buildQCPrompt('rules');

    expect(prompt).toContain('JSON');
  });

  it('should include skip conditions when provided', () => {
    const rules = 'some rules';
    const skipConditions = 'skip when too short';
    const prompt = buildQCPrompt(rules, skipConditions);

    expect(prompt).toContain(skipConditions);
    expect(prompt).toContain('SKIP');
    expect(prompt).toContain('\u0110i\u1EC1u ki\u1EC7n b\u1ECF qua');
  });

  it('should not include skip section when skipConditions is empty', () => {
    const prompt = buildQCPrompt('rules');

    expect(prompt).not.toContain('\u0110i\u1EC1u ki\u1EC7n b\u1ECF qua');
  });
});

describe('buildClassificationPrompt', () => {
  it('should contain rules config', () => {
    const rules = '[{"name":"complaint","description":"Customer complaint"}]';
    const prompt = buildClassificationPrompt(rules);

    expect(prompt).toContain(rules);
  });

  it('should mention tags in output format', () => {
    const prompt = buildClassificationPrompt('[]');

    expect(prompt).toContain('tags');
  });
});

describe('formatChatTranscript', () => {
  it('should format messages with sender name and timestamp', () => {
    const messages: ChatMessage[] = [
      {
        senderType: 'customer',
        senderName: 'Nguyen Van A',
        content: 'Xin ch\u00E0o',
        sentAt: '09:00',
      },
      {
        senderType: 'agent',
        senderName: 'CSKH',
        content: 'D\u1EA1, em ch\u00E0o anh',
        sentAt: '09:01',
      },
    ];

    const transcript = formatChatTranscript(messages);

    expect(transcript).toContain('Nguyen Van A');
    expect(transcript).toContain('Xin ch\u00E0o');
    expect(transcript).toContain('09:00');
    expect(transcript).toContain('09:01');
  });

  it('should fallback to senderType when senderName is empty', () => {
    const messages: ChatMessage[] = [
      {
        senderType: 'customer',
        senderName: '',
        content: 'Hello',
        sentAt: '10:00',
      },
    ];

    const transcript = formatChatTranscript(messages);

    expect(transcript).toContain('customer');
  });

  it('should format each message on its own line', () => {
    const messages: ChatMessage[] = [
      {
        senderType: 'customer',
        senderName: 'A',
        content: 'Hi',
        sentAt: '10:00',
      },
      {
        senderType: 'agent',
        senderName: 'B',
        content: 'Hello',
        sentAt: '10:01',
      },
    ];

    const transcript = formatChatTranscript(messages);
    const lines = transcript.split('\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('[10:00] A: Hi');
    expect(lines[1]).toBe('[10:01] B: Hello');
  });
});

describe('wrapBatchPrompt', () => {
  it('should include the base prompt and count', () => {
    const base = 'base prompt';
    const wrapped = wrapBatchPrompt(base, 3);

    expect(wrapped).toContain(base);
    expect(wrapped).toContain('3');
    expect(wrapped).toContain('JSON ARRAY');
  });
});

describe('formatBatchTranscript', () => {
  it('should format items with conversation IDs', () => {
    const items: BatchItem[] = [
      { conversationId: 'abc-123', transcript: 'Hello world' },
      { conversationId: 'def-456', transcript: 'Goodbye' },
    ];

    const result = formatBatchTranscript(items);

    expect(result).toContain('abc-123');
    expect(result).toContain('def-456');
    expect(result).toContain('Hello world');
    expect(result).toContain('Goodbye');
    expect(result).toContain('=== CU\u1ED8C H\u1ED8I THO\u1EA0I 1');
    expect(result).toContain('=== CU\u1ED8C H\u1ED8I THO\u1EA0I 2');
  });
});
