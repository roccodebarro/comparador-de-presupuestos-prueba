import {
    findBestMatches,
    normalizeText,
    expandWithSynonyms,
    type WordWeightMap,
    type SynonymMap
} from './textSimilarity';
import { MATCH_THRESHOLD, SIMILAR_THRESHOLD } from './matchingConstants';


interface WorkerInput {
    rawItems: Array<{ resumen: string; descripcion: string; cantidad: number; codigo?: string }>;
    dbPartidas: any[];
    wordWeights: WordWeightMap;
    synonyms: SynonymMap;
    chunkSize: number;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
    const { rawItems, dbPartidas: rawDb, wordWeights, synonyms, chunkSize } = e.data;
    const total = rawItems.length;

    console.log('Worker: Normalizing master database of', rawDb.length, 'entries...');

    // 🏗️ NORMALIZACIÓN DE DB EN EL WORKER
    const dbPartidas: any[] = rawDb.map(p => ({
        ...p,
        precioUnitario: Number(p.precio_unitario) || Number(p.precioUnitario) || 0,
        normalized: normalizeText(p.descripcion || ''),
        normalizedCodigo: normalizeText(p.codigo || '')[0] || ''
    }));

    console.log('Worker: Building search index...');

    // 🏗️ CONSTRUCCIÓN DEL ÍNDICE INVERTIDO
    const invertedIndex = new Map<string, number[]>();
    const codigoIndex = new Map<string, number[]>();

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

        if (dbPartidas[i].normalizedCodigo) {
            let list = codigoIndex.get(dbPartidas[i].normalizedCodigo);
            if (!list) {
                list = [];
                codigoIndex.set(dbPartidas[i].normalizedCodigo, list);
            }
            list.push(i);
        }
    }

    const generateId = (item: any, index: number) => {
        const str = `${item.codigo || ''}-${item.descripcion}-${item.cantidad}-${item.precio || 0}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `it-${Math.abs(hash)}-${index}`;
    };

    const processedItems: any[] = [];

    for (let i = 0; i < total; i += chunkSize) {
        const chunk = rawItems.slice(i, i + chunkSize);

        const analyzedChunk = chunk.map((item: any, idx) => {
            const id = generateId(item, i + idx);

            // 🔍 BÚSQUEDA POR CÓDIGO (Prioridad Alta)
            const itemCodigoNorm = item.codigo ? normalizeText(item.codigo)[0] : '';
            if (itemCodigoNorm) {
                const codeMatches = codigoIndex.get(itemCodigoNorm);
                if (codeMatches && codeMatches.length > 0) {
                    const bestPartida = dbPartidas[codeMatches[0]];
                    return {
                        id,
                        clienteResumen: item.resumen,
                        clientePartida: item.descripcion,
                        clienteCodigo: item.codigo,
                        cantidad: item.cantidad,
                        clientePrecio: item.precio,
                        estado: 'COINCIDENTE',
                        confianza: 100,
                        miPartida: bestPartida,
                        precioVenta: bestPartida.precioUnitario,
                        precioCoste: 0,
                        porcentaje: 0
                    };
                }
            }

            const clienteNormalized = normalizeText(item.descripcion);

            // 🔍 FILTRADO POR ÍNDICE (PRUNING) SOBRE DESCRIPCIÓN
            const candidateIndices = new Set<number>();
            for (const word of clienteNormalized) {
                const matches = invertedIndex.get(word);
                if (matches) matches.forEach(cIdx => candidateIndices.add(cIdx));
            }

            if (candidateIndices.size === 0) {
                const expanded = expandWithSynonyms(clienteNormalized, synonyms);
                for (const word of expanded) {
                    const matches = invertedIndex.get(word);
                    if (matches) matches.forEach(cIdx => candidateIndices.add(cIdx));
                }
            }

            if (candidateIndices.size === 0) {
                return {
                    id,
                    clienteResumen: item.resumen,
                    clientePartida: item.descripcion,
                    clienteCodigo: item.codigo,
                    cantidad: item.cantidad,
                    clientePrecio: item.precio,
                    estado: 'SIN COINCIDENCIA',
                    confianza: 0,
                    miPartida: undefined,
                    precioVenta: item.precio || 0,
                    precioCoste: 0,
                    porcentaje: 0
                };
            }

            const candidates = Array.from(candidateIndices).map(cIdx => dbPartidas[cIdx]);
            const matches = findBestMatches(item.descripcion, candidates, wordWeights, synonyms, 1, clienteNormalized);

            const best = matches[0];
            const score = best?.result.score || 0;

            return {
                id,
                clienteResumen: item.resumen,
                clientePartida: item.descripcion,
                clienteCodigo: item.codigo,
                cantidad: item.cantidad,
                clientePrecio: item.precio,
                estado: score >= MATCH_THRESHOLD ? 'COINCIDENTE' : score >= SIMILAR_THRESHOLD ? 'SIMILAR' : 'SIN COINCIDENCIA',
                confianza: score,
                miPartida: score >= SIMILAR_THRESHOLD ? best.partida : undefined,
                precioVenta: score >= SIMILAR_THRESHOLD ? best.partida.precioUnitario : (item.precio || 0),
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
