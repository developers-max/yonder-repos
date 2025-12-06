"use client";

import React from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Card, CardContent } from "@/app/_components/ui/card";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/_components/ui/table";

export default function PdmMunicipalityDetailPage() {
  const params = useParams();
  const municipalityId = Number(params.municipalityId);

  return <DetailContent municipalityId={municipalityId} />;
}

function DetailContent({ municipalityId }: { municipalityId: number }) {
  const { data, isLoading } = trpc.admin.getPdmMunicipalityDetails.useQuery({
    municipalityId,
  });

  // Calculate stats on frontend from the data
  const stats = React.useMemo(() => {
    if (!data?.requests)
      return { requestsCount: 0, uniqueUsers: 0, uniquePlots: 0 };

    const uniqueUsers = new Set(data.requests.map((r) => r.userId));
    const uniquePlots = new Set(data.requests.map((r) => r.plotId));

    return {
      requestsCount: data.requests.length,
      uniqueUsers: uniqueUsers.size,
      uniquePlots: uniquePlots.size,
    };
  }, [data?.requests]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {data?.municipalityName || `Municipality ${municipalityId}`}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          PDM request details for this municipality
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">
                  Total Requests
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.requestsCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">
                  Unique Users
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.uniqueUsers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">
                  Unique Plots
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.uniquePlots}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plot</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading…</TableCell>
                </TableRow>
              ) : (
                (data?.requests || []).map((r) => (
                  <TableRow key={r.requestId}>
                    <TableCell className="font-mono text-xs">
                      <a
                        href={`/plot/${r.plotId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
                      >
                        <span>{r.plotId}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {r.organizationId ? (
                        <Link
                          href={`/admin/projects/${r.organizationId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {r.organizationId}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          No project
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.userName || r.userId}</TableCell>
                    <TableCell>
                      {r.createdAt
                        ? new Date(
                            r.createdAt as unknown as string
                          ).toLocaleDateString()
                        : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
