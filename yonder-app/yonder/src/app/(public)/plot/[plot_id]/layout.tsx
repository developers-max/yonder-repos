import type { Metadata } from 'next';
import { appRouter } from '@/server/trpc/index';
 

interface PlotLayoutProps {
  children: React.ReactNode;
  params: Promise<{ plot_id: string }>;
}

export async function generateMetadata({ params }: PlotLayoutProps): Promise<Metadata> {
  try {
    const { plot_id } = await params;
    const caller = appRouter.createCaller({ session: null, user: undefined });
    const plotRaw = await caller.plots.getPlot({ id: plot_id });
    type PlotMeta = {
      id: string;
      latitude: number;
      longitude: number;
      price: number;
      size: number | null;
      images: string[];
    };
    const plot = plotRaw as PlotMeta;
    
    if (!plot) {
      return {
        title: 'Plot Not Found',
        description: 'The requested plot could not be found.',
      };
    }

    const price = plot.price.toLocaleString();
    const size = plot.size ? `${plot.size.toLocaleString()}m²` : 'Size TBD';
    const pricePerSqm = plot.size ? `€${Math.round(plot.price / plot.size)}/m²` : '';
    
    const title = `€${price} Plot - ${size}`;
    const lat = Number(plot.latitude);
    const lng = Number(plot.longitude);
    const description = `Beautiful plot for sale at €${price}${plot.size ? ` (${pricePerSqm})` : ''}. Located at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}.`;
    
    const ogImage = plot.images && plot.images.length > 0 ? plot.images[0] : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        ...(ogImage && {
          images: [
            {
              url: ogImage,
              width: 1200,
              height: 900,
              alt: `Plot ${plot.id}`,
            },
          ],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(ogImage && {
          images: [ogImage],
        }),
      },
    };
  } catch (error) {
    console.error('Error generating metadata for plot:', error);
    return {
      title: 'Plot Details',
      description: 'View plot details and information.',
    };
  }
}

export default function PlotLayout({ children }: PlotLayoutProps) {
  return <>{children}</>;
} 