/**
 * Motor de Aprendizaje
 * Gestiona pesos de palabras, sinónimos y historial de confirmaciones
 * Persiste en Supabase cuando está disponible, fallback a localStorage
 */

import { supabase } from './supabase';
import { normalizeText } from './textSimilarity';
import type { WordWeightMap, SynonymMap } from './textSimilarity';

const LOCAL_STORAGE_KEY = 'comparador_learning_data';

export interface LearningData {
    wordWeights: WordWeightMap;
    synonyms: SynonymMap;
    confirmationCount: number;
}

/**
 * Obtiene datos de aprendizaje de localStorage (fallback)
 */
function getLocalLearningData(): LearningData {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('Error reading learning data from localStorage:', e);
    }
    return { wordWeights: {}, synonyms: {}, confirmationCount: 0 };
}

/**
 * Guarda datos de aprendizaje en localStorage (fallback)
 */
function saveLocalLearningData(data: LearningData): void {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Error saving learning data to localStorage:', e);
    }
}

/**
 * Obtiene pesos de palabras desde Supabase o localStorage
 */
export async function getWordWeights(): Promise<WordWeightMap> {
    try {
        // ✅ OPTIMIZACIÓN: Lazy loading - solo cargar top 100 palabras más frecuentes
        const { data, error } = await supabase
            .from('word_weights')
            .select('word, weight')
            .order('frequency', { ascending: false })
            .limit(100);

        if (error) throw error;

        const weights: WordWeightMap = {};
        (data as any[])?.forEach(row => {
            weights[row.word] = row.weight;
        });
        return weights;
    } catch (e) {
        console.warn('Using localStorage fallback for word weights:', e);
        return getLocalLearningData().wordWeights;
    }
}

/**
 * Obtiene sinónimos desde Supabase o localStorage
 */
export async function getSynonyms(): Promise<SynonymMap> {
    try {
        // ✅ OPTIMIZACIÓN: Lazy loading - solo cargar top 100 sinónimos más confidence
        const { data, error } = await supabase
            .from('synonyms')
            .select('word, synonym')
            .order('confidence', { ascending: false })
            .limit(100);

        if (error) throw error;

        const synonyms: SynonymMap = {};
        (data as any[])?.forEach(row => {
            if (!synonyms[row.word]) {
                synonyms[row.word] = [];
            }
            synonyms[row.word].push(row.synonym);
        });
        return synonyms;
    } catch (e) {
        console.warn('Using localStorage fallback for synonyms:', e);
        return getLocalLearningData().synonyms;
    }
}

/**
 * Registra una confirmación y actualiza los pesos
 */
export async function recordConfirmation(
    clienteDesc: string,
    partidaDesc: string,
    partidaId?: string
): Promise<void> {
    const clienteWords = normalizeText(clienteDesc);
    const partidaWords = normalizeText(partidaDesc);

    // Encontrar palabras coincidentes
    const matchedWords = clienteWords.filter(w => partidaWords.includes(w));

    try {
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();

        // Guardar en historial
        await (supabase.from('confirmation_history') as any).insert({
            user_id: user?.id,
            cliente_desc: clienteDesc,
            partida_desc: partidaDesc,
            partida_id: partidaId
        });

        // Actualizar pesos de palabras coincidentes
        for (const word of matchedWords) {
            const { data: existing } = await supabase
                .from('word_weights')
                .select('weight, frequency')
                .eq('word', word)
                .single();

            if (existing) {
                // Incrementar peso (máximo 2.0)
                const newWeight = Math.min(2.0, (existing as any).weight + 0.05);
                await (supabase
                    .from('word_weights') as any)
                    .update({
                        weight: newWeight,
                        frequency: (existing as any).frequency + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('word', word);
            } else {
                // Crear nuevo registro
                await (supabase.from('word_weights') as any).insert({
                    word,
                    weight: 1.05,
                    frequency: 1
                });
            }
        }

        // Detectar potenciales sinónimos
        await detectAndSaveSynonyms(clienteWords, partidaWords);

    } catch (e) {
        console.warn('Using localStorage fallback for confirmation:', e);
        // Fallback a localStorage
        const localData = getLocalLearningData();

        for (const word of matchedWords) {
            localData.wordWeights[word] = Math.min(2.0, (localData.wordWeights[word] || 1) + 0.05);
        }
        localData.confirmationCount++;

        saveLocalLearningData(localData);
    }
}

/**
 * Detecta y guarda potenciales sinónimos basándose en co-ocurrencia
 */
async function detectAndSaveSynonyms(
    clienteWords: string[],
    partidaWords: string[]
): Promise<void> {
    // Palabras únicas en cada lado que podrían ser sinónimos
    const uniqueCliente = clienteWords.filter(w => !partidaWords.includes(w));
    const uniquePartida = partidaWords.filter(w => !clienteWords.includes(w));

    // Si hay exactamente una palabra diferente en cada lado, podrían ser sinónimos
    if (uniqueCliente.length === 1 && uniquePartida.length === 1) {
        const word1 = uniqueCliente[0];
        const word2 = uniquePartida[0];

        // Verificar si ya existe
        const { data: existing } = await supabase
            .from('synonyms')
            .select('confidence')
            .eq('word', word1)
            .eq('synonym', word2)
            .single();

        if (existing) {
            // Incrementar confianza
            await (supabase
                .from('synonyms') as any)
                .update({ confidence: Math.min(1.0, (existing as any).confidence + 0.1) })
                .eq('word', word1)
                .eq('synonym', word2);
        } else {
            // Crear nuevo sinónimo potencial con baja confianza
            await (supabase.from('synonyms') as any).insert({
                word: word1,
                synonym: word2,
                confidence: 0.3
            });
        }
    }
}

/**
 * Obtiene estadísticas de aprendizaje
 */
export async function getLearningStats(): Promise<{
    totalConfirmations: number;
    uniqueWords: number;
    synonymPairs: number;
}> {
    try {
        const [confirmations, words, synonyms] = await Promise.all([
            supabase.from('confirmation_history').select('id', { count: 'exact', head: true }),
            supabase.from('word_weights').select('id', { count: 'exact', head: true }),
            supabase.from('synonyms').select('id', { count: 'exact', head: true })
        ]);

        return {
            totalConfirmations: confirmations.count || 0,
            uniqueWords: words.count || 0,
            synonymPairs: synonyms.count || 0
        };
    } catch (e) {
        const localData = getLocalLearningData();
        return {
            totalConfirmations: localData.confirmationCount,
            uniqueWords: Object.keys(localData.wordWeights).length,
            synonymPairs: Object.keys(localData.synonyms).length
        };
    }
}
