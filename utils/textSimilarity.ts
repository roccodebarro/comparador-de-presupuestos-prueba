/**
 * Motor de Similitud de Texto
 * Compara descripciones de partidas usando múltiples algoritmos
 */

// Stopwords en español para filtrar
const STOPWORDS = new Set([
    'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'las', 'un', 'una',
    'por', 'con', 'para', 'al', 'es', 'lo', 'como', 'más', 'o', 'pero',
    'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre',
    'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'también', 'fue', 'había',
    'era', 'muy', 'años', 'hasta', 'desde', 'está', 'mi', 'porque', 'qué',
    'sólo', 'han', 'yo', 'hay', 'vez', 'puede', 'todos', 'así', 'nos',
    'ni', 'parte', 'tiene', 'él', 'uno', 'donde', 'bien', 'tiempo', 'mismo',
    'ese', 'ahora', 'cada', 'e', 'vida', 'otro', 'después', 'te', 'otros',
    'aunque', 'esa', 'eso', 'hace', 'otra', 'gobierno', 'tan', 'durante',
    'tipo', 'ud', 'uds', 'unidad', 'unidades', 'incluye', 'incluido', 'según'
]);

export interface SimilarityResult {
    score: number;
    matchedWords: string[];
    synonymsUsed: string[];
}

export interface WordWeightMap {
    [word: string]: number;
}

export interface SynonymMap {
    [word: string]: string[];
}

/**
 * Simplifica un texto: minúsculas, sin acentos y trim
 */
export function simplifyText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Normaliza un texto para comparación (formato array de palabras)
 */
export function normalizeText(text: string): string[] {
    const simplified = simplifyText(text);

    // Si parece un código (números con puntos o guiones, ej: 06.02.01)
    // lo mantenemos casi intacto para matching exacto
    if (/^[\d.-]+$/.test(simplified) && simplified.length >= 2) {
        return [simplified];
    }

    return simplified
        .replace(/[^a-z0-9\s]/g, ' ')    // Solo alfanumérico
        .split(/\s+/)
        .filter(word => {
            // Permitimos palabras cortas si son números (posibles códigos)
            if (/^\d+$/.test(word)) return word.length >= 1;
            return word.length > 2 && !STOPWORDS.has(word);
        });
}

/**
 * Similitud de Jaccard entre dos conjuntos de palabras
 */
export function jaccardSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Distancia de Levenshtein normalizada entre dos strings
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
    // 🔥 Límite de seguridad para evitar explosión O(N*M)
    if (str1.length > 500) str1 = str1.substring(0, 500);
    if (str2.length > 500) str2 = str2.substring(0, 500);

    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n === 0 ? 1 : 0;
    if (n === 0) return 0;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    const maxLen = Math.max(m, n);
    return 1 - (dp[m][n] / maxLen);
}

/**
 * Encuentra la mejor coincidencia de una palabra en un conjunto usando Levenshtein
 */
export function findBestMatch(word: string, candidates: string[]): { word: string; score: number } | null {
    let best: { word: string; score: number } | null = null;

    for (const candidate of candidates) {
        const score = levenshteinSimilarity(word, candidate);
        if (score > 0.7 && (!best || score > best.score)) {
            best = { word: candidate, score };
        }
    }

    return best;
}

/**
 * Expande palabras con sinónimos conocidos
 */
export function expandWithSynonyms(words: string[], synonymMap: SynonymMap): string[] {
    const expanded = new Set(words);

    for (const word of words) {
        const synonyms = synonymMap[word];
        if (synonyms && Array.isArray(synonyms)) {
            synonyms.forEach(syn => expanded.add(syn));
        }
    }

    return Array.from(expanded);
}

/**
 * Calcula puntuación combinada de similitud
 */
