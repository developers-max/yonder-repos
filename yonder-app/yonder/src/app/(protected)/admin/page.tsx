'use client';

import Link from 'next/link';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { 
  FolderOpen, 
  Mail,
  CheckCircle,
  Clock,
  TrendingUp,
  Eye,
  HandHeart,
  Home,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/app/_components/ui/button';

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Overview of system activity</p>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Projects',
      value: stats?.totalProjects || 0,
      icon: FolderOpen,
      color: 'text-blue-600',
    },
    {
      title: 'Active Projects',
      value: stats?.activeProjects || 0,
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      title: 'Interested',
      value: stats?.interested || 0,
      icon: Clock,
      color: 'text-blue-500',
    },
    {
      title: 'Outreach Sent',
      value: stats?.outreachSent || 0,
      icon: Mail,
      color: 'text-yellow-600',
    },
    {
      title: 'Realtor Replied',
      value: stats?.realtorReplied || 0,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Viewing Scheduled',
      value: stats?.viewingScheduled || 0,
      icon: Eye,
      color: 'text-purple-600',
    },
    {
      title: 'Offer Made',
      value: stats?.offerMade || 0,
      icon: HandHeart,
      color: 'text-orange-600',
    },
    {
      title: 'Purchased',
      value: stats?.purchased || 0,
      icon: Home,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Overview of system activity</p>
        </div>
        <Link href="/chat">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  {stat.title}
                </span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {stat.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {stats?.outreachSent || 0} outreach emails sent
                  </p>
                  <p className="text-xs text-gray-500">Awaiting realtor responses</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {stats?.viewingScheduled || 0} viewings scheduled
                  </p>
                  <p className="text-xs text-gray-500">Properties ready to visit</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {stats?.purchased || 0} properties purchased
                  </p>
                  <p className="text-xs text-gray-500">Successful acquisitions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/admin/outreach"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Review Outreach</p>
                  <p className="text-xs text-gray-500">Process pending campaigns</p>
                </div>
              </Link>
              
              <Link
                href="/admin/projects"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">View Projects</p>
                  <p className="text-xs text-gray-500">Monitor progress</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
