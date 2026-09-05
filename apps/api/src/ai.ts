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