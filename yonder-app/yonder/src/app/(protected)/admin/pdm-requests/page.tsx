"use client";

import React, { useState } from "react";
import { trpc } from "@/trpc/client";
import { Card, CardContent } from "@/app/_components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/_components/ui/table";
import { Button } from "@/app/_components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default function AdminPdmRequestsPage() {
  const { data: allRequests, isLoading } =
    trpc.admin.listPdmRequests.useQuery();
  const [tab, setTab] = useState<"all" | "municipalities">("municipalities");

  // Group requests by municipality on client side
  const groupedData = React.useMemo(() => {
    if (!allRequests) return [];

    const groups = allRequests.reduce(
      (acc, request) => {
        const municipalityId = request.municipality.id;
        if (!acc[municipalityId]) {
          acc[municipalityId] = {
            municipalityId,
            municipalityName: request.municipality.name,
            requests: [],
            uniqueUsers: new Set<string>(),
            uniquePlots: new Set<string>(),
          };
        }
        acc[municipalityId].requests.push(request);
        acc[municipalityId].uniqueUsers.add(request.user.id);
        acc[municipalityId].uniquePlots.add(String(request.plotId));
        return acc;
      },
      {} as Record<
        number,
        {
          municipalityId: number;
          municipalityName: string | null;
          requests: typeof allRequests;
          uniqueUsers: Set<string>;
          uniquePlots: Set<string>;
        }
      >
    );

    return Object.values(groups)
      .map((group) => ({
        municipalityId: group.municipalityId,
        municipalityName: group.municipalityName,
        requestsCount: group.requests.length,
        uniqueUsers: group.uniqueUsers.size,
        uniquePlots: group.uniquePlots.size,
      }))
      .sort((a, b) => b.requestsCount - a.requestsCount);
  }, [allRequests]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">PDM Requests</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track and prioritize municipalities
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={tab === "municipalities" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("municipalities")}
        >
          By Municipality
        </Button>
        <Button
          variant={tab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("all")}
        >
          All Requests
        </Button>
      </div>

      {tab === "all" && (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Municipality</TableHead>
                    <TableHead>Plot</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>Loading…</TableCell>
                    </TableRow>
                  ) : (
                    (allRequests || []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.municipality?.name || r.municipality?.id}
                        </TableCell>
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
                        <TableCell>{r.user?.name || r.user?.id}</TableCell>
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
        </>
      )}

      {tab === "municipalities" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Municipality</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Unique Users</TableHead>
                  <TableHead>Unique Plots</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>Loading…</TableCell>
                  </TableRow>
                ) : (
                  groupedData.map((m) => (
                    <TableRow key={m.municipalityId}>
                      <TableCell>
                        {m.municipalityName || m.municipalityId}
                      </TableCell>
                      <TableCell>{m.requestsCount}</TableCell>
                      <TableCell>{m.uniqueUsers}</TableCell>
                      <TableCell>{m.uniquePlots}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/admin/pdm-requests/${m.municipalityId}`}
                          >
                            Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
