import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Plot, EnrichmentData } from '../types';
import { enrichPlot } from '../enrichments/amenities';
import { getMunicipalityFromCoordinates, findMunicipalityByName, insertMunicipality } from './helpers/municipality-helpers';
import { getSpanishCadastralInfo } from '../enrichments/spain-cadastre/spain_cadastre_lookup';
import { getSpanishZoningForPoint } from '../enrichments/spain-zoning/spain_lookup';
import { getPortugalCadastralInfo } from '../enrichments/portugal-cadastre/portugal_cadastre_lookup';
import { getPortugalZoningData, PortugalZoningResult } from './helpers/crus-helpers';
import { getGermanZoningForPoint } from '../enrichments/germany-zoning/germany_lookup';
import { translateZoningLabel } from '../llm/translate';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

export interface LocationEnrichmentRequest {
  latitude: number;
  longitude: number;
  plot_id?: string; // Plot ID to link enrichment data (required if store_results is true)
  store_results?: boolean; // Whether to store in database (default: true)
  translate?: boolean; // Whether to translate zoning labels (default: false)
  target_language?: string; // Translation target language (default: 'en')
}

export interface MunicipalityInfo {
  id?: number;
  name: string;
  district?: string;
  country?: string;
}

export interface LocationEnrichmentResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  country?: string;
  municipality?: MunicipalityInfo;
  amenities?: EnrichmentData;
  zoning?: any;
  cadastre?: any;
  enrichment_data?: any; // Complete enrichment data object
  enrichments_run: string[];
  enrichments_skipped: string[];
  enrichments_failed: string[];
  timestamp: string;
  error?: string;
}

/**
 * Helper to merge enrichment data defensively
 */
function mergeEnrichmentData(existing: any, newData: any, key: string): any {
  const merged = { ...existing };
  merged[key] = newData;
  return merged;
}

/**
 * Main orchestrator function that runs all applicable enrichments for a given location
 */
