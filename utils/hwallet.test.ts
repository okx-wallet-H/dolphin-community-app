import { describe, expect, it } from 'vitest';

import { buildChatMessages, formatChatTime, getLoginEmail } from './hwallet';

describe('getLoginEmail', () => {
  it('returns trimmed email input when provided', () => {
    expect(getLoginEmail('  hello@hwallet.ai  ')).toBe('hello@hwallet.ai');
  });

  it('falls back to the demo email when input is empty', () => {
    expect(getLoginEmail('   ')).toBe('demo@hwallet.ai');
  });
});

describe('formatChatTime', () => {
  it('formats timestamp into zero-padded hour and minute', () => {
    const timestamp = new Date(2026, 3, 4, 9, 7).getTime();
    expect(formatChatTime(timestamp)).toBe('09:07');
  });
});

describe('buildChatMessages', () => {
  it('returns empty array for blank input', () => {
    expect(buildChatMessages('   ', Date.now())).toEqual([]);
  });

  it('builds paired user and ai messages with timestamps', () => {
    const timestamp = new Date(2026, 3, 4, 16, 28).getTime();
    const messages = buildChatMessages('Help me rebalance', timestamp);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'Help me rebalance',
      time: '16:28',
    });
    expect(messages[1]).toMatchObject({
      role: 'ai',
      time: '16:28',
    });
  });
});
