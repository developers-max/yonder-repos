import { describe, it, expect } from 'vitest';

/**
 * Unit tests for search strategy selection and hybrid search behavior
 * Tests the logic that determines which search method to use
 */

// Global type definitions for tests
type SearchStrategy = 'exact_keyword' | 'hybrid' | 'semantic';
type QueryType = 'code_lookup' | 'comparative' | 'complex' | 'simple';

describe('Search Strategy Selection', () => {

  function selectSearchStrategy(
    queryType: QueryType,
    useHybridSearch: boolean
  ): { primary: SearchStrategy; fallback: SearchStrategy[] } {
    // Code lookups use exact keyword search first
    if (queryType === 'code_lookup') {
      return {
        primary: 'exact_keyword',
        fallback: useHybridSearch ? ['hybrid', 'semantic'] : ['semantic'],
      };
    }

    // Other queries use hybrid or semantic
    if (useHybridSearch) {
      return {
        primary: 'hybrid',
        fallback: ['semantic'],
      };
    }

    return {
      primary: 'semantic',
      fallback: [],
    };
  }

  describe('Code Lookup Queries', () => {
    it('prioritizes exact keyword search', () => {
      const strategy = selectSearchStrategy('code_lookup', true);
      expect(strategy.primary).toBe('exact_keyword');
    });

    it('falls back to hybrid then semantic', () => {
      const strategy = selectSearchStrategy('code_lookup', true);
      expect(strategy.fallback).toEqual(['hybrid', 'semantic']);
    });

    it('skips hybrid when disabled', () => {
      const strategy = selectSearchStrategy('code_lookup', false);
      expect(strategy.fallback).toEqual(['semantic']);
    });
  });

  describe('Non-Code Queries', () => {
    it('uses hybrid search when enabled', () => {
      const strategy = selectSearchStrategy('simple', true);
      expect(strategy.primary).toBe('hybrid');
    });

    it('uses semantic search when hybrid disabled', () => {
      const strategy = selectSearchStrategy('simple', false);
      expect(strategy.primary).toBe('semantic');
    });

    it('applies to all non-code query types', () => {
      const types: QueryType[] = ['comparative', 'complex', 'simple'];
      
      types.forEach(type => {
        const strategy = selectSearchStrategy(type, true);
        expect(strategy.primary).toBe('hybrid');
      });
    });
  });
});

describe('Hybrid Search Weight Configuration', () => {
  interface HybridWeights {
    semantic: number;
    keyword: number;
  }

  function getHybridWeights(optimizeForCodes: boolean): HybridWeights {
    if (optimizeForCodes) {
      return {
        semantic: 0.5,
        keyword: 0.5,
      };
    }

    return {
      semantic: 0.7,
      keyword: 0.3,
    };
  }

  it('uses balanced weights for code optimization', () => {
    const weights = getHybridWeights(true);
    expect(weights.semantic).toBe(0.5);
    expect(weights.keyword).toBe(0.5);
  });

  it('favors semantic for general queries', () => {
    const weights = getHybridWeights(false);
    expect(weights.semantic).toBeGreaterThan(weights.keyword);
  });

  it('ensures weights sum to 1.0', () => {
    const optimized = getHybridWeights(true);
    const general = getHybridWeights(false);

    expect(optimized.semantic + optimized.keyword).toBe(1.0);
    expect(general.semantic + general.keyword).toBe(1.0);
  });
});

describe('Search Result Scoring', () => {
  interface SearchResult {
    id: string;
    semanticScore: number;
    keywordScore: number;
  }

  function calculateHybridScore(
    result: SearchResult,
    semanticWeight: number,
    keywordWeight: number
  ): number {
    return (
      result.semanticScore * semanticWeight +
      result.keywordScore * keywordWeight
    );
  }

  it('calculates hybrid score correctly', () => {
    const result: SearchResult = {
      id: 'doc1',
      semanticScore: 0.8,
      keywordScore: 0.6,
    };

    const score = calculateHybridScore(result, 0.5, 0.5);
    expect(score).toBe(0.7); // (0.8 * 0.5) + (0.6 * 0.5)
  });

  it('prioritizes semantic when weights are 70/30', () => {
    const result: SearchResult = {
      id: 'doc1',
      semanticScore: 0.9,
      keywordScore: 0.3,
    };

    const score = calculateHybridScore(result, 0.7, 0.3);
    expect(score).toBe(0.72); // (0.9 * 0.7) + (0.3 * 0.3)
  });

  it('favors exact keyword matches with balanced weights', () => {
    const result: SearchResult = {
      id: 'doc1',
      semanticScore: 0.5,
      keywordScore: 0.9,
    };

    const score = calculateHybridScore(result, 0.5, 0.5);
    expect(score).toBe(0.7); // (0.5 * 0.5) + (0.9 * 0.5)
  });

  describe('Ranking Comparison', () => {
    it('ranks exact keyword matches higher with balanced weights', () => {
      const exactMatch: SearchResult = {
        id: 'exact',
        semanticScore: 0.6,
        keywordScore: 0.95,
      };

      const semanticMatch: SearchResult = {
        id: 'semantic',
        semanticScore: 0.85,
        keywordScore: 0.3,
      };

      const exactScore = calculateHybridScore(exactMatch, 0.5, 0.5);
      const semanticScore = calculateHybridScore(semanticMatch, 0.5, 0.5);

      expect(exactScore).toBeGreaterThan(semanticScore);
    });

    it('ranks semantic matches higher with 70/30 weights', () => {
      const exactMatch: SearchResult = {
        id: 'exact',
        semanticScore: 0.6,
        keywordScore: 0.95,
      };

      const semanticMatch: SearchResult = {
        id: 'semantic',
        semanticScore: 0.9,
        keywordScore: 0.3,
      };

      const exactScore = calculateHybridScore(exactMatch, 0.7, 0.3);
      // (0.6 * 0.7) + (0.95 * 0.3) = 0.42 + 0.285 = 0.705
      const semanticScore = calculateHybridScore(semanticMatch, 0.7, 0.3);
      // (0.9 * 0.7) + (0.3 * 0.3) = 0.63 + 0.09 = 0.72

      expect(semanticScore).toBeGreaterThan(exactScore);
    });
  });
});

