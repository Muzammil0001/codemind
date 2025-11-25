
/**
 * Formats error messages to be concise and user-friendly (max 2-3 lines)
 */
export function formatErrorMessage(error: string): string {
    // Handle 429 rate limit errors
    if (error.includes('429') || error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('quota')) {
        return 'Rate limit exceeded. Please check your API key billing or try a different model.';
    }

    // Handle 401 authentication errors
    if (error.includes('401') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('invalid api key')) {
        return 'Invalid API key. Please check your API key in settings.';
    }

    // Handle timeout errors
    if (error.toLowerCase().includes('timeout') || error.toLowerCase().includes('timed out')) {
        return 'Request timed out. Please try again.';
    }

    // Handle network errors
    if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
    }

    // Handle model not found errors
    if (error.toLowerCase().includes('model') && error.toLowerCase().includes('not found')) {
        return 'Model not available. Please select a different model.';
    }

    // Generic error - truncate if too long
    const cleanError = error
        .replace(/Error:\s*/gi, '')
        .replace(/\[.*?\]\s*/g, '') // Remove [ErrorType] prefixes
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .trim();

    // Limit to ~100 characters (roughly 2 lines)
    if (cleanError.length > 100) {
        return cleanError.substring(0, 97) + '...';
    }

    return cleanError;
}
