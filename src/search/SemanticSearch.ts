

import { codeIndexer } from './CodeIndexer';
import { modelRouter } from '../ai/ModelRouter';
import { logger } from '../utils/logger';

export interface SearchResult {
    path: string;
    score: number;
    snippet?: string;
    type: 'semantic' | 'keyword';
}

export class SemanticSearch {

    async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
        try {
            const keywordResults = codeIndexer.search(query, maxResults * 2);

            if (keywordResults.length === 0) return [];

            const reranked = await this.rerankResults(query, keywordResults);
            return reranked.slice(0, maxResults);

        } catch (error) {
            logger.error('Semantic search failed', error as Error);
            return [];
        }
    }

    private async rerankResults(query: string, paths: string[]): Promise<SearchResult[]> {

        return paths.map(path => {
            let score = 0;

            if (path.toLowerCase().includes(query.toLowerCase())) score += 50;

            const words = query.toLowerCase().split(' ');
            const matchCount = words.filter(w => path.toLowerCase().includes(w)).length;
            score += (matchCount / words.length) * 30;

            return {
                path,
                score,
                type: 'keyword' as const
            };
        }).sort((a, b) => b.score - a.score);
    }
}

export const semanticSearch = new SemanticSearch();