describe('Similarity Threshold Behavior', () => {
  function passesThreshold(similarity: number, threshold: number): boolean {
    return similarity >= threshold;
  }

  function filterByThreshold(scores: number[], threshold: number): number[] {
    return scores.filter(score => passesThreshold(score, threshold));
  }

  describe('With 0.20 threshold (lowered for hybrid)', () => {
    const THRESHOLD = 0.20;

    it('accepts moderate similarity scores', () => {
      expect(passesThreshold(0.25, THRESHOLD)).toBe(true);
      expect(passesThreshold(0.35, THRESHOLD)).toBe(true);
    });

    it('rejects very low scores', () => {
      expect(passesThreshold(0.15, THRESHOLD)).toBe(false);
      expect(passesThreshold(0.10, THRESHOLD)).toBe(false);
    });

    it('filters results appropriately', () => {
      const scores = [0.85, 0.45, 0.30, 0.18, 0.05];
      const filtered = filterByThreshold(scores, THRESHOLD);
      
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual([0.85, 0.45, 0.30]);
    });
  });

  describe('Threshold impact on recall', () => {
    it('higher threshold reduces recall but increases precision', () => {
      const scores = [0.90, 0.75, 0.60, 0.45, 0.30, 0.15];
      
      const lowThreshold = filterByThreshold(scores, 0.20);
      const highThreshold = filterByThreshold(scores, 0.50);

      expect(lowThreshold.length).toBeGreaterThan(highThreshold.length);
    });
  });
});

describe('TopK Candidate Multiplier', () => {
  function calculateCandidateCount(topK: number, multiplier: number): number {
    return topK * multiplier;
  }

  function simulateReranking(
    candidates: number,
    topK: number
  ): { retrieved: number; returned: number; reranked: number } {
    return {
      retrieved: candidates,
      returned: topK,
      reranked: candidates - topK,
    };
  }

  it('retrieves 4x candidates for reranking', () => {
    const candidates = calculateCandidateCount(5, 4);
    expect(candidates).toBe(20);
  });

  it('returns only topK after reranking', () => {
    const result = simulateReranking(20, 5);
    
    expect(result.retrieved).toBe(20);
    expect(result.returned).toBe(5);
    expect(result.reranked).toBe(15);
  });

  describe('Different topK values', () => {
    it('scales candidates appropriately', () => {
      expect(calculateCandidateCount(3, 4)).toBe(12);
      expect(calculateCandidateCount(7, 4)).toBe(28);
      expect(calculateCandidateCount(10, 4)).toBe(40);
    });
  });
});

describe('Search Method Performance', () => {
  interface SearchPerformance {
    method: SearchStrategy;
    avgLatencyMs: number;
    precisionFor: string[];
  }

  const PERFORMANCE_PROFILES: SearchPerformance[] = [
    {
      method: 'exact_keyword',
      avgLatencyMs: 50,
      precisionFor: ['codes', 'exact_terms'],
    },
    {
      method: 'hybrid',
      avgLatencyMs: 200,
      precisionFor: ['codes', 'concepts', 'mixed'],
    },
    {
      method: 'semantic',
      avgLatencyMs: 150,
      precisionFor: ['concepts', 'natural_language'],
    },
  ];

  function selectOptimalMethod(
    queryType: string,
    requiresSpeed: boolean
  ): SearchStrategy {
    if (queryType === 'code' && requiresSpeed) {
      return 'exact_keyword';
    }

    if (queryType === 'code') {
      return 'hybrid';
    }

    return requiresSpeed ? 'semantic' : 'hybrid';
  }

  it('chooses exact keyword for fast code queries', () => {
    const method = selectOptimalMethod('code', true);
    expect(method).toBe('exact_keyword');
  });

  it('chooses hybrid for accurate code queries', () => {
    const method = selectOptimalMethod('code', false);
    expect(method).toBe('hybrid');
  });

  it('provides correct latency estimates', () => {
    const exactKeyword = PERFORMANCE_PROFILES.find(p => p.method === 'exact_keyword');
    const hybrid = PERFORMANCE_PROFILES.find(p => p.method === 'hybrid');

    expect(exactKeyword?.avgLatencyMs).toBeLessThan(hybrid?.avgLatencyMs || 0);
  });

  it('maps methods to their strengths', () => {
    const exact = PERFORMANCE_PROFILES.find(p => p.method === 'exact_keyword');
    const hybrid = PERFORMANCE_PROFILES.find(p => p.method === 'hybrid');

    expect(exact?.precisionFor).toContain('codes');
    expect(hybrid?.precisionFor).toContain('codes');
    expect(hybrid?.precisionFor).toContain('concepts');
  });
});

