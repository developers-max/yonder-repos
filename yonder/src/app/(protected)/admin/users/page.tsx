'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Button } from '@/app/_components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Loader2, Search, Users as UsersIcon } from 'lucide-react';
import { useToast } from '@/app/_components/ui/toast-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/_components/ui/dialog';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'realtor' | 'admin'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    userId: string;
    name: string;
    email: string;
    newRole: 'user' | 'realtor' | 'admin';
  } | null>(null);
  const [chatQueriesDialogOpen, setChatQueriesDialogOpen] = useState(false);
  const [pendingChatQueries, setPendingChatQueries] = useState<{
    userId: string;
    name: string;
    email: string;
    currentQueries: number;
    newQueries: number;
  } | null>(null);
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = trpc.admin.getUsers.useQuery({
    page,
    limit,
    search: search || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
  });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const setUserChatQueries = trpc.admin.setUserChatQueries.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const users = data?.users || [];
  const pagination = data?.pagination;

  const handleRoleChange = (userId: string, role: 'user' | 'realtor' | 'admin') => {
    const u = users.find((x) => x.id === userId);
    setPendingChange({ userId, name: u?.name ?? '', email: u?.email ?? '', newRole: role });
    setConfirmOpen(true);
  };

  const confirmRoleUpdate = () => {
    if (!pendingChange) return;
    setUserRole.mutate(
      { userId: pendingChange.userId, role: pendingChange.newRole },
      {
        onSuccess: () => {
          toast.success(`Updated role to ${pendingChange.newRole}`);
          setConfirmOpen(false);
          setPendingChange(null);
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to update role');
        },
      }
    );
  };

  const handleChatQueriesClick = (userId: string, currentQueries: number) => {
    const u = users.find((x) => x.id === userId);
    setPendingChatQueries({
      userId,
      name: u?.name ?? '',
      email: u?.email ?? '',
      currentQueries,
      newQueries: currentQueries,
    });
    setChatQueriesDialogOpen(true);
  };

  const confirmChatQueriesUpdate = () => {
    if (!pendingChatQueries) return;
    setUserChatQueries.mutate(
      { userId: pendingChatQueries.userId, remainingChatQueries: pendingChatQueries.newQueries },
      {
        onSuccess: () => {
          toast.success(`Updated chat queries to ${pendingChatQueries.newQueries}`);
          setChatQueriesDialogOpen(false);
          setPendingChatQueries(null);
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to update chat queries');
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-gray-500" /> Users
          </h1>
          <p className="text-sm text-gray-600 mt-1">Manage user roles</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by name or email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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

            <div className="ml-auto flex items-center gap-2">
              <Select
                value={roleFilter}
                onValueChange={(val) => {
                  setRoleFilter(val as 'all' | 'user' | 'realtor' | 'admin');
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="realtor">Realtor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Chat Queries</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading users...
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3 text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.role || 'user'}
                          onValueChange={(val) => handleRoleChange(u.id, val as 'user' | 'realtor' | 'admin')}
                          disabled={setUserRole.isPending}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="realtor">Realtor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChatQueriesClick(u.id, u.remainingChatQueries ?? 0)}
                          disabled={setUserChatQueries.isPending}
                          className="font-mono"
                        >
                          {u.remainingChatQueries ?? 0}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {u.createdAt ? new Date(u.createdAt as unknown as string).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              {pendingChange ? (
                <>
                  You are about to change role for
                  {' '}<span className="font-medium text-gray-900">{pendingChange.name || pendingChange.email}</span>
                  {' '}to
                  {' '}<span className="font-medium text-gray-900">{pendingChange.newRole}</span>.
                  This action takes effect immediately.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={setUserRole.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmRoleUpdate} disabled={setUserRole.isPending}>
              {setUserRole.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chatQueriesDialogOpen} onOpenChange={setChatQueriesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update chat queries</DialogTitle>
            <DialogDescription>
              {pendingChatQueries ? (
                <>
                  Set the number of remaining chat queries for
                  {' '}<span className="font-medium text-gray-900">{pendingChatQueries.name || pendingChatQueries.email}</span>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {pendingChatQueries && (
            <div className="py-4">
              <label htmlFor="chatQueries" className="text-sm font-medium text-gray-700 mb-2 block">
                Remaining Chat Queries
              </label>
              <Input
                id="chatQueries"
                type="number"
                min="0"
                value={pendingChatQueries.newQueries}
                onChange={(e) => setPendingChatQueries({
                  ...pendingChatQueries,
                  newQueries: parseInt(e.target.value) || 0,
                })}
                className="w-full"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatQueriesDialogOpen(false)} disabled={setUserChatQueries.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmChatQueriesUpdate} disabled={setUserChatQueries.isPending}>
              {setUserChatQueries.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
