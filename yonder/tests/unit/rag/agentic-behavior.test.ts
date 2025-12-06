import { describe, it, expect } from 'vitest';

/**
 * Unit tests for agentic RAG behavior
 * Tests decision-making logic, iteration control, and result selection
 */

interface IterationResult {
  iteration: number;
  sourcesFound: number;
  relevanceScore: number;
  avgSimilarity: number;
}

describe('Agentic Decision Making', () => {
  const RELEVANCE_THRESHOLD = 0.6;
  const MIN_SOURCES_REQUIRED = 2;

  function makeDecision(
    result: IterationResult,
    currentIteration: number,
    maxIterations: number
  ): { decision: 'accept' | 'rewrite_query' | 'max_iterations'; reason: string } {
    const { sourcesFound, relevanceScore } = result;

    // No sources found
    if (sourcesFound === 0) {
      return {
        decision: currentIteration < maxIterations ? 'rewrite_query' : 'max_iterations',
        reason: 'No sources found',
      };
    }

    // Low relevance
    if (relevanceScore < RELEVANCE_THRESHOLD) {
      return {
        decision: currentIteration < maxIterations ? 'rewrite_query' : 'max_iterations',
        reason: `Low relevance score (${(relevanceScore * 100).toFixed(0)}%)`,
      };
    }

    // Insufficient sources
    if (sourcesFound < MIN_SOURCES_REQUIRED) {
      return {
        decision: currentIteration < maxIterations ? 'rewrite_query' : 'max_iterations',
        reason: `Insufficient sources (${sourcesFound} < ${MIN_SOURCES_REQUIRED})`,
      };
    }

    // Accept good results
    return {
      decision: 'accept',
      reason: 'Documents are relevant and sufficient',
    };
  }

  describe('Accept Conditions', () => {
    it('accepts when all criteria are met', () => {
      const result: IterationResult = {
        iteration: 1,
        sourcesFound: 5,
        relevanceScore: 0.85,
        avgSimilarity: 0.72,
      };

      const { decision } = makeDecision(result, 1, 3);
      expect(decision).toBe('accept');
    });

    it('accepts with minimum threshold values', () => {
      const result: IterationResult = {
        iteration: 1,
        sourcesFound: 2,
        relevanceScore: 0.6,
        avgSimilarity: 0.5,
      };

      const { decision } = makeDecision(result, 1, 3);
      expect(decision).toBe('accept');
    });

    it('accepts even on last iteration if criteria met', () => {
      const result: IterationResult = {
        iteration: 3,
        sourcesFound: 3,
        relevanceScore: 0.7,
        avgSimilarity: 0.6,
      };

      const { decision } = makeDecision(result, 3, 3);
      expect(decision).toBe('accept');
    });
  });

  describe('Rewrite Conditions', () => {
    it('rewrites when no sources found (early iterations)', () => {
      const result: IterationResult = {
        iteration: 1,
        sourcesFound: 0,
        relevanceScore: 0,
        avgSimilarity: 0,
      };

      const { decision, reason } = makeDecision(result, 1, 3);
      expect(decision).toBe('rewrite_query');
      expect(reason).toBe('No sources found');
    });

    it('rewrites when relevance is too low', () => {
      const result: IterationResult = {
        iteration: 1,
        sourcesFound: 5,
        relevanceScore: 0.4,
        avgSimilarity: 0.5,
      };

      const { decision, reason } = makeDecision(result, 1, 3);
      expect(decision).toBe('rewrite_query');
      expect(reason).toContain('Low relevance');
    });

    it('rewrites when insufficient sources', () => {
      const result: IterationResult = {
        iteration: 1,
        sourcesFound: 1,
        relevanceScore: 0.8,
        avgSimilarity: 0.7,
      };

      const { decision, reason } = makeDecision(result, 1, 3);
      expect(decision).toBe('rewrite_query');
      expect(reason).toContain('Insufficient sources');
    });
  });

  describe('Max Iterations Reached', () => {
    it('stops at max iterations even with no sources', () => {
      const result: IterationResult = {
        iteration: 3,
        sourcesFound: 0,
        relevanceScore: 0,
        avgSimilarity: 0,
      };

      const { decision } = makeDecision(result, 3, 3);
      expect(decision).toBe('max_iterations');
    });

    it('stops at max iterations with low relevance', () => {
      const result: IterationResult = {
        iteration: 3,
        sourcesFound: 5,
        relevanceScore: 0.3,
        avgSimilarity: 0.4,
      };

      const { decision } = makeDecision(result, 3, 3);
      expect(decision).toBe('max_iterations');
    });
  });
});