export function calculateSimilarity(
    clienteDesc: string,
    partidaDesc: string,
    wordWeights: WordWeightMap = {},
    synonymMap: SynonymMap = {},
    preNormalizedCliente?: string[],
    preNormalizedPartida?: string[]
): SimilarityResult {
    const clienteWords = preNormalizedCliente || normalizeText(clienteDesc);
    const partidaWords = preNormalizedPartida || normalizeText(partidaDesc);

    if (clienteWords.length === 0 || partidaWords.length === 0) {
        return { score: 0, matchedWords: [], synonymsUsed: [] };
    }

    // 🔥 OPTIMIZACIÓN: Solo procedemos si hay palabras coincidentes (Fast-Exit)
    const setPartida = new Set(partidaWords);
    let hasOverlap = clienteWords.some(w => setPartida.has(w));

    if (!hasOverlap) {
        // Solo procedemos si hay sinónimos que puedan conectar
        const expandedCliente = expandWithSynonyms(clienteWords, synonymMap);
        const setExpandedCliente = new Set(expandedCliente);
        hasOverlap = partidaWords.some(w => setExpandedCliente.has(w));

        if (!hasOverlap) {
            return { score: 0, matchedWords: [], synonymsUsed: [] };
        }
    }

    // Expandir con sinónimos (solo para Jaccard)
    const expandedCliente = expandWithSynonyms(clienteWords, synonymMap);
    const expandedPartida = expandWithSynonyms(partidaWords, synonymMap);

    // Encontrar palabras coincidentes
    const matchedWords: string[] = [];
    const synonymsUsed: string[] = [];

    for (const word of clienteWords) {
        if (setPartida.has(word)) { // Usar Set para O(1)
            matchedWords.push(word);
        } else {
            // Buscar coincidencia parcial con Levenshtein (SOLO si la palabra es suficientemente larga)
            if (word.length > 4) {
                const match = findBestMatch(word, partidaWords);
                if (match && match.score > 0.8) { // Umbral más estricto
                    matchedWords.push(`${word}≈${match.word}`);
                }
            }

            // Verificar si coincide via sinónimo
            const synonyms = synonymMap[word] || [];
            for (const syn of synonyms) {
                if (setPartida.has(syn)) {
                    synonymsUsed.push(`${word}→${syn}`);
                    break;
                }
            }
        }
    }

    // Calcular puntuaciones
    const jaccardScore = jaccardSimilarity(expandedCliente, expandedPartida);

    // 🔥 OPTIMIZACIÓN: Si Jaccard es muy bajo, no gastar CPU en Levenshtein completo
    if (jaccardScore < 0.1 && matchedWords.length === 0) {
        return { score: Math.round(jaccardScore * 100), matchedWords, synonymsUsed };
    }

    const joinedCliente = clienteWords.join(' ');
    const joinedPartida = partidaWords.join(' ');
    const levenshteinScore = levenshteinSimilarity(joinedCliente, joinedPartida);

    // Calcular peso basado en palabras importantes
    let weightBonus = 0;
    for (const word of matchedWords) {
        const cleanWord = word.split('≈')[0];
        const weight = wordWeights[cleanWord] || 1;
        weightBonus += (weight - 1) * 0.05;
    }

    const baseScore = (jaccardScore * 0.6 + levenshteinScore * 0.4) * 100;
    const finalScore = Math.min(100, baseScore + weightBonus * 100);

    return {
        score: Math.round(finalScore),
        matchedWords,
        synonymsUsed
    };
}

/**
 * Clasifica el resultado de similitud
 * NOTA: Los umbrales están centralizados en matchingConstants.ts
 */
export function classifyMatch(score: number): 'COINCIDENTE' | 'SIMILAR' | 'SIN COINCIDENCIA' {
    if (score >= 88) return 'COINCIDENTE';
    if (score >= 62) return 'SIMILAR';
    return 'SIN COINCIDENCIA';
}

/**
 * Encuentra las mejores coincidencias para una descripción de cliente
 */
export function findBestMatches<T extends { descripcion: string; codigo?: string; normalized?: string[] }>(
    clienteDesc: string,
    partidas: T[],
    wordWeights: WordWeightMap = {},
    synonymMap: SynonymMap = {},
    limit: number = 5,
    preNormalizedCliente?: string[]
): Array<{ partida: T; result: SimilarityResult }> {
    const clienteWords = preNormalizedCliente || normalizeText(clienteDesc);
    const results: Array<{ partida: T; result: SimilarityResult }> = [];

    for (const partida of partidas) {
        const result = calculateSimilarity(
            clienteDesc,
            partida.descripcion,
            wordWeights,
            synonymMap,
            clienteWords,
            partida.normalized
        );
        results.push({ partida, result });

        // Atajo: Si encontramos algo casi perfecto (>98%), lo priorizamos y podemos parar si limit es 1
        if (result.score >= 98 && limit === 1) break;
    }

    return results
        .sort((a, b) => {
            const scoreDiff = b.result.score - a.result.score;
            if (scoreDiff !== 0) return scoreDiff;
            // Estabilidad: si el score es igual, ordenar por código y luego por descripción
            const codeA = a.partida.codigo || '';
            const codeB = b.partida.codigo || '';
            if (codeA !== codeB) return codeA.localeCompare(codeB);
            return a.partida.descripcion.localeCompare(b.partida.descripcion);
        })
        .slice(0, limit);
}