export async function enrichLocation(
  request: LocationEnrichmentRequest
): Promise<LocationEnrichmentResponse> {
  const { latitude, longitude, plot_id, store_results = true, translate = false, target_language = 'en' } = request;
  
  // Validate: plot_id is required when store_results is true
  if (store_results && !plot_id) {
    throw new Error('plot_id is required when store_results is true');
  }
  
  const response: LocationEnrichmentResponse = {
    location: { latitude, longitude },
    enrichments_run: [],
    enrichments_skipped: [],
    enrichments_failed: [],
    timestamp: new Date().toISOString(),
  };

  let enrichmentData: any = {};
  let pool: Pool | null = null;
  let client: any = null;

  try {
    // Initialize database connection if storing results
    if (store_results && DATABASE_URL) {
      pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
      client = await pool.connect();
    }

    // 1. MUNICIPALITY ENRICHMENT (ALWAYS RUN - determines country)
    console.log('Running municipality enrichment...');
    try {
      const municipalityData = await getMunicipalityFromCoordinates(latitude, longitude);
      
      if (municipalityData) {
        response.municipality = {
          name: municipalityData.name,
          district: municipalityData.district,
          country: municipalityData.country,
        };
        response.country = municipalityData.country;
        
        // If storing results, get or create municipality record
        if (client && store_results) {
          let municipality = await findMunicipalityByName(client, municipalityData.name);
          if (!municipality) {
            municipality = await insertMunicipality(
              client,
              municipalityData.name,
              municipalityData.district,
              municipalityData.country
            );
          }
          if (municipality) {
            response.municipality.id = municipality.id;
          }
        }
        
        response.enrichments_run.push('municipalities');
        console.log(`✓ Municipality: ${municipalityData.name} (${municipalityData.country})`);
      } else {
        response.enrichments_failed.push('municipalities');
        console.warn('✗ Could not determine municipality');
      }
    } catch (error) {
      console.error('Municipality enrichment failed:', error);
      response.enrichments_failed.push('municipalities');
    }

    // 2. AMENITIES ENRICHMENT (ALWAYS RUN)
    console.log('Running amenities enrichment...');
    try {
      const plot: Plot = { id: 'temp', latitude, longitude };
      const amenitiesData = await enrichPlot(plot);
      
      response.amenities = amenitiesData;
      enrichmentData = mergeEnrichmentData(enrichmentData, amenitiesData, 'amenities');
      response.enrichments_run.push('amenities');
      console.log('✓ Amenities enrichment complete');
    } catch (error) {
      console.error('Amenities enrichment failed:', error);
      response.enrichments_failed.push('amenities');
    }

    // 3. COUNTRY-SPECIFIC ENRICHMENTS
    const country = response.country;

    if (country === 'PT') {
      // PORTUGAL: Portugal Cadastre + CRUS Zoning
      console.log('Running Portugal-specific enrichments...');
      
      // Portugal Cadastre (run first to get parcel geometry)
      let parcelGeometry: any = null;
      try {
        const cadastreData = await getPortugalCadastralInfo(longitude, latitude);
        if (cadastreData) {
          enrichmentData = mergeEnrichmentData(enrichmentData, cadastreData, 'cadastral');
          response.cadastre = cadastreData;
          response.enrichments_run.push('portugal-cadastre');
          console.log('✓ Portugal cadastre complete');
          
          // Extract parcel geometry for zoning query
          if (cadastreData.geometry) {
            parcelGeometry = cadastreData.geometry;
            console.log('  → Parcel geometry available for zoning query');
          }
        } else {
          response.enrichments_skipped.push('portugal-cadastre');
          console.log('○ No Portugal cadastre data found');
        }
      } catch (error) {
        console.error('Portugal cadastre failed:', error);
        response.enrichments_failed.push('portugal-cadastre');
      }

      // Portugal Zoning: CRUS + COS2023 Land Cover + Parish data
      try {
        const portugalZoning = await getPortugalZoningData(latitude, longitude, parcelGeometry);
        if (portugalZoning && (portugalZoning.crus || portugalZoning.land_cover || portugalZoning.parish)) {
          let zoningData: any = portugalZoning;
          
          // Optional translation for CRUS designation
          if (translate && portugalZoning.crus?.designation) {
            try {
              const translated = await translateZoningLabel(portugalZoning.crus.designation, { 
                sourceLangHint: 'pt', 
                targetLang: target_language,
                municipality: response.municipality?.name
              });
              if (translated) {
                zoningData = {
                  ...portugalZoning,
                  crus: portugalZoning.crus ? {
                    ...portugalZoning.crus,
                    designation_original: portugalZoning.crus.designation,
                    designation: translated.label_en,
                    translated: true,
                    translation_confidence: translated.confidence,
                    translation_notes: translated.notes,
                  } : undefined,
                  label_original: portugalZoning.label,
                  label: translated.label_en,
                };
              }
            } catch (e) {
              console.warn('Translation failed for Portugal zoning:', e);
            }
          }
          
          enrichmentData = mergeEnrichmentData(enrichmentData, zoningData, 'zoning');
          response.zoning = zoningData;
          
          // Track which sub-enrichments ran
          const subEnrichments: string[] = [];
          if (portugalZoning.crus) subEnrichments.push('crus');
          if (portugalZoning.land_cover) subEnrichments.push('cos2023');
          if (portugalZoning.parish) subEnrichments.push('parish');
          
          response.enrichments_run.push('portugal-zoning');
          console.log(`✓ Portugal zoning complete (${subEnrichments.join(', ')})`);
        } else {
          response.enrichments_skipped.push('portugal-zoning');
          console.log('○ No Portugal zoning data found');
        }
      } catch (error) {
        console.error('Portugal zoning failed:', error);
        response.enrichments_failed.push('portugal-zoning');
      }
      
    } else if (country === 'ES') {
      // SPAIN: Spain Cadastre + Spain Zoning
      console.log('Running Spain-specific enrichments...');
      
      // Spain Cadastre
      try {
        const cadastreData = await getSpanishCadastralInfo(latitude, longitude);
        if (cadastreData) {
          enrichmentData = mergeEnrichmentData(enrichmentData, cadastreData, 'cadastral');
          response.cadastre = cadastreData;
          response.enrichments_run.push('spain-cadastre');
          console.log('✓ Spain cadastre complete');
        } else {
          response.enrichments_skipped.push('spain-cadastre');
          console.log('○ No Spain cadastre data found');
        }
      } catch (error) {
        console.error('Spain cadastre failed:', error);
        response.enrichments_failed.push('spain-cadastre');
      }

      // Spain Zoning
      try {
        const spainZoning = await getSpanishZoningForPoint(latitude, longitude);
        if (spainZoning && spainZoning.label) {
          let zoningData = spainZoning;
          
          // Optional translation
          if (translate && spainZoning.label) {
            try {
              const translated = await translateZoningLabel(spainZoning.label, { 
                sourceLangHint: 'es', 
                targetLang: target_language,
                municipality: response.municipality?.name
              });
              if (translated) {
                zoningData = {
                  ...spainZoning,
                  label_original: spainZoning.label,
                  label: translated.label_en,
                  translated: true,
                  translation_confidence: translated.confidence,
                  translation_notes: translated.notes,
                } as any;
              }
            } catch (e) {
              console.warn('Translation failed for Spain zoning:', e);
            }
          }
          
          enrichmentData = mergeEnrichmentData(enrichmentData, zoningData, 'zoning');
          response.zoning = zoningData;
          response.enrichments_run.push('spain-zoning');
          console.log('✓ Spain zoning complete');
        } else {
          response.enrichments_skipped.push('spain-zoning');
          console.log('○ No Spain zoning data found');
        }
      } catch (error) {
        console.error('Spain zoning failed:', error);
        response.enrichments_failed.push('spain-zoning');
      }
      
    } else if (country === 'DE') {
      // GERMANY: Germany Zoning
      console.log('Running Germany-specific enrichments...');
      
      try {
        const germanyZoning = await getGermanZoningForPoint(latitude, longitude);
        if (germanyZoning && germanyZoning.label) {
          let zoningData = germanyZoning;
          
          // Optional translation
          if (translate && germanyZoning.label) {
            try {
              const translated = await translateZoningLabel(germanyZoning.label, { 
                sourceLangHint: 'de', 
                targetLang: target_language,
                municipality: response.municipality?.name
              });
              if (translated) {
                zoningData = {
                  ...germanyZoning,
                  label_original: germanyZoning.label,
                  label: translated.label_en,
                  translated: true,
                  translation_confidence: translated.confidence,
                  translation_notes: translated.notes,
                } as any;
              }
            } catch (e) {
              console.warn('Translation failed for Germany zoning:', e);
            }
          }
          
          enrichmentData = mergeEnrichmentData(enrichmentData, zoningData, 'zoning');
          response.zoning = zoningData;
          response.enrichments_run.push('germany-zoning');
          console.log('✓ Germany zoning complete');
        } else {
          response.enrichments_skipped.push('germany-zoning');
          console.log('○ No Germany zoning data found');
        }
      } catch (error) {
        console.error('Germany zoning failed:', error);
        response.enrichments_failed.push('germany-zoning');
      }
      
    } else {
      // Unknown country - skip country-specific enrichments
      console.log(`Country '${country}' - skipping country-specific enrichments`);
      response.enrichments_skipped.push('portugal-cadastre', 'spain-cadastre', 'spain-zoning', 'crus-zoning', 'germany-zoning');
    }

    // Store complete enrichment data in response
    response.enrichment_data = enrichmentData;

    // 4. STORE RESULTS TO DATABASE (if requested)
    if (client && store_results && plot_id) {
      console.log(`Storing enrichment results to database for plot ${plot_id}...`);
      try {
        // First, check if real_latitude/real_longitude exist and differ from provided coords
        const existingPlot = await client.query(
          `SELECT real_latitude, real_longitude FROM enriched_plots_stage WHERE id = $1`,
          [plot_id]
        );
        
        let shouldUpdateRealCoords = false;
        if (existingPlot.rows.length > 0) {
          const { real_latitude, real_longitude } = existingPlot.rows[0];
          // Update real coordinates only if they differ from provided coordinates
          shouldUpdateRealCoords = real_latitude !== latitude || real_longitude !== longitude;
        } else {
          // New plot - set real coordinates
          shouldUpdateRealCoords = true;
        }

        if (shouldUpdateRealCoords) {
          await client.query(
            `INSERT INTO enriched_plots_stage (id, latitude, longitude, real_latitude, real_longitude, municipality_id, enrichment_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
             ON CONFLICT (id) DO UPDATE SET
               real_latitude = EXCLUDED.real_latitude,
               real_longitude = EXCLUDED.real_longitude,
               municipality_id = EXCLUDED.municipality_id,
               enrichment_data = COALESCE(enriched_plots_stage.enrichment_data, '{}'::jsonb) || EXCLUDED.enrichment_data`,
            [plot_id, latitude, longitude, latitude, longitude, response.municipality?.id || null, JSON.stringify(enrichmentData)]
          );
          console.log(`✓ Results stored to database for plot ${plot_id} (real coordinates updated)`);
        } else {
          await client.query(
            `INSERT INTO enriched_plots_stage (id, latitude, longitude, municipality_id, enrichment_data)
             VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT (id) DO UPDATE SET
               municipality_id = EXCLUDED.municipality_id,
               enrichment_data = COALESCE(enriched_plots_stage.enrichment_data, '{}'::jsonb) || EXCLUDED.enrichment_data`,
            [plot_id, latitude, longitude, response.municipality?.id || null, JSON.stringify(enrichmentData)]
          );
          console.log(`✓ Results stored to database for plot ${plot_id} (real coordinates unchanged)`);
        }
      } catch (error) {
        console.error(`Failed to store results to database for plot ${plot_id}:`, error);
      }
    }

    return response;
    
  } catch (error: any) {
    console.error('Error in location enrichment:', error);
    response.error = error.message || 'Unknown error occurred';
    return response;
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}
