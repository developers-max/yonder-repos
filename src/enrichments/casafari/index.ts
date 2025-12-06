import axios from "axios";

export async function searchCasafariProperties(payload: any, query?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }): Promise<any> {
  const baseUrl = (process.env.CASAFARI_API_BASE_URL || 'https://api.casafari.com').replace(/\/+$/, '');
  const endpointPath = `/api/v1/properties/search`;
  const url = `${baseUrl}${endpointPath}`;

  const rawAuth = process.env.CASAFARI_AUTH || process.env.CASAFARI_API_TOKEN;
  if (!rawAuth) {
    throw new Error('Missing Casafari auth. Set CASAFARI_AUTH (e.g., "Bearer <token>" or "Basic <token>") or CASAFARI_API_TOKEN.');
  }
  const authorization = rawAuth.startsWith('Bearer ') || rawAuth.startsWith('Basic ') || rawAuth.startsWith('Token ')
    ? rawAuth
    : `bearer ${rawAuth}`;

    const params: Record<string, any> = {};
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.offset !== undefined) params.offset = query.offset;
    if (query?.order) params.order = query.order;
    params.order_by = 'price';
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) searchParams.set(k, String(v));
    });
    const urlWithParams = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
    console.log(`POST ${urlWithParams}`);
    try {
      const { data } = await axios.post(urlWithParams, payload, {
        headers: {
          Authorization: `${authorization}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });
      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      const msg = `Casafari API search failed${status ? ` with status ${status}` : ''}: ${error.message}`;
      if (body) {
        console.error(msg, { url: urlWithParams, body, payload, params });
      } else {
        console.error(msg, { url: urlWithParams, payload, params });
      }
      throw new Error(msg);
    }
}

export async function searchPlotsForSalePortugal(options?: { limit?: number; offset?: number; order?: 'asc' | 'desc'; filtersOverride?: Record<string, any>; }): Promise<any> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const order = options?.order ?? 'desc';

  const payload = {
    search_operations: ["sale"],
    types: ["urban_plot", "rural_plot"],
    location_ids: [499], // Portugal country-level location ID
    ...options?.filtersOverride,
  };

  console.log('Searching Casafari for plots in Portugal on sale with payload:', JSON.stringify(payload));
  return searchCasafariProperties(payload, { limit, offset, order });
}

/**
 * Search for urban plots for sale in Niedersachsen, Germany
 * Province ID: 532983
 */
export async function searchPlotsForSaleNiedersachsen(options?: { limit?: number; offset?: number; order?: 'asc' | 'desc'; filtersOverride?: Record<string, any>; }): Promise<any> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const order = options?.order ?? 'desc';

  const payload = {
    search_operations: ["sale"],
    types: ["urban_plot", "rural_plot"],
    location_ids: [532983], // Niedersachsen, Germany province ID
    ...options?.filtersOverride,
  };

  console.log('Searching Casafari for plots in Niedersachsen (Germany) on sale with payload:', JSON.stringify(payload));
  return searchCasafariProperties(payload, { limit, offset, order });
}

/**
 * Search for urban plots for sale in Alella, Spain
 * Province ID: 10300
 */
export async function searchPlotsForSaleAlella(options?: { limit?: number; offset?: number; order?: 'asc' | 'desc'; filtersOverride?: Record<string, any>; }): Promise<any> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const order = options?.order ?? 'desc';

  const payload = {
    search_operations: ["sale"],
    types: ["urban_plot", "rural_plot"],
    location_ids: [10300], // Alella, Spain province ID
    ...options?.filtersOverride,
  };

  console.log('Searching Casafari for plots in Alella (Spain) on sale with payload:', JSON.stringify(payload));
  return searchCasafariProperties(payload, { limit, offset, order });
}

export { aggregateCasafariSearchPages } from './aggregate';
export { paginateCasafariSearchAndSave } from './pagination';
export { 
  downloadPortugalPlots, 
  downloadNiedersachsenPlots, 
  downloadAlellaPlots,
  downloadAllRegions 
} from './download-regions';
