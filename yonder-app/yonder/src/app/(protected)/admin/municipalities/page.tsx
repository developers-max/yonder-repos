'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Button } from '@/app/_components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/_components/ui/dialog';
import { Label } from '@/app/_components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/_components/ui/tooltip';
import { 
  Loader2, 
  Landmark, 
  Search, 
  Globe2, 
  Plus, 
  FileText, 
  ExternalLink,
  Trash2,
  Link as LinkIcon,
  Pencil,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bot
} from 'lucide-react';

type PDMDocument = {
  id: string;
  title: string;
  description: string;
  url: string;
  summary: string;
  documentType: 'pdm' | 'regulamento' | 'plano_pormenor';
};

type Municipality = {
  id: number;
  name: string;
  district: string | null;
  country: string | null;
  website: string | null;
  pdmDocuments?: { documents: PDMDocument[]; lastUpdated: string } | null;
  isParish: boolean | null;
  parentMunicipalityName: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export default function AdminMunicipalitiesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string>('');
  const [parishesOnly, setParishesOnly] = useState(false);
  const [parentMunicipalitySearch, setParentMunicipalitySearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [processForRag, setProcessForRag] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processingMessage, setProcessingMessage] = useState('');
  const [refreshingMunicipalityId, setRefreshingMunicipalityId] = useState<number | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<{[key: number]: {status: 'idle' | 'refreshing' | 'success' | 'error', message?: string}}>({});
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<Set<number>>(new Set());
  const [batchRefreshing, setBatchRefreshing] = useState(false);
  const limit = 20;

  const refreshPdmMutation = trpc.admin.refreshMunicipalityPdm.useMutation();

  const { data: countries } = trpc.admin.getMunicipalityCountries.useQuery();
  
  const { data, isLoading, refetch } = trpc.admin.getMunicipalities.useQuery({
    page,
    limit,
    search: search || undefined,
    country: country || undefined,
    parishesOnly: parishesOnly || undefined,
    parentMunicipalitySearch: parentMunicipalitySearch || undefined,
  });

  const addDocMutation = trpc.admin.updateMunicipalityPdm.useMutation({
    onSuccess: (data) => {
      if (data.updatedParishCount && data.updatedParishCount > 0) {
        setProcessingStatus('success');
        setProcessingMessage(`PDM updated! Also updated ${data.updatedParishCount} parish${data.updatedParishCount > 1 ? 'es' : ''}.`);
      }
      refetch();
      if (!processForRag) {
        setTimeout(() => resetForm(), 2000);
      }
    },
  });

  const removeDocMutation = trpc.admin.removeMunicipalityPdmDocument.useMutation({
    onSuccess: (data) => {
      if (data.updatedParishCount && data.updatedParishCount > 0) {
        alert(`Document removed! Also removed from ${data.updatedParishCount} parish${data.updatedParishCount > 1 ? 'es' : ''}.`);
      }
      refetch();
    },
  });

  const processPdmMutation = trpc.admin.processPdmDocument.useMutation({
    onSuccess: (data) => {
      setProcessingStatus('success');
      setProcessingMessage(`Processed in ${data.processingTime}s. Ready for queries: ${data.readyForQueries ? 'Yes' : 'No'}`);
      refetch();
    },
    onError: (error) => {
      setProcessingStatus('error');
      setProcessingMessage(error.message);
    },
  });

  const municipalities = data?.municipalities || [];
  const pagination = data?.pagination;

  function resetForm() {
    setNewDocTitle('');
    setNewDocUrl('');
    setNewDocDescription('');
    setEditingDocId(null);
    setProcessForRag(true);
    setProcessingStatus('idle');
    setProcessingMessage('');
    setDialogOpen(false);
    setSelectedMunicipality(null);
  }

  function openAddDocDialog(municipality: Municipality) {
    setEditingDocId(null);
    setNewDocTitle('');
    setNewDocUrl('');
    setNewDocDescription('');
    setSelectedMunicipality(municipality);
    setDialogOpen(true);
  }

  function openEditDocDialog(municipality: Municipality, doc: PDMDocument) {
    setEditingDocId(doc.id);
    setNewDocTitle(doc.title);
    setNewDocUrl(doc.url);
    setNewDocDescription(doc.description || '');
    setSelectedMunicipality(municipality);
    setDialogOpen(true);
  }

  function triggerRagProcessing(municipalityId: number, pdmUrl: string) {
    if (!processForRag) return;
    
    setProcessingStatus('processing');
    setProcessingMessage('Processing document for RAG...');
    
    processPdmMutation.mutate({
      municipalityId,
      pdmUrl,
      forceRefresh: true,
      generateEmbeddings: true,
    });
  }

  function handleSaveDocument() {
    if (!selectedMunicipality || !newDocTitle || !newDocUrl) return;
    
    const municipalityId = selectedMunicipality.id;
    const pdmUrl = newDocUrl;
    
    if (editingDocId) {
      // Remove old and add new (update)
      removeDocMutation.mutate(
        { municipalityId, documentId: editingDocId },
        {
          onSuccess: () => {
            addDocMutation.mutate(
              {
                municipalityId,
                pdmDocument: {
                  title: newDocTitle,
                  url: pdmUrl,
                  description: newDocDescription,
                  documentType: 'pdm',
                },
              },
              {
                onSuccess: () => {
                  triggerRagProcessing(municipalityId, pdmUrl);
                },
              }
            );
          },
        }
      );
    } else {
      addDocMutation.mutate(
        {
          municipalityId,
          pdmDocument: {
            title: newDocTitle,
            url: pdmUrl,
            description: newDocDescription,
            documentType: 'pdm',
          },
        },
        {
          onSuccess: () => {
            triggerRagProcessing(municipalityId, pdmUrl);
          },
        }
      );
    }
  }

  function handleRemoveDocument(municipalityId: number, documentId: string) {
    if (confirm('Are you sure you want to remove this document?')) {
      removeDocMutation.mutate({ municipalityId, documentId });
    }
  }

  async function handleRefreshPdm(municipalityId: number, municipalityName: string) {
    setRefreshingMunicipalityId(municipalityId);
    setRefreshProgress(prev => ({
      ...prev,
      [municipalityId]: { status: 'refreshing', message: 'Searching for PDM documents...' }
    }));

    try {
      const result = await refreshPdmMutation.mutateAsync({
        municipalityId,
        maxIterations: 3,
        confidenceThreshold: 0.80
      });

      if (result.databaseUpdated && result.bestPdmUrl) {
        setRefreshProgress(prev => ({
          ...prev,
          [municipalityId]: { 
            status: 'success', 
            message: `Found PDM with ${(result.confidenceScore * 100).toFixed(0)}% confidence` 
          }
        }));
        // Refetch to show updated PDM URL
        refetch();
      } else {
        setRefreshProgress(prev => ({
          ...prev,
          [municipalityId]: { 
            status: 'error', 
            message: result.error || `No PDM found (confidence: ${(result.confidenceScore * 100).toFixed(0)}%)` 
          }
        }));
      }
    } catch (error) {
      setRefreshProgress(prev => ({
        ...prev,
        [municipalityId]: { 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Failed to refresh PDM' 
        }
      }));
    } finally {
      setRefreshingMunicipalityId(null);
      // Clear status after 5 seconds
      setTimeout(() => {
        setRefreshProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[municipalityId];
          return newProgress;
        });
      }, 5000);
    }
  }

  async function handleBatchRefreshPdm() {
    if (selectedMunicipalities.size === 0) return;
    
    setBatchRefreshing(true);
    const municipalityIds = Array.from(selectedMunicipalities);
    
    for (const municipalityId of municipalityIds) {
      const municipality = municipalities.find(m => m.id === municipalityId);
      if (!municipality) continue;
      
      setRefreshProgress(prev => ({
        ...prev,
        [municipalityId]: { status: 'refreshing', message: 'Searching...' }
      }));
      
      try {
        const result = await refreshPdmMutation.mutateAsync({
          municipalityId,
          maxIterations: 2, // Use fewer iterations for batch
          confidenceThreshold: 0.70 // Lower threshold for batch
        });
        
        if (result.databaseUpdated && result.bestPdmUrl) {
          setRefreshProgress(prev => ({
            ...prev,
            [municipalityId]: { 
              status: 'success', 
              message: `Found (${(result.confidenceScore * 100).toFixed(0)}%)` 
            }
          }));
        } else {
          setRefreshProgress(prev => ({
            ...prev,
            [municipalityId]: { 
              status: 'error', 
              message: 'Not found' 
            }
          }));
        }
      } catch (error) {
        setRefreshProgress(prev => ({
          ...prev,
          [municipalityId]: { 
            status: 'error', 
            message: 'Failed' 
          }
        }));
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    setBatchRefreshing(false);
    setSelectedMunicipalities(new Set());
    refetch();
    
    // Clear all status after 10 seconds
    setTimeout(() => {
      setRefreshProgress({});
    }, 10000);
  }

  const docTypeLabels = {
    pdm: 'PDM',
    regulamento: 'Regulation',
    plano_pormenor: 'Detailed Plan',
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-gray-500" /> Municipalities
          </h1>
          <p className="text-sm text-gray-600 mt-1">Manage municipality PDM documents and websites</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search by ID, name, or district..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <Select 
                  value={country} 
                  onValueChange={(value) => {
                    setCountry(value === 'all' ? '' : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <Globe2 className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {countries?.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === 'PT' ? '🇵🇹 Portugal' : c === 'ES' ? '🇪🇸 Spain' : c === 'DE' ? '🇩🇪 Germany' : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>

              {selectedMunicipalities.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedMunicipalities.size} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={handleBatchRefreshPdm}
                    disabled={batchRefreshing}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {batchRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2" />
                        Batch Refresh PDM
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedMunicipalities(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>

            {/* Parish Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                <input
                  type="checkbox"
                  id="parishesOnly"
                  checked={parishesOnly}
                  onChange={(e) => {
                    setParishesOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="parishesOnly" className="text-sm font-medium text-purple-900 cursor-pointer">
                  Show parishes only
                </label>
              </div>

              {parishesOnly && (
                <div className="relative w-full max-w-xs">
                  <Search className="w-4 h-4 text-purple-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Filter by parent municipality..."
                    className="pl-8 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    value={parentMunicipalitySearch}
                    onChange={(e) => {
                      setParentMunicipalitySearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              )}

              {(parishesOnly || parentMunicipalitySearch) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParishesOnly(false);
                    setParentMunicipalitySearch('');
                    setPage(1);
                  }}
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                >
                  Clear parish filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
              <div className="text-sm text-gray-900 font-medium">
                Total {pagination.totalCount} municipalit{pagination.totalCount === 1 ? 'y' : 'ies'}
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={selectedMunicipalities.size === municipalities.length && municipalities.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMunicipalities(new Set(municipalities.map(m => m.id)));
                      } else {
                        setSelectedMunicipalities(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </TableHead>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[100px]">District</TableHead>
                <TableHead className="w-[60px] text-center">Country</TableHead>
                <TableHead className="w-[160px]">Website</TableHead>
                <TableHead>PDM Document</TableHead>
                <TableHead className="w-[120px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading municipalities...
                    </div>
                  </TableCell>
                </TableRow>
              ) : municipalities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No municipalities found
                  </TableCell>
                </TableRow>
              ) : (
                municipalities.map((m) => (
                  <TableRow key={m.id} className="border-t">
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedMunicipalities.has(m.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedMunicipalities);
                          if (e.target.checked) {
                            newSelected.add(m.id);
                          } else {
                            newSelected.delete(m.id);
                          }
                          setSelectedMunicipalities(newSelected);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{m.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[200px]">
                        <div className="text-gray-900 font-medium text-sm truncate" title={m.name}>{m.name}</div>
                        {m.isParish && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                              Parish
                            </span>
                            {m.parentMunicipalityName && (
                              <span className="text-xs text-gray-500 truncate" title={`of ${m.parentMunicipalityName}`}>of {m.parentMunicipalityName}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">{m.district || <span className="text-gray-400">-</span>}</TableCell>
                    <TableCell className="text-center">
                      {m.country === 'PT' ? '🇵🇹' : m.country === 'ES' ? '🇪🇸' : m.country === 'DE' ? '🇩🇪' : m.country || '-'}
                    </TableCell>
                    <TableCell>
                      {m.website ? (
                        <a
                          href={m.website.startsWith('http') ? m.website : `https://${m.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{m.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">No website</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const pdmDoc = m.pdmDocuments?.documents?.find((doc: PDMDocument) => doc.documentType === 'pdm');
                        if (pdmDoc) {
                          return (
                            <div className="flex items-center gap-1.5 text-sm">
                              <FileText className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              <a
                                href={pdmDoc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-[180px]"
                                title={pdmDoc.title}
                              >
                                {pdmDoc.title}
                              </a>
                              <ExternalLink className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            </div>
                          );
                        }
                        return <span className="text-gray-400 text-sm italic">Not set</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(() => {
                          const pdmDoc = m.pdmDocuments?.documents?.find((doc: PDMDocument) => doc.documentType === 'pdm');
                          const progress = refreshProgress[m.id];
                          
                          if (progress) {
                            return (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                progress.status === 'refreshing' ? 'bg-blue-50 text-blue-700' :
                                progress.status === 'success' ? 'bg-green-50 text-green-700' :
                                'bg-red-50 text-red-700'
                              }`}>
                                {progress.status === 'refreshing' && <Loader2 className="w-3 h-3 animate-spin" />}
                                {progress.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                                {progress.status === 'error' && <AlertCircle className="w-3 h-3" />}
                                <span className="max-w-[100px] truncate">{progress.message}</span>
                              </div>
                            );
                          }
                          
                          return (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 px-2 text-blue-600" 
                                      onClick={() => handleRefreshPdm(m.id, m.name)}
                                      disabled={refreshingMunicipalityId === m.id}
                                    >
                                      {refreshingMunicipalityId === m.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Bot className="w-3 h-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Auto-discover PDM document using AI</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {pdmDoc ? (
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEditDocDialog(m, pdmDoc)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" onClick={() => openAddDocDialog(m)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>
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

      {/* Add/Edit PDM Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDocId ? 'Edit' : 'Add'} PDM Document</DialogTitle>
            <DialogDescription>
              {editingDocId ? 'Update' : 'Add'} the main PDM regulation document for <strong>{selectedMunicipality?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="docTitle">Title *</Label>
              <Input
                id="docTitle"
                placeholder="e.g., PDM de Lisboa 2024"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="docUrl">Document URL *</Label>
              <Input
                id="docUrl"
                placeholder="https://..."
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="docDescription">Description (optional)</Label>
              <Input
                id="docDescription"
                placeholder="Brief description of the document"
                value={newDocDescription}
                onChange={(e) => setNewDocDescription(e.target.value)}
              />
            </div>

            {/* RAG Processing Option */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <input
                type="checkbox"
                id="processForRag"
                checked={processForRag}
                onChange={(e) => setProcessForRag(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="processForRag" className="text-sm font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  Process for AI/RAG
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Convert PDF to JSON and generate embeddings for AI queries
                </p>
              </div>
            </div>

            {/* Processing Status */}
            {processingStatus !== 'idle' && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                processingStatus === 'processing' ? 'bg-blue-50 border-blue-200' :
                processingStatus === 'success' ? 'bg-green-50 border-green-200' :
                'bg-red-50 border-red-200'
              }`}>
                {processingStatus === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                {processingStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {processingStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                <span className={`text-sm ${
                  processingStatus === 'processing' ? 'text-blue-700' :
                  processingStatus === 'success' ? 'text-green-700' :
                  'text-red-700'
                }`}>
                  {processingMessage}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDocument} 
              disabled={!newDocTitle || !newDocUrl || addDocMutation.isPending || removeDocMutation.isPending}
            >
              {(addDocMutation.isPending || removeDocMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {editingDocId ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingDocId ? 'Update' : 'Add'} Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
