'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { PlotStatusBadge } from '@/app/_components/ui/plot-status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Skeleton } from '@/app/_components/ui/skeleton';
import { 
  Eye,
  Mail,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

type OutreachStatus = 'interested' | 'outreach_sent' | 'realtor_replied' | 'viewing_scheduled' | 'offer_made' | 'purchased' | 'declined';

export default function AdminOutreachPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | 'all'>('all');

  const { data, isLoading } = trpc.admin.getAllOutreachRequests.useQuery({
    page,
    limit: 25,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const outreachRequests = data?.outreachRequests || [];
  const pagination = data?.pagination;



  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Outreach Requests</h1>
        <p className="text-sm text-gray-600 mt-1">Manage user outreach campaigns</p>
      </div>

      <div className="mb-4 flex items-center space-x-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OutreachStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
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

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Plots</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-6 w-12 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : outreachRequests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <h3 className="font-medium text-gray-900 mb-1">No outreach requests found</h3>
            <p className="text-sm text-gray-600">
              {statusFilter === 'all' 
                ? 'No outreach requests have been submitted yet.' 
                : `No ${statusFilter} outreach requests found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Plots</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outreachRequests.map((request) => {
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.project.name}</div>
                            <div className="text-xs text-gray-500">{request.project.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.user.name}</div>
                            <div className="text-xs text-gray-500">{request.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-900">{request.plotCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <PlotStatusBadge status={request.status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {format(new Date(request.createdAt), 'MMM d')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/projects/${request.project.id}`)}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount} requests
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <span className="text-sm text-gray-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}


    </div>
  );
}