describe('Best Result Selection', () => {
  interface ResultCandidate {
    iteration: number;
    relevanceScore: number;
    sourcesFound: number;
  }

  function selectBestResult(candidates: ResultCandidate[]): ResultCandidate | null {
    if (candidates.length === 0) return null;

    return candidates.reduce((best, current) => {
      // Prefer higher relevance
      if (current.relevanceScore > best.relevanceScore) return current;
      
      // If equal relevance, prefer more sources
      if (current.relevanceScore === best.relevanceScore && 
          current.sourcesFound > best.sourcesFound) {
        return current;
      }
      
      return best;
    });
  }

  it('selects result with highest relevance', () => {
    const candidates: ResultCandidate[] = [
      { iteration: 1, relevanceScore: 0.5, sourcesFound: 5 },
      { iteration: 2, relevanceScore: 0.8, sourcesFound: 3 },
      { iteration: 3, relevanceScore: 0.6, sourcesFound: 7 },
    ];

    const best = selectBestResult(candidates);
    expect(best?.iteration).toBe(2);
    expect(best?.relevanceScore).toBe(0.8);
  });

  it('uses source count as tiebreaker', () => {
    const candidates: ResultCandidate[] = [
      { iteration: 1, relevanceScore: 0.7, sourcesFound: 3 },
      { iteration: 2, relevanceScore: 0.7, sourcesFound: 8 },
      { iteration: 3, relevanceScore: 0.7, sourcesFound: 5 },
    ];

    const best = selectBestResult(candidates);
    expect(best?.iteration).toBe(2);
    expect(best?.sourcesFound).toBe(8);
  });

  it('returns null for empty candidates', () => {
    const best = selectBestResult([]);
    expect(best).toBeNull();
  });

  it('returns single candidate', () => {
    const candidates: ResultCandidate[] = [
      { iteration: 1, relevanceScore: 0.6, sourcesFound: 4 },
    ];

    const best = selectBestResult(candidates);
    expect(best?.iteration).toBe(1);
  });
});

describe('Iteration Control', () => {
  function shouldContinueIterating(
    currentIteration: number,
    maxIterations: number,
    lastDecision: 'accept' | 'rewrite_query' | 'max_iterations'
  ): boolean {
    if (lastDecision === 'accept') return false;
    if (lastDecision === 'max_iterations') return false;
    if (currentIteration >= maxIterations) return false;
    return true;
  }

  it('continues when decision is rewrite_query', () => {
    expect(shouldContinueIterating(1, 3, 'rewrite_query')).toBe(true);
    expect(shouldContinueIterating(2, 3, 'rewrite_query')).toBe(true);
  });

  it('stops when decision is accept', () => {
    expect(shouldContinueIterating(1, 3, 'accept')).toBe(false);
    expect(shouldContinueIterating(2, 3, 'accept')).toBe(false);
  });

  it('stops at max iterations', () => {
    expect(shouldContinueIterating(3, 3, 'rewrite_query')).toBe(false);
  });

  it('stops when max_iterations decision is made', () => {
    expect(shouldContinueIterating(3, 3, 'max_iterations')).toBe(false);
  });
});

describe('Query Rewriting Strategy', () => {
  interface QueryRewriteContext {
    originalQuery: string;
    previousAttempts: string[];
    failureReason: string;
  }

  function shouldRewriteQuery(context: QueryRewriteContext): boolean {
    // Don't rewrite if we've tried too many times with similar queries
    const uniqueAttempts = new Set([context.originalQuery, ...context.previousAttempts]);
    if (uniqueAttempts.size >= 4) return false;

    // Don't rewrite if the failure isn't about finding information
    if (context.failureReason.includes('error') || 
        context.failureReason.includes('timeout')) {
      return false;
    }

    return true;
  }

  it('allows rewriting for search failures', () => {
    const context: QueryRewriteContext = {
      originalQuery: 'What is code 20a1?',
      previousAttempts: [],
      failureReason: 'No sources found',
    };

    expect(shouldRewriteQuery(context)).toBe(true);
  });

  it('prevents excessive rewrites', () => {
    const context: QueryRewriteContext = {
      originalQuery: 'What is code 20a1?',
      previousAttempts: [
        'Zoning regulations for code 20a1',
        'Requirements for qualificació 20a1',
        'Building codes for 20a1 zone',
      ],
      failureReason: 'Low relevance',
    };

    expect(shouldRewriteQuery(context)).toBe(false);
  });

  it('skips rewriting for technical failures', () => {
    const context: QueryRewriteContext = {
      originalQuery: 'What is code 20a1?',
      previousAttempts: [],
      failureReason: 'Database connection error',
    };

    expect(shouldRewriteQuery(context)).toBe(false);
  });
});

