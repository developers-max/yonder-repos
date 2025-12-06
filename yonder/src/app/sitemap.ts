import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://liveyonder.com';
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
  
  // TODO: Add dynamic plot pages if they become public
  // const plots = await fetchPublicPlots();
  // const plotPages = plots.map((plot) => ({
  //   url: `${baseUrl}/plot/${plot.id}`,
  //   lastModified: plot.updatedAt,
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.8,
  // }));
  
  return [...staticPages];
}
