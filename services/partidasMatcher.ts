import { levenshteinSimilarity } from '../utils/textSimilarity';

export interface MatchCriteria {
    codeDiffMax: number;       // e.g., 0.1 for 10%
    descriptionMinMatch: number; // e.g., 0.8 for 80%
    priceVariationMax: number;   // e.g., 0.15 for 15%
}

export const DEFAULT_CRITERIA: MatchCriteria = {
    codeDiffMax: 0.1,
    descriptionMinMatch: 0.8,
    priceVariationMax: 0.15
};

/**
 * Checks if a client item and a database partida are strictly similar based on specific criteria.
 */
export function isStrictlySimilar(
    clientDesc: string,
    clientQuantity: number,
    dbPartida: { codigo: string; descripcion: string; precioUnitario: number },
    score: number, // current similarity score from textSimilarity
    clientPrice?: number, // Optional client price to compare against
    criteria: MatchCriteria = DEFAULT_CRITERIA
): boolean {
    // 1. Description Match (current score is already normalized to 0-100)
    if (score < criteria.descriptionMinMatch * 100) return false;

    // 2. Price Variation Check
    // If we have a client price, we check if it deviates too much from our DB price.
    if (clientPrice !== undefined && clientPrice !== null && clientPrice > 0) {
        const dbPrice = dbPartida.precioUnitario;
        if (dbPrice > 0) {
            const variation = Math.abs(clientPrice - dbPrice) / dbPrice;
            if (variation > criteria.priceVariationMax) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Batch analysis of items to find strictly similar matches
 */
export function findAutoValidatableItems(
    items: any[],
    dbPartidas: any[],
    criteria: MatchCriteria = DEFAULT_CRITERIA
) {
    // This will be implemented directly in the component for efficiency or here if needed.
    return items.filter(item => item.estado === 'SIMILAR' && item.confianza >= criteria.descriptionMinMatch * 100);
}