describe('Relevance Score Calculation', () => {
  interface MockGradingInput {
    hasKeywords: boolean;
    hasSemanticMatch: boolean;
    documentCount: number;
  }

  function simulateRelevanceScore(input: MockGradingInput): number {
    let score = 0.0;

    // Keyword presence: 40% weight
    if (input.hasKeywords) score += 0.4;

    // Semantic match: 40% weight
    if (input.hasSemanticMatch) score += 0.4;

    // Document count bonus: up to 20%
    const docBonus = Math.min(input.documentCount / 10, 0.2);
    score += docBonus;

    return Math.min(score, 1.0);
  }

  it('gives high score when all criteria met', () => {
    const score = simulateRelevanceScore({
      hasKeywords: true,
      hasSemanticMatch: true,
      documentCount: 8,
    });

    expect(score).toBeGreaterThanOrEqual(0.8);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('gives medium score with partial match', () => {
    const score = simulateRelevanceScore({
      hasKeywords: true,
      hasSemanticMatch: false,
      documentCount: 3,
    });

    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThan(0.65); // Allow for floating point precision
  });

  it('gives low score without matches', () => {
    const score = simulateRelevanceScore({
      hasKeywords: false,
      hasSemanticMatch: false,
      documentCount: 1,
    });

    expect(score).toBeLessThan(0.3);
  });

  it('caps score at 1.0', () => {
    const score = simulateRelevanceScore({
      hasKeywords: true,
      hasSemanticMatch: true,
      documentCount: 100, // Excessive documents
    });

    expect(score).toBe(1.0);
  });
});

describe('Agentic Metadata Generation', () => {
  interface IterationHistory {
    iteration: number;
    query: string;
    wasRewritten: boolean;
    decision: string;
  }

  function generateAgenticMetadata(
    iterations: IterationHistory[],
    successfulIteration: number
  ) {
    const queriesRewritten = iterations.filter(i => i.wasRewritten).length;
    const relevanceChecks = iterations.length;

    return {
      queriesRewritten,
      relevanceChecks,
      successfulIteration,
      totalIterations: iterations.length,
      hadRewrites: queriesRewritten > 0,
      acceptedFirstTry: successfulIteration === 1,
    };
  }

  it('tracks rewrites correctly', () => {
    const iterations: IterationHistory[] = [
      { iteration: 1, query: 'original', wasRewritten: false, decision: 'rewrite' },
      { iteration: 2, query: 'rewritten', wasRewritten: true, decision: 'accept' },
    ];

    const metadata = generateAgenticMetadata(iterations, 2);
    expect(metadata.queriesRewritten).toBe(1);
    expect(metadata.hadRewrites).toBe(true);
  });

  it('identifies first-try success', () => {
    const iterations: IterationHistory[] = [
      { iteration: 1, query: 'perfect query', wasRewritten: false, decision: 'accept' },
    ];

    const metadata = generateAgenticMetadata(iterations, 1);
    expect(metadata.acceptedFirstTry).toBe(true);
    expect(metadata.queriesRewritten).toBe(0);
  });

  it('counts all relevance checks', () => {
    const iterations: IterationHistory[] = [
      { iteration: 1, query: 'q1', wasRewritten: false, decision: 'rewrite' },
      { iteration: 2, query: 'q2', wasRewritten: true, decision: 'rewrite' },
      { iteration: 3, query: 'q3', wasRewritten: true, decision: 'accept' },
    ];

    const metadata = generateAgenticMetadata(iterations, 3);
    expect(metadata.relevanceChecks).toBe(3);
    expect(metadata.totalIterations).toBe(3);
  });

  it('handles no success scenario', () => {
    const iterations: IterationHistory[] = [
      { iteration: 1, query: 'q1', wasRewritten: false, decision: 'rewrite' },
      { iteration: 2, query: 'q2', wasRewritten: true, decision: 'rewrite' },
      { iteration: 3, query: 'q3', wasRewritten: true, decision: 'max_iterations' },
    ];

    const metadata = generateAgenticMetadata(iterations, -1);
    expect(metadata.successfulIteration).toBe(-1);
    expect(metadata.acceptedFirstTry).toBe(false);
  });
});

describe('Performance Characteristics', () => {
  function estimateLatency(iterations: number, hasRewrites: boolean): number {
    const BASE_SEARCH_MS = 1000; // Base search time
    const REWRITE_MS = 500; // Time to rewrite query
    const GRADING_MS = 300; // Time to grade results

    let total = 0;
    for (let i = 0; i < iterations; i++) {
      total += BASE_SEARCH_MS;
      total += GRADING_MS;
      if (hasRewrites && i < iterations - 1) {
        total += REWRITE_MS;
      }
    }

    return total;
  }

  it('estimates standard RAG latency', () => {
    const latency = estimateLatency(1, false);
    expect(latency).toBe(1300); // 1000 + 300
  });

  it('estimates agentic RAG with 2 iterations', () => {
    const latency = estimateLatency(2, true);
    expect(latency).toBe(3100); // (1000+300+500) + (1000+300)
  });

  it('estimates max iterations scenario', () => {
    const latency = estimateLatency(3, true);
    expect(latency).toBeGreaterThan(4000);
    expect(latency).toBeLessThan(6000);
  });

  it('estimates best case (immediate accept)', () => {
    const latency = estimateLatency(1, false);
    expect(latency).toBeLessThan(2000);
  });
});
