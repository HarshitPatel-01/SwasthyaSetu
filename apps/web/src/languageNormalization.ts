/**
 * languageNormalization.ts
 *
 * Centralised language / script utilities for the AI Assistant voice input.
 *
 * Responsibilities:
 *  1. Map application language codes (EN, HI, TA, ...) to BCP-47 speech codes.
 *  2. Detect whether a given string is already written in the correct script.
 *  3. Attempt ITRANS -> native-script transliteration when the browser returns
 *     Roman text for an Indian-language recognition session.
 *
 * Key design rules:
 *  - English text is NEVER transliterated into another script.
 *  - If the text is already in the target script it is returned unchanged.
 *  - Transliteration is best-effort; the caller should display the result and
 *    allow the user to edit before analysing.
 *  - No network calls, no external APIs - purely client-side.
 */

import Sanscript from '@indic-transliteration/sanscript';

// ---------------------------------------------------------------------------
// Language configuration
// ---------------------------------------------------------------------------

export interface LangConfig {
  /** BCP-47 code for SpeechRecognition.lang */
  speechCode: string;
  /** Human-readable script name (informational only) */
  script: string;
  /**
   * Sanscript target scheme name.
   * null => language uses Latin script (e.g. English); skip transliteration.
   */
  sanscriptTarget: string | null;
  /** Unicode range(s) that identify the native script. */
  scriptRanges: Array<[number, number]>;
}

export const LANGUAGE_CONFIG: Record<string, LangConfig> = {
  EN: {
    speechCode:      'en-IN',
    script:          'latin',
    sanscriptTarget: null,
    scriptRanges:    [],
  },
  HI: {
    speechCode:      'hi-IN',
    script:          'devanagari',
    sanscriptTarget: 'devanagari',
    scriptRanges:    [[0x0900, 0x097F]],
  },
  MR: {
    speechCode:      'mr-IN',
    script:          'devanagari',
    sanscriptTarget: 'devanagari',
    scriptRanges:    [[0x0900, 0x097F]],
  },
  GU: {
    speechCode:      'gu-IN',
    script:          'gujarati',
    sanscriptTarget: 'gujarati',
    scriptRanges:    [[0x0A80, 0x0AFF]],
  },
  PA: {
    speechCode:      'pa-IN',
    script:          'gurmukhi',
    sanscriptTarget: 'gurmukhi',
    scriptRanges:    [[0x0A00, 0x0A7F]],
  },
  BN: {
    speechCode:      'bn-IN',
    script:          'bengali',
    sanscriptTarget: 'bengali',
    scriptRanges:    [[0x0980, 0x09FF]],
  },
  TA: {
    speechCode:      'ta-IN',
    script:          'tamil',
    sanscriptTarget: 'tamil',
    scriptRanges:    [[0x0B80, 0x0BFF]],
  },
  TE: {
    speechCode:      'te-IN',
    script:          'telugu',
    sanscriptTarget: 'telugu',
    scriptRanges:    [[0x0C00, 0x0C7F]],
  },
  KN: {
    speechCode:      'kn-IN',
    script:          'kannada',
    sanscriptTarget: 'kannada',
    scriptRanges:    [[0x0C80, 0x0CFF]],
  },
  ML: {
    speechCode:      'ml-IN',
    script:          'malayalam',
    sanscriptTarget: 'malayalam',
    scriptRanges:    [[0x0D00, 0x0D7F]],
  },
  OR: {
    speechCode:      'or-IN',
    script:          'oriya',
    sanscriptTarget: 'oriya',
    scriptRanges:    [[0x0B00, 0x0B7F]],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `text` contains a meaningful proportion of characters
 * from any of the provided Unicode ranges.
 * We use >= 20% native chars as the threshold to call it "already native".
 */
export function isInScript(text: string, ranges: Array<[number, number]>): boolean {
  if (!text || ranges.length === 0) return false;
  let nativeCount = 0;
  let alphaCount = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0x20) alphaCount++;
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) { nativeCount++; break; }
    }
  }
  if (alphaCount === 0) return false;
  return nativeCount / alphaCount >= 0.20;
}

/**
 * Best-effort conversion of Roman Hindi (or other Indic languages typed in
 * Latin characters) to the target Indic script using Sanscript.
 */
function romanToIndic(roman: string, targetScheme: string): string {
  const normalised = roman
    .toLowerCase()
    .replace(/ee/g, 'ii')
    .replace(/oo/g, 'uu');

  try {
    const result = Sanscript.t(normalised, 'itrans_lowercase', targetScheme);
    // Remove word-final virāma (U+094D) artefacts — ITRANS adds these for
    // word-final consonants that have no following vowel.
    // Use a split/join instead of regex to avoid encoding issues in source.
    const virama = '\u094D';  // ् Devanagari Virama
    return result
      .split(virama + ' ').join(' ')
      .split(virama + '\n').join('\n')
      .replace(new RegExp(virama + '$'), '')
      .trim();
  } catch {
    return roman;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a speech transcript (or manually typed text) for the selected
 * application language.
 *
 * Rules:
 *  1. If the language is Latin-script (EN), return unchanged.
 *  2. If the text is already in the target script, return unchanged.
 *  3. Otherwise, attempt ITRANS -> target-script transliteration.
 */
export function normalizeForLanguage(text: string, langCode: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const config = LANGUAGE_CONFIG[langCode.toUpperCase()];
  if (!config || !config.sanscriptTarget) {
    return text;
  }

  if (isInScript(trimmed, config.scriptRanges)) {
    return text;
  }

  const converted = romanToIndic(trimmed, config.sanscriptTarget);
  return converted || text;
}

/**
 * Return the BCP-47 speech code for a given application language key.
 */
export function getSpeechCode(langCode: string): string {
  return LANGUAGE_CONFIG[langCode?.toUpperCase()]?.speechCode ?? 'en-IN';
}

/**
 * Returns true if the language uses a non-Latin (Indic) script.
 */
export function hasNativeScript(langCode: string): boolean {
  const config = LANGUAGE_CONFIG[langCode?.toUpperCase()];
  return !!config && config.sanscriptTarget !== null;
}
