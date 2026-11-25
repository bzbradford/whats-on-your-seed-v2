import { afterEach, describe, expect, it, vi } from 'vitest';
import { Announcer } from '../../src/lib/announcer';

afterEach(() => vi.useRealTimers());

describe('Announcer', () => {
  it('debounces polite messages and sends urgent ones at once', () => {
    vi.useFakeTimers();
    const regions = { status: '', alert: '' };
    const a = new Announcer(regions);
    a.announce('first');
    a.announce('second');
    expect(regions.status).toBe('');
    vi.advanceTimersByTime(250);
    expect(regions.status).toBe('second');
    a.announce('pending');
    a.announce('Dates are invalid', true);
    expect(regions).toEqual({ status: '', alert: 'Dates are invalid' });
    vi.advanceTimersByTime(500);
    expect(regions.status).toBe('');
    a.clearAlert();
    expect(regions.alert).toBe('');
  });
});
