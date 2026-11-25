import { describe, expect, it } from 'vitest';
import { count, fmt, localDate, norm, safeUrl, shortSite } from '../../src/lib/format';

describe('format helpers', () => {
  it('norm trims, collapses whitespace and lowercases', () => {
    expect(norm('  Metalaxyl-M \n  Seed ')).toBe('metalaxyl-m seed');
    expect(norm(null)).toBe('');
  });

  it('fmt uses only the calendar date, so UTC timestamps never shift a day', () => {
    expect(fmt('2026-09-21')).toBe('Sep 21, 2026');
    expect(fmt('2026-11-25T23:59:00-08:00')).toBe('Nov 25, 2026');
    expect(fmt(null)).toBe('Not supplied');
    expect(fmt('')).toBe('Not supplied');
  });

  it('localDate is the America/Chicago calendar date', () => {
    expect(localDate(new Date('2026-11-26T03:00:00Z'))).toBe('2026-11-25');
    expect(localDate(new Date('2026-11-26T07:00:00Z'))).toBe('2026-11-26');
  });

  it('count pluralises, including irregular plurals', () => {
    expect(count(1, 'product')).toBe('1 product');
    expect(count(0, 'product')).toBe('0 products');
    expect(count(2, 'match', 'matches')).toBe('2 matches');
    expect(count(1880, 'record')).toBe('1,880 records');
  });

  it('shortSite drops the seed-treatment suffix', () => {
    expect(shortSite('Corn (field) (seed treatment)')).toBe('Corn (field)');
  });

  it('safeUrl only allows https', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('http://example.com/')).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
    expect(safeUrl('https://www3.epa.gov/x.pdf')).toBe('https://www3.epa.gov/x.pdf');
  });
});
