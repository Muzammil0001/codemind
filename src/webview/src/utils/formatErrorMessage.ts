

export function formatErrorMessage(error: string): string {
    if (error.includes('429') || error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('quota')) {
        return 'Rate limit exceeded. Please check your API key billing or try a different model.';
    }

    if (error.includes('401') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('invalid api key')) {
        return 'Invalid API key. Please check your API key in settings.';
    }

    if (error.toLowerCase().includes('timeout') || error.toLowerCase().includes('timed out')) {
        return 'Request timed out. Please try again.';
    }

    if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
    }

    if (error.toLowerCase().includes('model') && error.toLowerCase().includes('not found')) {
        return 'Model not available. Please select a different model.';
    }

    const cleanError = error
        .replace(/Error:\s*/gi, '')
        .replace(/\[.*?\]\s*/g, '') 
        .replace(/https?:\/\/[^\s]+/g, '') 
        .trim();

    if (cleanError.length > 100) {
        return cleanError.substring(0, 97) + '...';
    }

    return cleanError;
}
