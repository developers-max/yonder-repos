"use client";

import { useCallback, useState } from "react";
import { trpc } from '@/trpc/client';
import { Button } from "@/app/_components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/_components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/_components/ui/table";
import { Loader2, Mail, AlertCircle } from "lucide-react";
import type { AppRouter } from "@/server/trpc";
import type { inferRouterOutputs } from "@trpc/server";

// Types for realtor outreach results
type RouterOutputs = inferRouterOutputs<AppRouter>;
type RealtorOutreachResult = RouterOutputs["projects"]["realtorOutreach"];

export interface RealtorOutreachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: RealtorOutreachResult | null;
  selectedCount: number;
  selectableCount: number;
  emailSubject: string;
  onEmailSubjectChange: (value: string) => void;
  emailBody: string;
  onEmailBodyChange: (value: string) => void;
  rowSelection: Record<string, boolean>;
  onToggleAll: (checked: boolean) => void;
  onRowToggle: (plotId: string, checked: boolean) => void;
  organizationId: string;
  onSend?: () => void; // optional external handler
  sending?: boolean;    // optional external loading flag
}

export function RealtorOutreachModal({
  open,
  onOpenChange,
  previewData,
  selectedCount,
  selectableCount,
  emailSubject,
  onEmailSubjectChange,
  emailBody,
  onEmailBodyChange,
  rowSelection,
  onToggleAll,
  onRowToggle,
  organizationId,
  onSend,
  sending,
}: RealtorOutreachModalProps) {
  const [localSending, setLocalSending] = useState(false);
  const [plotSendingStatus, setPlotSendingStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  
  // tRPC mutations for updating plot status and realtor info
  const markOutreachSent = trpc.projects.markOutreachSent.useMutation();
  const setPlotRealtor = trpc.projects.setPlotRealtor.useMutation();
  const utils = trpc.useUtils();

  const handleInternalSend = useCallback(async () => {
    if (onSend) {
      // Allow parent to handle if provided
      return onSend();
    }

    const leads = (previewData?.results || [])
      .filter(r => rowSelection[r.plotId])
      .map(r => {
        // Use the first available realtor (agency preferred over source)
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
      })
      .filter(lead => lead.email); // Only include leads with email

    if (leads.length === 0) return;

    setLocalSending(true);
    setPlotSendingStatus({});
    
    try {
      const baseUrl = (typeof window !== 'undefined' ? window.location.origin : '');
      let hasErrors = false;
      
      // Group leads by plot ID to create one campaign per plot
      const leadsByPlot = new Map<string, typeof leads>();
      for (const lead of leads) {
        const existing = leadsByPlot.get(lead.plotId) || [];
        leadsByPlot.set(lead.plotId, [...existing, lead]);
      }
      
      // Process each plot's leads using the per-plot campaign endpoint
      for (const [plotId, plotLeads] of leadsByPlot.entries()) {
        try {
          // Mark this plot as sending
          setPlotSendingStatus(prev => ({ ...prev, [plotId]: 'sending' }));
          
          // Format plot URL to avoid spam filters
          const plotUrl = baseUrl 
            ? `${baseUrl}/plot/${plotId}`.replace(/https?:\/\//g, (match) => match.replace(':', '[colon]'))
            : `/plot/${plotId}`;
          
          // Send to per-plot campaign endpoint
          const res = await fetch('/api/smartlead/send-per-plot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plotId,
              organizationId,
              plotData: {
                url: plotUrl,
                // Add other plot data as needed
              },
              leads: plotLeads.map(lead => ({
                email: lead.email,
                firstName: lead.name?.split(' ')[0] || 'Friend',
                lastName: lead.name?.split(' ').slice(1).join(' ') || '',
                customFields: {
                  subject: emailSubject,
                  body: emailBody,
                  plot_url: plotUrl,
                },
              })),
              useSchedule: true,
            }),
          });
          
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `SmartLead send failed: ${res.status}`);
          }
          
          const result = await res.json();
          console.log(`Campaign result for plot ${plotId}:`, result);
          
          // If email sent successfully, update plot status to outreach_sent
          await markOutreachSent.mutateAsync({
            organizationId,
            plotIds: [plotId]
          });
          
          // Store the realtor email for this plot (enables realtor identification on signup)
          const sentLead = plotLeads[0];
          if (sentLead?.email) {
            await setPlotRealtor.mutateAsync({
              organizationId,
              plotId,
              realtorEmail: sentLead.email,
              realtorName: sentLead.name,
            });
          }
          
          // Mark this plot as successfully sent
          setPlotSendingStatus(prev => ({ ...prev, [plotId]: 'sent' }));
        } catch (error) {
          console.error(`Error sending to plot ${plotId}:`, error);
          setPlotSendingStatus(prev => ({ ...prev, [plotId]: 'error' }));
          hasErrors = true;
        }
      }
      
      // Refresh the plots data to show updated statuses
      await utils.projects.getOrganizationPlots.invalidate({ organizationId });
      
      // Only close modal automatically if there were no errors
      if (!hasErrors) {
        setTimeout(() => {
          onOpenChange(false);
          setPlotSendingStatus({});
        }, 1500); // Give user time to see the final status
      }
      
    } finally {
      setLocalSending(false);
    }
  }, [onSend, previewData?.results, rowSelection, emailSubject, emailBody, onOpenChange, organizationId, markOutreachSent, setPlotRealtor, utils]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Realtor Outreach Preview</DialogTitle>
          <DialogDescription>
            Review available contacts for the selected plots. Select which ones to email, customize the subject/body, then send.
          </DialogDescription>
        </DialogHeader>

        {/* Email form */}
        <div className="space-y-4">
          {/* Subject */}
          <div className="grid grid-cols-1 gap-1">
            <label htmlFor="email-subject" className="text-sm font-medium">Subject:</label>
            <input
              id="email-subject"
              type="text"
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Email subject"
              value={emailSubject}
              onChange={(e) => onEmailSubjectChange(e.target.value)}
            />
          </div>
          
          {/* Body */}
          <div className="grid grid-cols-1 gap-1">
            <label htmlFor="email-body" className="text-sm font-medium">Message:</label>
            <textarea
              id="email-body"
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px]"
              placeholder="Email message"
              value={emailBody}
              onChange={(e) => onEmailBodyChange(e.target.value)}
            />
          </div>
        </div>

        {/* Contacts table */}
        <div className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedCount > 0 && selectedCount === selectableCount}
                    onChange={(e) => onToggleAll(e.target.checked)}
                  />
                </TableHead>
                <TableHead>Plot</TableHead>
                <TableHead>Realtor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(previewData?.results || []).map((r) => {
                // Only show the first realtor (matching the one in plot details)
                // Filter for agency or source roles
                const filteredRealtors = (r.suggestedRealtors || []).filter(
                  realtor => realtor.role === 'agency' || realtor.role === 'source'
                );
                
                // Remove duplicates based on company name
                const uniqueCompanies = new Map<string, typeof filteredRealtors[0]>();
                filteredRealtors.forEach(realtor => {
                  const companyKey = realtor.company || realtor.name;
                  if (!uniqueCompanies.has(companyKey) && realtor.email) {
                    uniqueCompanies.set(companyKey, realtor);
                  }
                });
                const uniqueRealtors = Array.from(uniqueCompanies.values());
                
                // Prioritize agencies over sources
                const agencies = uniqueRealtors.filter(r => r.role === 'agency');
                const sources = uniqueRealtors.filter(r => r.role === 'source');
                const realtorOptions = [...agencies, ...sources];
                
                // Only use the first realtor
                const firstRealtor = realtorOptions.length > 0 ? realtorOptions[0] : null;
                const hasOptions = !!firstRealtor;
                const disabled = !hasOptions;
                const checked = !!rowSelection[r.plotId];
                
                return (
                  <TableRow key={r.plotId} className={disabled ? 'opacity-50' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => onRowToggle(r.plotId, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.plotId.slice(0, 8)}</TableCell>
                    <TableCell>
                      {hasOptions && firstRealtor ? (
                        <span className="text-sm">{firstRealtor.company || firstRealtor.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No contacts available</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        const sendingStatus = plotSendingStatus[r.plotId];
                        if (sendingStatus === 'sending') {
                          return <span className="inline-flex items-center gap-1 text-blue-600"><Loader2 className="w-3 h-3 animate-spin" />sending...</span>;
                        }
                        if (sendingStatus === 'sent') {
                          return <span className="inline-flex items-center gap-1 text-green-600">✓ sent</span>;
                        }
                        if (sendingStatus === 'error') {
                          return <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle className="w-3 h-3" />failed</span>;
                        }
                        return r.sent ? 'already sent' : (r.error ? (
                          <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle className="w-3 h-3" />{r.error}</span>
                        ) : (hasOptions ? 'ready' : 'missing contact'));
                      })()} 
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {selectedCount} of {selectableCount} selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleInternalSend} disabled={(sending ?? localSending) || selectedCount === 0}>
              {(sending ?? localSending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email to Selected
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
