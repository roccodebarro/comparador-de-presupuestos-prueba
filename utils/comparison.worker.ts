import {
    findBestMatches,
    normalizeText,
    expandWithSynonyms,
    type WordWeightMap,
    type SynonymMap
} from './textSimilarity';
import { MATCH_THRESHOLD, SIMILAR_THRESHOLD } from './matchingConstants';


interface WorkerInput {
    rawItems: Array<{ descripcion: string; cantidad: number }>;
    dbPartidas: any[];
    wordWeights: WordWeightMap;
    synonyms: SynonymMap;
    chunkSize: number;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
    const { rawItems, dbPartidas: rawDb, wordWeights, synonyms, chunkSize } = e.data;
    const total = rawItems.length;

    console.log('Worker: Normalizing master database of', rawDb.length, 'entries...');

    // 🏗️ NORMALIZACIÓN DE DB EN EL WORKER (Evitamos bloquear el hilo principal)
    const dbPartidas: any[] = rawDb.map(p => ({
        ...p,
        precioUnitario: Number(p.precio_unitario) || Number(p.precioUnitario) || 0,
        normalized: normalizeText(p.descripcion || '')
    }));

    console.log('Worker: Building search index...');

    // 🏗️ CONSTRUCCIÓN DEL ÍNDICE INVERTIDO
    const invertedIndex = new Map<string, number[]>();
    for (let i = 0; i < dbPartidas.length; i++) {
        const words = dbPartidas[i].normalized || [];
        for (const word of words) {
            let list = invertedIndex.get(word);
            if (!list) {
                list = [];
                invertedIndex.set(word, list);
            }
            list.push(i);
        }
    }

    const processedItems: any[] = [];

    for (let i = 0; i < total; i += chunkSize) {
        const chunk = rawItems.slice(i, i + chunkSize);

        const analyzedChunk = chunk.map((item, idx) => {
            const clienteNormalized = normalizeText(item.descripcion);

            // 🔍 FILTRADO POR ÍNDICE (PRUNING)
            const candidateIndices = new Set<number>();
            for (const word of clienteNormalized) {
                const matches = invertedIndex.get(word);
                if (matches) matches.forEach(idx => candidateIndices.add(idx));
            }

            // Si no hay candidatos directos, expandimos con sinónimos (solo si es necesario)
            if (candidateIndices.size === 0) {
                const expanded = expandWithSynonyms(clienteNormalized, synonyms);
                for (const word of expanded) {
                    const matches = invertedIndex.get(word);
                    if (matches) matches.forEach(idx => candidateIndices.add(idx));
                }
            }

            // Si aún no hay candidatos, es SIN COINCIDENCIA
            if (candidateIndices.size === 0) {
                return {
                    id: `it-${Date.now()}-${i + idx}-${Math.random().toString(36).substr(2, 5)}`,
                    clientePartida: item.descripcion,
                    cantidad: item.cantidad,
                    estado: 'SIN COINCIDENCIA',
                    confianza: 0,
                    miPartida: undefined,
                    precioVenta: 0,
                    precioCoste: 0,
                    porcentaje: 0
                };
            }

            // Solo comparamos contra los candidatos podados
            const candidates = Array.from(candidateIndices).map(idx => dbPartidas[idx]);
            const matches = findBestMatches(item.descripcion, candidates, wordWeights, synonyms, 1, clienteNormalized);

            const best = matches[0];
            const score = best?.result.score || 0;

            const precioBase = score >= SIMILAR_THRESHOLD ? (Number(best.partida.precio_unitario) || Number(best.partida.precioUnitario) || 0) : 0;

            return {
                id: `it-${Date.now()}-${i + idx}-${Math.random().toString(36).substr(2, 5)}`,
                clientePartida: item.descripcion,
                cantidad: item.cantidad,
                estado: score >= MATCH_THRESHOLD ? 'COINCIDENTE' : score >= SIMILAR_THRESHOLD ? 'SIMILAR' : 'SIN COINCIDENCIA',
                confianza: score,
                miPartida: score >= SIMILAR_THRESHOLD ? best.partida : undefined,
                precioVenta: precioBase,
                precioCoste: 0,
                porcentaje: 0
            };
        });

        processedItems.push(...analyzedChunk);

        self.postMessage({
            type: 'PROGRESS',
            current: Math.min(i + chunkSize, total),
            total,
            chunk: analyzedChunk
        });

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    self.postMessage({
        type: 'COMPLETE',
        total
    });
};
