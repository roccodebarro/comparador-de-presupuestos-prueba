/**
 * Umbrales de coincidencia centralizados para toda la aplicación.
 * Usados tanto por comparison.worker.ts como por textSimilarity.ts.
 */

/** Score mínimo para clasificar como COINCIDENTE (match exacto) */
export const MATCH_THRESHOLD = 85;

/** Score mínimo para clasificar como SIMILAR */
export const SIMILAR_THRESHOLD = 60;
