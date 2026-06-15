/**
 * Trivia question database for the 7 cultural monuments (ladders).
 *
 * Each monument has 2-3 questions so a player who lands on the
 * same ladder multiple times gets a fresh question.
 *
 * The questions are short, kid-friendly, and answerable in 1-2
 * sentences of Indonesian + English context. Some questions are
 * factual (when was it built), some are observational (what does
 * it look like), some are cultural (what is it for).
 *
 * Correct-answer feedback: "Benar! 🎉" and a small bonus visual.
 * Wrong-answer feedback: "Hampir! Jawabannya: X." and a soft "OK".
 */
import type { Ladder as LadderData } from '../data/board';

export interface TriviaQuestion {
  /** The question text, in mixed Indonesian/English. */
  readonly q: string;
  /** Three answer choices, in display order. */
  readonly choices: [string, string, string];
  /** Zero-based index of the correct choice. */
  readonly correctIndex: 0 | 1 | 2;
  /** Short fun-fact shown after answering. */
  readonly fact: string;
}

export const TRIVIA: Record<string, TriviaQuestion[]> = {
  'Candi Borobudur': [
    {
      q: 'Candi Borobudur is the largest Buddhist temple in the world. Approximately when was it built?',
      choices: ['5th century', '8th-9th century', '12th century'],
      correctIndex: 1,
      fact: 'Borobudur was built during the Sailendra dynasty, around 800 CE.'
    },
    {
      q: 'How many relief panels does Candi Borobudur have?',
      choices: ['About 200', 'About 2,600', 'Over 10,000'],
      correctIndex: 1,
      fact: 'Borobudur has 2,672 relief panels covering 6 km of wall!'
    },
    {
      q: 'What shape is the Borobudur monument when seen from above?',
      choices: ['A square', 'A mandala (cosmic diagram)', 'A lotus flower'],
      correctIndex: 1,
      fact: 'Borobudur is built as a giant 3D mandala, a Buddhist cosmic diagram.'
    }
  ],
  'Candi Prambanan': [
    {
      q: 'Candi Prambanan is a Hindu temple complex. Who is the main temple dedicated to?',
      choices: ['Vishnu', 'Shiva (the Destroyer)', 'Brahma'],
      correctIndex: 1,
      fact: 'The main temple (Candi Shiva) is dedicated to Shiva Mahadeva.'
    },
    {
      q: 'Candi Prambanan is on the island of Java. Which province?',
      choices: ['West Java', 'Central Java (Yogyakarta area)', 'East Java'],
      correctIndex: 1,
      fact: 'Prambanan is near Yogyakarta, in Central Java.'
    }
  ],
  'Istana Maimun': [
    {
      q: 'Istana Maimun is a palace in North Sumatra. What style of architecture is it?',
      choices: ['Javanese Hindu', 'Malay-Islamic (with European touches)', 'Pure Balinese'],
      correctIndex: 1,
      fact: 'Maimun blends Malay, Islamic, Spanish, Italian, and Indian Mughal styles.'
    },
    {
      q: 'In which city is the Istana Maimun palace?',
      choices: ['Padang', 'Medan', 'Pekanbaru'],
      correctIndex: 1,
      fact: 'Istana Maimun is in Medan, the capital of North Sumatra.'
    }
  ],
  'Benteng Rotterdam': [
    {
      q: 'Benteng Rotterdam is a Dutch colonial fort. Where is it?',
      choices: ['Surabaya', 'Makassar (South Sulawesi)', 'Jakarta'],
      correctIndex: 1,
      fact: 'The fort is in Makassar, built in 1545 during the spice trade era.'
    },
    {
      q: 'Benteng Rotterdam\'s name comes from what?',
      choices: ['A Dutch city (Rotterdam)', 'A captain\'s name', 'A local word for "red"'],
      correctIndex: 0,
      fact: 'It was named after the Dutch city of Rotterdam, where the original builder was from.'
    }
  ],
  'Monas': [
    {
      q: 'Monas is the national monument of Indonesia. In which city?',
      choices: ['Bandung', 'Surabaya', 'Jakarta'],
      correctIndex: 2,
      fact: 'Monas stands in central Jakarta, in Merdeka Square.'
    },
    {
      q: 'What does "Monas" stand for?',
      choices: ['Monumen Nasional', 'Monumen Nusantara', 'Monas Indonesia'],
      correctIndex: 0,
      fact: 'Monas is short for Monumen Nasional (National Monument).'
    },
    {
      q: 'What is the gold flame on top of Monas symbolizing?',
      choices: ['The sun', 'The spirit of the Indonesian struggle for independence', 'A traditional oil lamp'],
      correctIndex: 1,
      fact: 'The flame symbolizes the unyielding spirit of the Indonesian people.'
    }
  ],
  'Candi Sewu': [
    {
      q: 'Candi Sewu means "thousand temples". How many temples are actually in the complex?',
      choices: ['About 50', 'About 250', 'Exactly 1000'],
      correctIndex: 1,
      fact: 'There are 249 temples in the Sewu complex, not literally 1000.'
    },
    {
      q: 'Candi Sewu is located near which famous temple?',
      choices: ['Borobudur', 'Prambanan', 'Angkor Wat'],
      correctIndex: 1,
      fact: 'Candi Sewu is part of the Prambanan complex area.'
    }
  ],
  'Taman Nasional Komodo': [
    {
      q: 'Taman Nasional Komodo is famous for which animal?',
      choices: ['Komodo dragon', 'Bengal tiger', 'Orangutan'],
      correctIndex: 0,
      fact: 'The Komodo dragon is the world\'s largest living lizard, up to 3m long.'
    },
    {
      q: 'Where are Komodo dragons found in the wild?',
      choices: ['Java only', 'Several islands in East Nusa Tenggara', 'Borneo'],
      correctIndex: 1,
      fact: 'Komodo dragons live on Komodo, Rinca, and a few smaller islands in East Nusa Tenggara.'
    }
  ]
};

/** Get a random trivia question for a monument, or null if none. */
export function getTrivia(monumentName: string): TriviaQuestion | null {
  const questions = TRIVIA[monumentName];
  if (!questions || questions.length === 0) return null;
  // Pick a random one — but for determinism in tests, accept an env override
  const idx = Math.floor(Math.random() * questions.length);
  return questions[idx]!;
}

/** Get the trivia question for a specific LadderData entry, or null. */
export function getTriviaForLadder(ladder: LadderData): TriviaQuestion | null {
  return getTrivia(ladder.name);
}
