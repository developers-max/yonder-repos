'use client';

import { Badge } from './badge';
import { 
  Clock,
  Mail,
  CheckCircle,
  Eye,
  HandHeart,
  Home,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';

export type PlotStatus = 'interested' | 'outreach_sent' | 'realtor_replied' | 'viewing_scheduled' | 'offer_made' | 'purchased' | 'declined';

interface PlotStatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'interested':
      return {
        color: 'bg-blue-50 text-blue-800 border-blue-200',
        icon: Clock,
        label: 'Interested'
      };
    case 'outreach_sent':
      return {
        color: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        icon: Mail,
        label: 'Outreach Sent'
      };
    case 'realtor_replied':
      return {
        color: 'bg-green-50 text-green-800 border-green-200',
        icon: CheckCircle,
        label: 'Realtor Replied'
      };
    case 'viewing_scheduled':
      return {
        color: 'bg-purple-50 text-purple-800 border-purple-200',
        icon: Eye,
        label: 'Viewing Scheduled'
      };
    case 'offer_made':
      return {
        color: 'bg-orange-50 text-orange-800 border-orange-200',
        icon: HandHeart,
        label: 'Offer Made'
      };
    case 'purchased':
      return {
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: Home,
        label: 'Purchased'
      };
    case 'declined':
      return {
        color: 'bg-red-50 text-red-800 border-red-200',
        icon: X,
        label: 'Declined'
      };
    default:
      return {
        color: 'bg-gray-50 text-gray-800 border-gray-200',
        icon: Clock,
        label: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      };
  }
};

export function PlotStatusBadge({ status, className, showIcon = true, size = 'md' }: PlotStatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5'
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        config.color,
        sizeClasses[size],
        'font-medium border px-1.5',
        className
      )}
    >
      {showIcon && (
        <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
      )}
      {config.label}
    </Badge>
  );
}
