function getColabApiUrl() {
    return process.env.COLAB_API_URL?.trim().replace(/\/+$/, '');
}

export type AIHealthResult =
    | {
        available: true;
        data: unknown;
    }
    | {
        available: false;
        reason: string;
    };

export async function checkAIHealth(): Promise<AIHealthResult> {
    const baseUrl = getColabApiUrl();

    if (!baseUrl) {
        return {
            available: false,
            reason: 'COLAB_API_URL is not configured',
        };
    }

    try {
        const response = await fetch(`${baseUrl}/health`);

        if (!response.ok) {
            return {
                available: false,
                reason: `Colab returned HTTP ${response.status}`,
            };
        }

        const data = await response.json();

        return {
            available: true,
            data,
        };
    } catch (error) {
        return {
            available: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function analyzeReport(
    file: File
): Promise<
    | { success: true; data: unknown }
    | { success: false; reason: string }
> {
    const baseUrl = getColabApiUrl();

    if (!baseUrl) {
        return {
            success: false,
            reason: 'COLAB_API_URL is not configured',
        };
    }

    try {
        const formData = new FormData();

        const buffer = await file.arrayBuffer();

        const blob = new Blob([buffer], {
            type: file.type,
        });

        formData.append('report', blob, file.name);

        const response = await fetch(`${baseUrl}/analyze/report`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                reason: data?.detail || `Colab returned HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            data,
        };
    } catch (error) {
        return {
            success: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function analyzeSymptoms(
    symptoms: unknown[]
): Promise<
    | { success: true; data: unknown }
    | { success: false; reason: string }
> {
    const baseUrl = getColabApiUrl();

    if (!baseUrl) {
        return {
            success: false,
            reason: 'COLAB_API_URL is not configured',
        };
    }

    try {
        const formData = new FormData();

        formData.append(
            'symptoms_data',
            JSON.stringify({
                symptoms,
            })
        );

        const response = await fetch(
            `${baseUrl}/analyze/symptoms`,
            {
                method: 'POST',
                body: formData,
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                reason:
                    data?.detail ||
                    `Colab returned HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            data,
        };
    } catch (error) {
        return {
            success: false,
            reason:
                error instanceof Error
                    ? error.message
                    : String(error),
        };
    }
}

export async function analyzeContext(
    patient: Record<string, unknown>,
    reportAnalysis: Record<string, unknown>,
    symptomAnalysis: Record<string, unknown>
): Promise<
    | { success: true; data: unknown }
    | { success: false; reason: string }
> {
    const baseUrl = getColabApiUrl();

    if (!baseUrl) {
        return {
            success: false,
            reason: 'COLAB_API_URL is not configured',
        };
    }

    try {
        const formData = new FormData();

        formData.append(
            'context_data',
            JSON.stringify({
                patient,
                report_analysis: reportAnalysis,
                symptom_analysis: symptomAnalysis,
            })
        );

        const response = await fetch(
            `${baseUrl}/analyze/context`,
            {
                method: 'POST',
                body: formData,
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                reason:
                    data?.detail ||
                    `Colab returned HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            data,
        };
    } catch (error) {
        return {
            success: false,
            reason:
                error instanceof Error
                    ? error.message
                    : String(error),
        };
    }
}

export type TranslationLanguage = 'EN' | 'HI' | 'TA';

const DEFAULT_PUTER_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYyIn0.eyJ0IjoidCIsInYiOiIyIiwidG9rZW5fdWlkIjoiZWRjZWFlYjQtMWRiMC00NGJmLWE4YzktMGUzNTI3OGUzNGViIiwidXUiOiJyT3g2Mi92cVFBaXkxcHp4YUt4eThRPT0iLCJzdSI6ImIzeDVYTElMU2ZDK2dtK2lDYmFMeHc9PSIsImFpIjoick94NjIvdnFRQWl5MXB6eGFLeHk4UT09IiwiZnVsbF9hY2Nlc3MiOnRydWUsImlhdCI6MTc4ODU5MzQxM30.oabJYxHBTnR-u_9Wt8JEectxnMNI0GCNeeXkGeqd1TE';

export function normalizeTranslationLanguage(value: unknown): TranslationLanguage {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'HI' || v === 'HINDI') return 'HI';
    if (v === 'TA' || v === 'TAMIL') return 'TA';
    return 'EN';
}

let puterClient: any | null = null;

async function getPuterClient(): Promise<any> {
    if (puterClient) return puterClient;

    const authToken =
        process.env.PUTER_AUTH_TOKEN?.trim() ||
        process.env.puterAuthToken?.trim() ||
        DEFAULT_PUTER_TOKEN;

    // Puter documents Node.js usage through its CommonJS init entry point.
    const { init } = await import('@heyputer/puter.js/src/init.cjs');
    puterClient = init(authToken);
    return puterClient;
}

function extractPuterText(response: any): string {
    const content = response?.message?.content ?? response?.content ?? response?.text ?? response;

    if (typeof content === 'string') return content.trim();

    if (Array.isArray(content)) {
        return content
            .map((part: any) => typeof part === 'string' ? part : String(part?.text ?? part?.content ?? ''))
            .join('')
            .trim();
    }

    return String(content ?? '').trim();
}

/**
 * Fallback translation using free public translation service
 */
async function fallbackTranslate(
    text: string,
    fromLang: string,
    toLang: string
): Promise<string | null> {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(fromLang)}|${encodeURIComponent(toLang)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data: any = await res.json();
        const translated = data?.responseData?.translatedText;
        if (typeof translated === 'string' && translated.trim() && !translated.includes('MYMEMORY WARNING:')) {
            return translated.trim();
        }
    } catch {
        // Fallback failed, continue
    }
    return null;
}

/**
 * Common emergency and clinical phrase dictionary fallback
 */
const MEDICAL_FALLBACK_DICTIONARY: Record<string, { HI: string; TA: string; EN: string }> = {
    'please take medicine twice a day': {
        HI: 'कृपया दिन में दो बार दवा लें।',
        TA: 'தயவுசெய்து இந்த மருந்தை ஒரு நாளில் இரண்டு முறை எடுத்துக்கொள்ளுங்கள்.',
        EN: 'Please take medicine twice a day.'
    },
    'take rest and drink plenty of water': {
        HI: 'आराम करें और खूब पानी पिएं।',
        TA: 'ஓய்வெடுக்கவும் மற்றும் நிறைய தண்ணீர் குடிக்கவும்.',
        EN: 'Take rest and drink plenty of water.'
    },
    'doctor will review your symptoms soon': {
        HI: 'डॉक्टर जल्द ही आपके लक्षणों की समीक्षा करेंगे।',
        TA: 'மருத்துவர் விரைவில் உங்கள் அறிகுறிகளை மதிப்பாய்வு செய்வார்.',
        EN: 'Doctor will review your symptoms soon.'
    }
};

/**
 * Translate clinical instructions for a patient into their preferred language.
 */
export async function translateForPatient(
    text: string,
    language: unknown
): Promise<
    | { success: true; translatedText: string; language: TranslationLanguage; engine: string }
    | { success: false; reason: string }
> {
    const targetLanguage = normalizeTranslationLanguage(language);
    if (targetLanguage === 'EN') {
        return { success: true, translatedText: text, language: targetLanguage, engine: 'pass-through' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
        return { success: true, translatedText: '', language: targetLanguage, engine: 'empty' };
    }

    // Check if the text is already predominantly in Hindi/Tamil (contains Devanagari or Tamil unicode)
    const isDevanagari = /[\u0900-\u097F]/.test(trimmed);
    const isTamil = /[\u0B80-\u0BFF]/.test(trimmed);
    if ((targetLanguage === 'HI' && isDevanagari) || (targetLanguage === 'TA' && isTamil)) {
        return { success: true, translatedText: trimmed, language: targetLanguage, engine: 'native' };
    }

    const targetName = targetLanguage === 'HI' ? 'Hindi' : 'Tamil';

    // Tier 1: Puter.js AI Translation
    try {
        const puter = await getPuterClient();
        const prompt = [
            `Translate the following healthcare instruction or message from English to ${targetName}.`,
            '',
            'Rules:',
            '- Preserve the exact medical meaning.',
            '- Do not add medical advice, questions, or explanations.',
            '- Do not remove any information.',
            '- Keep numbers, dosages, dates, times, measurements, and medicine names clear.',
            '- Keep the tone warm, clear, simple, respectful, and suitable for a patient.',
            '- Return ONLY the translated text in the target script. Do not add quotes, notes, or explanations.',
            '',
            'Text to translate:',
            trimmed,
        ].join('\n');

        const response = await puter.ai.chat(prompt, {
            model: process.env.PUTER_TRANSLATION_MODEL?.trim() || 'gpt-5-nano',
        });

        const translatedText = extractPuterText(response);
        if (translatedText && translatedText.length > 0) {
            // Strip any unintended surrounding quotes
            const clean = translatedText.replace(/^["']|["']$/g, '').trim();
            return { success: true, translatedText: clean, language: targetLanguage, engine: 'puter-ai' };
        }
    } catch (puterError: any) {
        console.warn(`[translation] Puter AI translation failed (${targetName}):`, puterError?.message || puterError);
    }

    // Tier 2: Public API Fallback
    const apiFallback = await fallbackTranslate(trimmed, 'en', targetLanguage.toLowerCase());
    if (apiFallback) {
        return { success: true, translatedText: apiFallback, language: targetLanguage, engine: 'api-fallback' };
    }

    // Tier 3: Dictionary lookup
    const lower = trimmed.toLowerCase();
    for (const [key, dict] of Object.entries(MEDICAL_FALLBACK_DICTIONARY)) {
        if (lower.includes(key)) {
            return { success: true, translatedText: dict[targetLanguage], language: targetLanguage, engine: 'dictionary' };
        }
    }

    return {
        success: false,
        reason: `Translation to ${targetName} is temporarily unavailable.`,
    };
}

/**
 * Translate a patient's message (which may be in Hindi, Tamil, or English)
 * into English for the healthcare team.
 */
export async function translateToEnglish(
    text: string,
    sourceLanguage?: unknown
): Promise<
    | { success: true; translatedText: string; sourceLanguage: string; engine: string }
    | { success: false; reason: string }
> {
    const trimmed = text.trim();
    if (!trimmed) {
        return { success: true, translatedText: '', sourceLanguage: 'EN', engine: 'empty' };
    }

    const hasDevanagari = /[\u0900-\u097F]/.test(trimmed);
    const hasTamil = /[\u0B80-\u0BFF]/.test(trimmed);

    let detectedSource = normalizeTranslationLanguage(sourceLanguage);
    if (hasDevanagari) detectedSource = 'HI';
    else if (hasTamil) detectedSource = 'TA';

    // If already in English with no Indian script
    if (detectedSource === 'EN' && !hasDevanagari && !hasTamil) {
        return { success: true, translatedText: trimmed, sourceLanguage: 'EN', engine: 'pass-through' };
    }

    const sourceName = detectedSource === 'HI' ? 'Hindi' : 'Tamil';

    // Tier 1: Puter.js AI Translation
    try {
        const puter = await getPuterClient();
        const prompt = [
            `Translate the following message from a patient in ${sourceName} into clear, concise clinical English for the doctor and healthcare worker.`,
            '',
            'Rules:',
            '- Preserve all symptoms, descriptions, timeline, and concerns expressed by the patient.',
            '- Do not add commentary, advice, or interpretations.',
            '- Return ONLY the translated English text. No quotes, labels, or conversational preamble.',
            '',
            'Patient Message:',
            trimmed,
        ].join('\n');

        const response = await puter.ai.chat(prompt, {
            model: process.env.PUTER_TRANSLATION_MODEL?.trim() || 'gpt-5-nano',
        });

        const translatedText = extractPuterText(response);
        if (translatedText && translatedText.length > 0) {
            const clean = translatedText.replace(/^["']|["']$/g, '').trim();
            return { success: true, translatedText: clean, sourceLanguage: detectedSource, engine: 'puter-ai' };
        }
    } catch (puterError: any) {
        console.warn(`[translation] Puter AI patient->English failed:`, puterError?.message || puterError);
    }

    // Tier 2: Public API Fallback
    const apiFallback = await fallbackTranslate(trimmed, detectedSource.toLowerCase(), 'en');
    if (apiFallback) {
        return { success: true, translatedText: apiFallback, sourceLanguage: detectedSource, engine: 'api-fallback' };
    }

    return {
        success: false,
        reason: `Translation from ${sourceName} to English was unavailable.`,
    };
}
