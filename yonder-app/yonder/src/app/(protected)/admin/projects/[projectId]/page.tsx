'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { PlotStatusBadge } from '@/app/_components/ui/plot-status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Skeleton } from '@/app/_components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/_components/ui/dialog';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { 
  ArrowLeft,
  MapPin,
  User,
  Mail,
  Settings,
  ExternalLink,
  Filter
} from 'lucide-react';

type PlotStatus = 'interested' | 'outreach_sent' | 'realtor_replied' | 'viewing_scheduled' | 'offer_made' | 'purchased' | 'declined';

// Minimal client-side type aligning with admin.getOrganizationPlots response
type AdminOrgPlot = {
  id: string;
  latitude: number;
  longitude: number;
  price: string | number | null;
  size: string | number | null;
  organizationPlotStatus: {
    status: string | null;
    createdAt?: string;
    realtorEmail?: string | null;
    realtorName?: string | null;
  } | null;
};

export default function AdminProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [statusFilter, setStatusFilter] = useState<PlotStatus | 'all'>('all');
  const [selectedPlot, setSelectedPlot] = useState<{id: string, currentStatus: string} | null>(null);
  const [newStatus, setNewStatus] = useState<PlotStatus>('interested');
  const [realtorEmail, setRealtorEmail] = useState('');
  const [realtorName, setRealtorName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: projectDetails, isLoading } = trpc.admin.getOrganizationPlots.useQuery(
    { 
      organizationId: projectId,
      status: statusFilter === 'all' ? undefined : statusFilter
    },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();
  
  const updatePlotStatusMutation = trpc.admin.updatePlotStatus.useMutation({
    onSuccess: () => {
      // Invalidate cache for smoother updates without loading state
      utils.admin.getOrganizationPlots.invalidate({ organizationId: projectId });
      setSelectedPlot(null);
      setRealtorEmail('');
      setRealtorName('');
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error('Failed to update plot status:', error);
    }
  });

  const handleUpdateStatus = () => {
    if (!selectedPlot) return;
    
    updatePlotStatusMutation.mutate({
      organizationId: projectId,
      plotId: selectedPlot.id,
      status: newStatus,
      realtorEmail: realtorEmail || undefined,
      realtorName: realtorName || undefined,
    });
  };



  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center space-x-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Outreach
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <Skeleton className="h-8 w-48" />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-6 w-32 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-28 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>

          <div>
            <Skeleton className="h-6 w-40 mb-3" />
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plot ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-18" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!projectDetails) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Outreach
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="font-medium text-gray-900 mb-1">Project not found</h3>
            <p className="text-sm text-gray-600">The requested project could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Outreach
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-900">{projectDetails?.project?.name || 'Loading...'}</h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Project Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between">
                  <span className="text-gray-500">Project Name:</span>
                  <span className="font-medium text-gray-900">{projectDetails?.project?.name || '-'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-gray-500">Owner:</span>
                  <span className="font-medium text-gray-900">{projectDetails?.user?.name || '-'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-medium text-gray-900 flex items-center">
                    <Mail className="w-3 h-3 mr-1" />
                    {projectDetails?.user?.email || '-'}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-gray-500">Project Slug:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{projectDetails?.project?.slug || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Search Filters
              </h4>
              {projectDetails?.project?.searchFilters && Object.keys(projectDetails.project.searchFilters).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(projectDetails.project.searchFilters).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between text-sm">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                      <span className="font-medium text-gray-900 text-right max-w-[60%]">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">No search filters applied</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Selected Plots ({projectDetails?.plots?.length || 0})
              </h4>
              
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PlotStatus | 'all')}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="outreach_sent">Outreach Sent</SelectItem>
                    <SelectItem value="realtor_replied">Realtor Replied</SelectItem>
                    <SelectItem value="viewing_scheduled">Viewing Scheduled</SelectItem>
                    <SelectItem value="offer_made">Offer Made</SelectItem>
                    <SelectItem value="purchased">Purchased</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plot ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Show loading skeleton rows when plots are loading
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : projectDetails.plots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {statusFilter === 'all' ? 'No plots found.' : `No plots with status "${statusFilter}".`}
                    </TableCell>
                  </TableRow>
                ) : (projectDetails.plots as unknown as AdminOrgPlot[]).map((plot) => {
                  return (
                    <TableRow key={plot.id}>
                      <TableCell className="font-mono text-sm">
                        <a 
                          href={`/plot/${plot.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
                        >
                          <span className="font-mono">{plot.id.slice(0, 8)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {plot.latitude.toFixed(4)}, {plot.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {plot.price ? `€${Number(plot.price).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {plot.size ? `${Number(plot.size).toFixed(2)} acres` : '-'}
                      </TableCell>
                      <TableCell>
                        <PlotStatusBadge 
                          status={plot.organizationPlotStatus?.status || 'interested'} 
                          size="sm" 
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => {
                            setSelectedPlot({
                              id: plot.id, 
                              currentStatus: plot.organizationPlotStatus?.status || 'interested'
                            });
                            setNewStatus(plot.organizationPlotStatus?.status as PlotStatus || 'interested');
                            setRealtorEmail(plot.organizationPlotStatus?.realtorEmail || '');
                            setRealtorName(plot.organizationPlotStatus?.realtorName || '');
                            setIsDialogOpen(true);
                          }}
                        >
                          Update Status
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Single dialog for updating plot status */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Plot Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as PlotStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="outreach_sent">Outreach Sent</SelectItem>
                  <SelectItem value="realtor_replied">Realtor Replied</SelectItem>
                  <SelectItem value="viewing_scheduled">Viewing Scheduled</SelectItem>
                  <SelectItem value="offer_made">Offer Made</SelectItem>
                  <SelectItem value="purchased">Purchased</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="realtorEmail">Realtor Email (optional)</Label>
              <Input
                id="realtorEmail"
                value={realtorEmail}
                onChange={(e) => setRealtorEmail(e.target.value)}
                placeholder="realtor@example.com"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="realtorName">Realtor Name (optional)</Label>
              <Input
                id="realtorName"
                value={realtorName}
                onChange={(e) => setRealtorName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateStatus}
                disabled={updatePlotStatusMutation.isPending}
              >
                {updatePlotStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
