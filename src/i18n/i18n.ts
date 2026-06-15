/**
 * Tiny i18n module. Two languages: English (en) and Indonesian (id).
 *
 * Why so small? The UI has fewer than 30 user-facing strings, and
 * the project has zero dependencies. A 3rd-party i18n library would
 * be 10x the size of this file and the strings.
 *
 * Usage:
 *   import { t, setLang, getLang } from './i18n';
 *   setLang('id');
 *   const title = t('menu.title'); // "Ular Tangga Nusantara" (same in both)
 *   const help  = t('menu.help');   // "Gulirkan dadu..." in Indonesian
 *
 * Strings live in `STRINGS[lang][key]`. Missing keys fall through to
 * the English version (so a half-translated language is still usable).
 *
 * Language preference is persisted in localStorage so a returning
 * user gets the same language.
 */
export type Lang = 'en' | 'id';

const STORAGE_KEY = 'ular-tangga-3d:lang:v1';

type StringDict = Record<string, string>;

const STRINGS: Record<Lang, StringDict> = {
  en: {
    // Menu
    'menu.title':           'Ular Tangga Nusantara',
    'menu.subtitle':        'Snakes & Ladders of the Archipelago',
    'menu.difficulty':      'Bot difficulty',
    'menu.diff.easy':       'Easy',
    'menu.diff.medium':     'Medium',
    'menu.diff.hard':       'Hard',
    'menu.costume':         'Choose your costume',
    'menu.resume':          'Resume match',
    'menu.new':             'New match',
    'menu.language':        'Language',
    'menu.help':            'Roll the dice. Land on a <b>ladder</b> to climb. Land on a <b>snake</b> to slide. You can <b>lock a die</b> and re-roll the other. Reach square 100 exactly to win.',

    // Dice
    'dice.roll':            'Roll',
    'dice.reroll':          'Re-roll',
    'dice.commit':          'Done',
    'dice.lock':            'Lock {n}',
    'dice.unlock':          'Unlock {n}',
    'dice.die1':            'Die 1',
    'dice.die2':            'Die 2',
    'dice.rollButton':      'Roll dice',

    // Audio
    'audio.on':             'Sound on',
    'audio.off':            'Sound off',
    'audio.toggle':         'Toggle sound',

    // Toasts
    'toast.snake':          '{name}! -{amount}',
    'toast.ladder':         '{name}! +{amount}',
    'toast.walkback':       'TOO FAR! -{amount}',

    // Win modal
    'win.title':            'You win!',
    'win.message':          '{name} wins!',
    'win.restart':          'Play Again',

    // Trivia
    'trivia.correctPrefix': 'Correct! 🎉 ',
    'trivia.wrongPrefix':   'Almost! ',

    // Misc
    'app.lang.en':          'English',
    'app.lang.id':          'Bahasa Indonesia',
    'app.turnIndicator':    "{name}'s turn",
    'app.score':            'Score'
  },
  id: {
    // Menu
    'menu.title':           'Ular Tangga Nusantara',
    'menu.subtitle':        'Ular Tangga Nusantara',
    'menu.difficulty':      'Tingkat kesulitan bot',
    'menu.diff.easy':       'Mudah',
    'menu.diff.medium':     'Sedang',
    'menu.diff.hard':       'Sulit',
    'menu.costume':         'Pilih kostummu',
    'menu.resume':          'Lanjutkan permainan',
    'menu.new':             'Mulai baru',
    'menu.language':        'Bahasa',
    'menu.help':            'Lempar dadu. Mendarat di <b>tangga</b> untuk naik. Mendarat di <b>ular</b> untuk turun. Kamu bisa <b>kunci dadu</b> dan lempar ulang yang lain. Capai kotak 100 persis untuk menang.',

    // Dice
    'dice.roll':            'Lempar',
    'dice.reroll':          'Lempar ulang',
    'dice.commit':          'Selesai',
    'dice.lock':            'Kunci {n}',
    'dice.unlock':          'Buka {n}',
    'dice.die1':            'Dadu 1',
    'dice.die2':            'Dadu 2',
    'dice.rollButton':      'Lempar dadu',

    // Audio
    'audio.on':             'Suara nyala',
    'audio.off':            'Suara mati',
    'audio.toggle':         'Ganti suara',

    // Toasts
    'toast.snake':          '{name}! -{amount}',
    'toast.ladder':         '{name}! +{amount}',
    'toast.walkback':       'TERLALU JAUH! -{amount}',

    // Win modal
    'win.title':            'Menang!',
    'win.message':          '{name} menang!',
    'win.restart':          'Main lagi',

    // Trivia
    'trivia.correctPrefix': 'Benar! 🎉 ',
    'trivia.wrongPrefix':   'Hampir! ',

    // Misc
    'app.lang.en':          'English',
    'app.lang.id':          'Bahasa Indonesia',
    'app.turnIndicator':    'Giliran {name}',
    'app.score':            'Skor'
  }
};

let currentLang: Lang = 'en';
const listeners: Set<() => void> = new Set();

/** Get the current language. */
export function getLang(): Lang { return currentLang; }

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switch the language. Persists to localStorage and notifies subscribers. */
export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* ignore storage errors */ }
  for (const fn of listeners) fn();
}

/** Load language from localStorage, fallback to browser preference. */
export function initLang(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'id') {
      currentLang = saved;
      return;
    }
  } catch { /* ignore */ }
  // Fallback to browser language
  const navLang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  currentLang = navLang.startsWith('id') ? 'id' : 'en';
}

/**
 * Translate a key. Supports {placeholder} substitution.
 *
 *   t('dice.lock', { n: 1 })  // "Lock 1" (en) / "Kunci 1" (id)
 *
 * Missing keys return the key itself, prefixed with `??`, so untranslated
 * strings are obvious in the UI.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = STRINGS[currentLang];
  let s = dict[key] ?? STRINGS.en[key];
  if (s === undefined) return `??${key}`;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}
