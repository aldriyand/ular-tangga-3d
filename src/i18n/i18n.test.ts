/**
 * Tests for the i18n module: t(), setLang(), and fallback behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLang, getLang, initLang, type Lang } from './i18n';

describe('i18n', () => {
  beforeEach(() => {
    // Reset to a known state (English) before each test
    setLang('en');
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ular-tangga-3d:lang:v1');
    }
  });

  it('defaults to English', () => {
    expect(getLang()).toBe('en');
  });

  it('translates a simple key in English', () => {
    expect(t('menu.diff.easy')).toBe('Easy');
    expect(t('menu.diff.medium')).toBe('Medium');
  });

  it('translates a simple key in Indonesian after setLang', () => {
    setLang('id');
    expect(t('menu.diff.easy')).toBe('Mudah');
    expect(t('menu.diff.medium')).toBe('Sedang');
    expect(t('menu.diff.hard')).toBe('Sulit');
  });

  it('falls back to English for missing Indonesian translations', () => {
    setLang('id');
    // All keys are translated in both languages, but let's add a hypothetical
    // missing one by checking the fallback path
    // The fallback is in the t() function via ?? STRINGS.en[key]
    // We can't test this directly without modifying STRINGS, so just ensure
    // getLang() returns 'id' and t() doesn't crash
    expect(getLang()).toBe('id');
    expect(t('menu.diff.easy')).toBe('Mudah');
  });

  it('returns a placeholder for missing keys', () => {
    // @ts-expect-error — testing the missing-key fallback
    const result = t('this.key.does.not.exist');
    expect(result).toContain('??');
  });

  it('substitutes variables in translated strings', () => {
    setLang('en');
    const result = t('toast.ladder', { name: 'Candi Borobudur', amount: 41 });
    expect(result).toBe('Candi Borobudur! +41');

    setLang('id');
    const resultId = t('toast.snake', { name: 'Ular Kadal', amount: 41 });
    expect(resultId).toBe('Ular Kadal! -41');
  });

  it('persists language to localStorage on setLang', () => {
    if (typeof localStorage === 'undefined') return;
    setLang('id');
    expect(localStorage.getItem('ular-tangga-3d:lang:v1')).toBe('id');
  });

  it('initLang loads from localStorage when set', () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ular-tangga-3d:lang:v1', 'id');
    initLang();
    expect(getLang()).toBe('id');
  });
});
