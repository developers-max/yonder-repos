import { describe, it, expect } from 'vitest';

/**
 * Unit tests for RealtorOutreachModal claimed/unclaimed plot separation logic
 * 
 * These tests verify the logic that determines whether a plot should use
 * direct email (via Resend) for claimed plots or SmartLead for unclaimed plots.
 */

// Types matching the modal's expected data structure
interface RealtorOutreachResult {
  plotId: string;
  realtorEmail: string | null;
  realtorName: string | null;
  suggestedRealtors?: Array<{ email: string | null; name: string; company: string; role: string }>;
  sent: boolean;
  error?: string;
  isClaimed: boolean;
  claimedByEmail: string | null;
  claimedByName: string | null;
}

describe('RealtorOutreachModal - Claimed/Unclaimed Plot Separation', () => {
  describe('separateClaimedAndUnclaimedPlots', () => {
    // Helper function that mimics the modal's separation logic
    const separatePlots = (
      results: RealtorOutreachResult[],
      rowSelection: Record<string, boolean>
    ) => {
      const selectedResults = results.filter(r => rowSelection[r.plotId]);
      const claimedPlots = selectedResults.filter(r => r.isClaimed && r.claimedByEmail);
      const unclaimedPlots = selectedResults.filter(r => !r.isClaimed || !r.claimedByEmail);
      return { claimedPlots, unclaimedPlots };
    };

    it('should separate claimed plots from unclaimed plots', () => {
      // Arrange
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor1@example.com',
          claimedByName: 'Realtor One',
          sent: false,
        },
        {
          plotId: 'plot-2',
          realtorEmail: 'agency@example.com',
          realtorName: 'Agency Name',
          suggestedRealtors: [{ email: 'agency@example.com', name: 'Agency', company: 'Agency Inc', role: 'agency' }],
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
      ];
      const rowSelection = { 'plot-1': true, 'plot-2': true };

      // Act
      const { claimedPlots, unclaimedPlots } = separatePlots(results, rowSelection);

      // Assert
      expect(claimedPlots).toHaveLength(1);
      expect(claimedPlots[0].plotId).toBe('plot-1');
      expect(unclaimedPlots).toHaveLength(1);
      expect(unclaimedPlots[0].plotId).toBe('plot-2');
    });

    it('should treat plot as unclaimed if isClaimed is true but claimedByEmail is null', () => {
      // Arrange - Edge case: claimed flag but no email
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: 'suggested@example.com',
          realtorName: 'Suggested Realtor',
          isClaimed: true,
          claimedByEmail: null, // Missing email
          claimedByName: 'Some Name',
          sent: false,
        },
      ];
      const rowSelection = { 'plot-1': true };

      // Act
      const { claimedPlots, unclaimedPlots } = separatePlots(results, rowSelection);

      // Assert - Should be treated as unclaimed since no claimedByEmail
      expect(claimedPlots).toHaveLength(0);
      expect(unclaimedPlots).toHaveLength(1);
    });

    it('should only include selected plots', () => {
      // Arrange
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor1@example.com',
          claimedByName: 'Realtor One',
          sent: false,
        },
        {
          plotId: 'plot-2',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor2@example.com',
          claimedByName: 'Realtor Two',
          sent: false,
        },
      ];
      const rowSelection = { 'plot-1': true, 'plot-2': false }; // Only plot-1 selected

      // Act
      const { claimedPlots, unclaimedPlots } = separatePlots(results, rowSelection);

      // Assert
      expect(claimedPlots).toHaveLength(1);
      expect(claimedPlots[0].plotId).toBe('plot-1');
      expect(unclaimedPlots).toHaveLength(0);
    });

    it('should handle empty selection', () => {
      // Arrange
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor@example.com',
          claimedByName: 'Realtor',
          sent: false,
        },
      ];
      const rowSelection: Record<string, boolean> = {}; // Nothing selected

      // Act
      const { claimedPlots, unclaimedPlots } = separatePlots(results, rowSelection);

      // Assert
      expect(claimedPlots).toHaveLength(0);
      expect(unclaimedPlots).toHaveLength(0);
    });

    it('should handle mixed selection with multiple claimed and unclaimed plots', () => {
      // Arrange
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'claimed-1',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor1@example.com',
          claimedByName: 'Realtor 1',
          sent: false,
        },
        {
          plotId: 'claimed-2',
          realtorEmail: null,
          realtorName: null,
          isClaimed: true,
          claimedByEmail: 'realtor2@example.com',
          claimedByName: 'Realtor 2',
          sent: false,
        },
        {
          plotId: 'unclaimed-1',
          realtorEmail: 'agency1@example.com',
          realtorName: 'Agency 1',
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
        {
          plotId: 'unclaimed-2',
          realtorEmail: 'agency2@example.com',
          realtorName: 'Agency 2',
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
      ];
      const rowSelection = {
        'claimed-1': true,
        'claimed-2': true,
        'unclaimed-1': true,
        'unclaimed-2': false, // Not selected
      };

      // Act
      const { claimedPlots, unclaimedPlots } = separatePlots(results, rowSelection);

      // Assert
      expect(claimedPlots).toHaveLength(2);
      expect(claimedPlots.map(p => p.plotId)).toEqual(['claimed-1', 'claimed-2']);
      expect(unclaimedPlots).toHaveLength(1);
      expect(unclaimedPlots[0].plotId).toBe('unclaimed-1');
    });
  });

  describe('Row enablement logic', () => {
    // Helper function that mimics the modal's row enablement logic
    const isRowEnabled = (result: RealtorOutreachResult) => {
      const isClaimed = !!(result.isClaimed && result.claimedByEmail);
      const suggestedRealtors = result.suggestedRealtors || [];
      const filteredRealtors = suggestedRealtors.filter(
        realtor => (realtor.role === 'agency' || realtor.role === 'source') && realtor.email
      );
      const hasOptions = isClaimed || filteredRealtors.length > 0;
      return hasOptions;
    };

    it('should enable row for claimed plot even without suggested realtors', () => {
      // Arrange
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        suggestedRealtors: [], // No suggested realtors
        isClaimed: true,
        claimedByEmail: 'claimed@example.com',
        claimedByName: 'Claimed Realtor',
        sent: false,
      };

      // Act & Assert
      expect(isRowEnabled(result)).toBe(true);
    });

    it('should enable row for unclaimed plot with suggested realtors', () => {
      // Arrange
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: 'agency@example.com',
        realtorName: 'Agency',
        suggestedRealtors: [
          { email: 'agency@example.com', name: 'Agency', company: 'Agency Inc', role: 'agency' },
        ],
        isClaimed: false,
        claimedByEmail: null,
        claimedByName: null,
        sent: false,
      };

      // Act & Assert
      expect(isRowEnabled(result)).toBe(true);
    });

    it('should disable row for unclaimed plot without suggested realtors', () => {
      // Arrange
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        suggestedRealtors: [],
        isClaimed: false,
        claimedByEmail: null,
        claimedByName: null,
        sent: false,
      };

      // Act & Assert
      expect(isRowEnabled(result)).toBe(false);
    });

    it('should disable row for claimed plot without claimedByEmail', () => {
      // Arrange
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        suggestedRealtors: [],
        isClaimed: true,
        claimedByEmail: null, // Missing email
        claimedByName: 'Name Only',
        sent: false,
      };

      // Act & Assert
      expect(isRowEnabled(result)).toBe(false);
    });

    it('should only consider agency and source roles for suggested realtors', () => {
      // Arrange
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        suggestedRealtors: [
          { email: 'owner@example.com', name: 'Owner', company: 'Private', role: 'owner' },
          { email: 'other@example.com', name: 'Other', company: 'Other', role: 'other' },
        ],
        isClaimed: false,
        claimedByEmail: null,
        claimedByName: null,
        sent: false,
      };

      // Act & Assert - Should be disabled because no agency/source roles
      expect(isRowEnabled(result)).toBe(false);
    });
  });

  describe('Status display logic', () => {
    const getStatusText = (result: RealtorOutreachResult, sendingStatus?: 'sending' | 'sent' | 'error') => {
      const isClaimed = result.isClaimed && result.claimedByEmail;
      const hasOptions = isClaimed || (result.suggestedRealtors || []).some(
        r => (r.role === 'agency' || r.role === 'source') && r.email
      );

      if (sendingStatus === 'sending') return 'sending...';
      if (sendingStatus === 'sent') return '✓ sent';
      if (sendingStatus === 'error') return 'failed';
      if (result.sent) return 'already sent';
      if (result.error) return result.error;
      if (hasOptions) return isClaimed ? 'direct email' : 'ready';
      return 'missing contact';
    };

    it('should show "direct email" for claimed plots', () => {
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        isClaimed: true,
        claimedByEmail: 'realtor@example.com',
        claimedByName: 'Realtor',
        sent: false,
      };

      expect(getStatusText(result)).toBe('direct email');
    });

    it('should show "ready" for unclaimed plots with contacts', () => {
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: 'agency@example.com',
        realtorName: 'Agency',
        suggestedRealtors: [
          { email: 'agency@example.com', name: 'Agency', company: 'Agency Inc', role: 'agency' },
        ],
        isClaimed: false,
        claimedByEmail: null,
        claimedByName: null,
        sent: false,
      };

      expect(getStatusText(result)).toBe('ready');
    });

    it('should show "missing contact" for plots without options', () => {
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        suggestedRealtors: [],
        isClaimed: false,
        claimedByEmail: null,
        claimedByName: null,
        sent: false,
      };

      expect(getStatusText(result)).toBe('missing contact');
    });

    it('should show sending states correctly', () => {
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: null,
        realtorName: null,
        isClaimed: true,
        claimedByEmail: 'realtor@example.com',
        claimedByName: 'Realtor',
        sent: false,
      };

      expect(getStatusText(result, 'sending')).toBe('sending...');
      expect(getStatusText(result, 'sent')).toBe('✓ sent');
      expect(getStatusText(result, 'error')).toBe('failed');
    });

    it('should show "already sent" for previously sent plots', () => {
      const result: RealtorOutreachResult = {
        plotId: 'plot-1',
        realtorEmail: 'realtor@example.com',
        realtorName: 'Realtor',
        isClaimed: true,
        claimedByEmail: 'realtor@example.com',
        claimedByName: 'Realtor',
        sent: true,
      };

      expect(getStatusText(result)).toBe('already sent');
    });
  });

  describe('Lead extraction for unclaimed plots', () => {
    const extractLeadsFromUnclaimed = (results: RealtorOutreachResult[]) => {
      return results.map(r => {
        const filteredRealtors = (r.suggestedRealtors || []).filter(
          realtor => realtor.role === 'agency' || realtor.role === 'source'
        );

        const uniqueCompanies = new Map<string, typeof filteredRealtors[0]>();
        filteredRealtors.forEach(realtor => {
          const companyKey = realtor.company || realtor.name;
          if (!uniqueCompanies.has(companyKey) && realtor.email) {
            uniqueCompanies.set(companyKey, realtor);
          }
        });
        const uniqueRealtors = Array.from(uniqueCompanies.values());

        const agencies = uniqueRealtors.filter(r => r.role === 'agency');
        const sources = uniqueRealtors.filter(r => r.role === 'source');
        const realtorOptions = [...agencies, ...sources];

        const firstRealtor = realtorOptions.length > 0 ? realtorOptions[0] : null;

        return {
          plotId: r.plotId,
          email: firstRealtor?.email || r.realtorEmail || '',
          name: firstRealtor?.name || r.realtorName || undefined,
        };
      }).filter(lead => lead.email);
    };

    it('should prioritize agencies over sources', () => {
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          suggestedRealtors: [
            { email: 'source@example.com', name: 'Source', company: 'Source Co', role: 'source' },
            { email: 'agency@example.com', name: 'Agency', company: 'Agency Co', role: 'agency' },
          ],
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
      ];

      const leads = extractLeadsFromUnclaimed(results);

      expect(leads).toHaveLength(1);
      expect(leads[0].email).toBe('agency@example.com');
    });

    it('should deduplicate by company name', () => {
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          suggestedRealtors: [
            { email: 'agent1@agency.com', name: 'Agent 1', company: 'Same Agency', role: 'agency' },
            { email: 'agent2@agency.com', name: 'Agent 2', company: 'Same Agency', role: 'agency' },
          ],
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
      ];

      const leads = extractLeadsFromUnclaimed(results);

      expect(leads).toHaveLength(1);
      expect(leads[0].email).toBe('agent1@agency.com'); // First one wins
    });

    it('should filter out realtors without email', () => {
      const results: RealtorOutreachResult[] = [
        {
          plotId: 'plot-1',
          realtorEmail: null,
          realtorName: null,
          suggestedRealtors: [
            { email: null, name: 'No Email', company: 'Company 1', role: 'agency' },
            { email: 'has@email.com', name: 'Has Email', company: 'Company 2', role: 'agency' },
          ],
          isClaimed: false,
          claimedByEmail: null,
          claimedByName: null,
          sent: false,
        },
      ];

      const leads = extractLeadsFromUnclaimed(results);

      expect(leads).toHaveLength(1);
      expect(leads[0].email).toBe('has@email.com');
    });
  });
});
