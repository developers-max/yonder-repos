'use client';

import { trpc } from '@/trpc/client';
import { Button } from '@/app/_components/ui/button';
import { X, MapPin, Square } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
// no router types needed here; we'll use a local type guard

interface PlotContextIndicatorProps {
  plotId: string;
  onDismiss: () => void;
}

export default function PlotContextIndicator({ plotId, onDismiss }: PlotContextIndicatorProps) {
  const { data: plot, isLoading } = trpc.plots.getPlot.useQuery({ id: plotId });
  const [isHovered, setIsHovered] = useState(false);

  // Safely extract images without using any or relying on router type inference
  const toStringArray = (val: unknown): string[] =>
    Array.isArray(val) ? val.filter((x): x is string => typeof x === 'string') : [];
  const extractImages = (v: unknown): string[] => {
    if (v && typeof v === 'object' && 'images' in v) {
      const imgs = (v as { images?: unknown }).images;
      return toStringArray(imgs);
    }
    return [];
  };
  const images: string[] = extractImages(plot);

  if (isLoading) {
    return (
      <div className="w-10 h-10 bg-muted animate-pulse rounded-lg"></div>
    );
  }

  if (!plot) {
    return null;
  }

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Small plot thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/30 bg-muted cursor-pointer">
        {images && images.length > 0 ? (
          <div className="relative w-full h-full">
            <Image 
              fill
              quality={100}
              unoptimized
              src={images[0]} 
              alt="Plot context"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        {/* Small indicator dot */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
      </div>

      {/* Hover tooltip */}
      {isHovered && (
        <>
          {/* Invisible bridge to prevent hover loss */}
          <div 
            className="absolute bottom-0 left-0 w-full h-2 z-40"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
          <div 
            className="absolute bottom-full left-0 mb-1 w-80 bg-background border border-border rounded-lg shadow-lg p-3 z-50"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                {images && images.length > 0 ? (
                  <div className="relative w-full h-full">
                    <Image 
                      fill
                      quality={100}
                      unoptimized
                      src={images[0]} 
                      alt="Plot image"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Square className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Including plot context</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  €{plot.price.toLocaleString()} • {plot.size ? plot.size.toLocaleString() + 'm²' : 'Size N/A'}
                  {'latitude' in plot && 'longitude' in plot &&
                   typeof (plot as { latitude?: unknown }).latitude === 'number' &&
                   typeof (plot as { longitude?: unknown }).longitude === 'number' && (
                    <span className="block mt-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {(plot as { latitude: number }).latitude.toFixed(3)}, {(plot as { longitude: number }).longitude.toFixed(3)}
                    </span>
                  )}
                </div>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }} 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 