describe('Search Fallback Chain', () => {
  interface SearchAttempt {
    method: SearchStrategy;
    success: boolean;
    error?: string;
  }

  function executeSearchChain(
    attempts: SearchAttempt[]
  ): SearchStrategy | null {
    for (const attempt of attempts) {
      if (attempt.success) return attempt.method;
    }
    return null;
  }

  it('returns first successful method', () => {
    const attempts: SearchAttempt[] = [
      { method: 'exact_keyword', success: true },
      { method: 'hybrid', success: true },
      { method: 'semantic', success: true },
    ];

    const result = executeSearchChain(attempts);
    expect(result).toBe('exact_keyword');
  });

  it('falls back to next method on failure', () => {
    const attempts: SearchAttempt[] = [
      { method: 'exact_keyword', success: false, error: 'No results' },
      { method: 'hybrid', success: true },
      { method: 'semantic', success: true },
    ];

    const result = executeSearchChain(attempts);
    expect(result).toBe('hybrid');
  });

  it('continues through all fallbacks if needed', () => {
    const attempts: SearchAttempt[] = [
      { method: 'exact_keyword', success: false },
      { method: 'hybrid', success: false },
      { method: 'semantic', success: true },
    ];

    const result = executeSearchChain(attempts);
    expect(result).toBe('semantic');
  });

  it('returns null when all methods fail', () => {
    const attempts: SearchAttempt[] = [
      { method: 'exact_keyword', success: false },
      { method: 'hybrid', success: false },
      { method: 'semantic', success: false },
    ];

    const result = executeSearchChain(attempts);
    expect(result).toBeNull();
  });
});

describe('Query Optimization for Different Search Methods', () => {
  function optimizeForKeywordSearch(query: string): string {
    // Keep codes, numbers, and important characters
    return query.replace(/[^\w\s\-_.]/g, ' ').trim();
  }

  function optimizeForSemanticSearch(query: string): string {
    // Keep natural language, remove excessive punctuation
    return query.replace(/[^\w\s\u00C0-\u024F]/g, ' ').trim();
  }

  describe('Keyword Search Optimization', () => {
    it('preserves codes and special characters', () => {
      const optimized = optimizeForKeywordSearch('What is code 20-a-1?');
      expect(optimized).toContain('20-a-1');
      expect(optimized).toContain('code');
    });

    it('removes unnecessary punctuation', () => {
      const optimized = optimizeForKeywordSearch('What is "code" 20a1?');
      expect(optimized).not.toContain('"');
      expect(optimized).toContain('code');
      expect(optimized).toContain('20a1');
    });
  });

  describe('Semantic Search Optimization', () => {
    it('preserves natural language', () => {
      const optimized = optimizeForSemanticSearch('¿Qué es el código 20a1?');
      expect(optimized).toContain('Qué');
      expect(optimized).toContain('código');
    });

    it('handles multilingual characters', () => {
      const optimized = optimizeForSemanticSearch('Què és el codi 20a?');
      expect(optimized).toContain('Què');
      expect(optimized).toContain('codi');
    });
  });
});

describe('Result Deduplication', () => {
  interface SearchResult {
    document_url: string;
    chunk_index: number;
    score: number;
  }

  function deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.document_url}:${result.chunk_index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  it('removes exact duplicates', () => {
    const results: SearchResult[] = [
      { document_url: 'doc1.pdf', chunk_index: 5, score: 0.9 },
      { document_url: 'doc1.pdf', chunk_index: 5, score: 0.85 },
      { document_url: 'doc2.pdf', chunk_index: 3, score: 0.8 },
    ];

    const unique = deduplicateResults(results);
    expect(unique).toHaveLength(2);
  });

  it('keeps different chunks from same document', () => {
    const results: SearchResult[] = [
      { document_url: 'doc1.pdf', chunk_index: 5, score: 0.9 },
      { document_url: 'doc1.pdf', chunk_index: 6, score: 0.85 },
    ];

    const unique = deduplicateResults(results);
    expect(unique).toHaveLength(2);
  });

  it('preserves order (keeps first occurrence)', () => {
    const results: SearchResult[] = [
      { document_url: 'doc1.pdf', chunk_index: 5, score: 0.85 },
      { document_url: 'doc1.pdf', chunk_index: 5, score: 0.9 },
    ];

    const unique = deduplicateResults(results);
    expect(unique[0].score).toBe(0.85);
  });
});
