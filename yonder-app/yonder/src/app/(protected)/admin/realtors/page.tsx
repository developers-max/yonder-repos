'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Button } from '@/app/_components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Loader2, Building2, Search, Globe2, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/_components/ui/dialog';

export default function AdminRealtorsPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<{ company: string; realtorEmail?: string; emailDomain?: string } | null>(null);
  const [sortBy, setSortBy] = useState<'company_name' | 'plot_count'>('company_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isExporting, setIsExporting] = useState(false);
  const limit = 20;

  const { data: countriesData } = trpc.admin.getRealtorCountries.useQuery();

  const exportQuery = trpc.admin.exportRealtors.useQuery(
    { search: search || undefined, country: country || undefined },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data?.realtors) {
        const rows = result.data.realtors;
        const headers = ['ID', 'Company Name', 'Country', 'Website', 'Email', 'Telephone', 'Plot Count'];
        const csvContent = [
          headers.join(','),
          ...rows.map((r) => [
            r.id,
            `"${(r.company_name || '').replace(/"/g, '""')}"`,
            `"${(r.country || '').replace(/"/g, '""')}"`,
            `"${(r.website_url || '').replace(/"/g, '""')}"`,
            `"${(r.email || '').replace(/"/g, '""')}"`,
            `"${(r.telephone || '').replace(/"/g, '""')}"`,
            r.plot_count,
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = country ? `realtors-${country}-${new Date().toISOString().split('T')[0]}.csv` : `realtors-${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading, isRefetching, refetch } = trpc.admin.getRealtors.useQuery({
    page,
    limit,
    search: search || undefined,
    country: country || undefined,
    sortBy,
    sortOrder,
  });

  const realtors = data?.realtors || [];
  const pagination = data?.pagination;

  function extractDomainFromWebsite(website?: string | null): string | undefined {
    if (!website) return undefined;
    try {
      const url = website.startsWith('http') ? new URL(website) : new URL(`https://${website}`);
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return undefined;
    }
  }

  function openRealtorPanel(r: { company_name: string; email: string | null; website_url: string }) {
    const email = (r.email || '').includes('@') ? r.email || undefined : undefined;
    const emailDomain = email ? email.split('@')[1]?.toLowerCase() : extractDomainFromWebsite(r.website_url);
    setSelected({ company: r.company_name, realtorEmail: email, emailDomain });
    setPanelOpen(true);
  }

  const panelQuery = trpc.admin.getRealtorAssignedOutreach.useQuery(
    {
      realtorEmail: selected?.realtorEmail,
      emailDomain: selected?.realtorEmail ? undefined : selected?.emailDomain,
      page: 1,
      limit: 20,
    },
    { enabled: panelOpen && !!selected }
  );

  type PanelItem = {
    project: { id: string; name: string };
    plot: { id: string; price: string | null; size: string | null };
    organizationPlot: { status: string };
  };
  const panelItems: PanelItem[] = ((panelQuery.data?.items ?? []) as unknown) as PanelItem[];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" /> Realtors
          </h1>
          <p className="text-sm text-gray-600 mt-1">All realtor companies and their contact details</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search company, email, phone, website..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={country || 'all'}
              onValueChange={(value) => {
                setCountry(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full max-w-xs">
                <Globe2 className="w-4 h-4 text-gray-400 mr-2" />
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countriesData?.countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                refetch();
              }}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
              <div className="text-sm text-gray-900 font-medium">
                Total {pagination.totalCount} realtor{pagination.totalCount === 1 ? '' : 's'}
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => {
                    if (sortBy === 'company_name') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('company_name');
                      setSortOrder('asc');
                    }
                    setPage(1);
                  }}
                >
                  <div className="flex items-center gap-1">
                    Company
                    {sortBy === 'company_name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telephone</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => {
                    if (sortBy === 'plot_count') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('plot_count');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                >
                  <div className="flex items-center gap-1">
                    # Plots
                    {sortBy === 'plot_count' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading realtors...
                    </div>
                  </TableCell>
                </TableRow>
              ) : realtors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No realtor companies found
                  </TableCell>
                </TableRow>
              ) : (
                realtors.map((r) => (
                  <TableRow key={r.id} className="border-t">
                    <TableCell className="text-gray-900">{r.company_name}</TableCell>
                    <TableCell className="text-gray-700">{r.country}</TableCell>
                    <TableCell>
                      {r.website_url ? (
                        <a
                          href={r.website_url.startsWith('http') ? r.website_url : `https://${r.website_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {r.website_url}
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-700">{r.email || <span className="text-gray-400">-</span>}</TableCell>
                    <TableCell className="text-gray-700">{r.telephone || <span className="text-gray-400">-</span>}</TableCell>
                    <TableCell className="text-gray-700 font-medium">
                      {r.plot_count > 0 ? r.plot_count.toLocaleString() : <span className="text-gray-400">0</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openRealtorPanel(r)}>
                        Open Realtor Panel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination && (
            <div className="flex items-center justify-between border-t p-3 text-sm text-gray-600">
              <div>
                Page {pagination.page} of {pagination.totalPages || 1}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Realtor Panel Modal */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="min-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Realtor Panel</DialogTitle>
            <DialogDescription>
              {selected?.company}
              {selected?.realtorEmail ? ` • ${selected.realtorEmail}` : selected?.emailDomain ? ` • @${selected.emailDomain}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-1 space-y-3">
            {panelQuery.isLoading ? (
              [...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))
            ) : panelItems.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-gray-600">No assigned outreach for this realtor.</CardContent>
              </Card>
            ) : (
              panelItems.map(({ project, plot, organizationPlot }) => (
                <Card key={`${project.id}-${plot.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-gray-900 font-medium">{project.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          Status: <span className="font-medium text-gray-900">{organizationPlot.status}</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        {plot.price !== null ? (
                          <div className="font-semibold text-gray-900">€{Number(plot.price).toLocaleString()}</div>
                        ) : null}
                        {plot.size !== null ? <div>{Number(plot.size)} m²</div> : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
