/**
 * Generador de archivos BC3 (FIEBDC-3)
 * v2: Incluye descomposición (mano de obra, materiales, maquinaria) desde Supabase
 */

import { ComparisonItem } from '../types';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponenteDescomposicion {
    componente_codigo: string;
    componente_tipo: 'MO' | 'MAT' | 'MAQ' | 'CI' | 'AUX';
    componente_unidad: string;
    componente_resumen: string;
    componente_descripcion: string;
    componente_precio: number;
    rendimiento: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCODING ANSI
// ─────────────────────────────────────────────────────────────────────────────

const ANSI_MAP: { [key: string]: number } = {
    '€': 128, '´': 180, '¨': 168, 'ñ': 241, 'Ñ': 209,
    'á': 225, 'é': 233, 'í': 237, 'ó': 243, 'ú': 250,
    'Á': 193, 'É': 201, 'Í': 205, 'Ó': 211, 'Ú': 218,
    'ü': 252, 'Ü': 220, 'º': 186, 'ª': 170, '¿': 191, '¡': 161,
    'À': 192, 'È': 200, 'Ì': 204, 'Ò': 210, 'Ù': 217,
    'à': 224, 'è': 232, 'ì': 236, 'ò': 242, 'ù': 249,
    'ç': 231, 'Ç': 199, '·': 183, '©': 169, '®': 174,
    'â': 226, 'ê': 234, 'î': 238, 'ô': 244, 'û': 251,
    'ã': 227, 'õ': 245, 'ä': 228, 'ö': 246,
};

function encodeToANSI(text: string): number[] {
    if (!text) return [];
    const res: number[] = [];
    const normalized = text.normalize('NFC');
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const code = normalized.charCodeAt(i);
        if (ANSI_MAP[char] !== undefined) res.push(ANSI_MAP[char]);
        else if (code < 256) res.push(code);
        else res.push(63);
    }
    return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export function sanitizeBC3Text(text: string): string {
    if (!text) return '';
    return text
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '/')
        .replace(/~/g, '-')
        .replace(/\\/g, '/')
        .trim();
}

function sanitizeBC3Code(code: string): string {
    if (!code) return '';
    return code
        .normalize('NFC')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9ñÑ._#%]/g, '_')
        .substring(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN DE RESUMEN INTELIGENTE
// ─────────────────────────────────────────────────────────────────────────────

const PALABRAS_PROHIBIDAS_RESUMEN = new Set([
    'de', 'del', 'la', 'el', 'lo', 'las', 'los', 'un', 'una', 'unos', 'unas',
    'al', 'en', 'con', 'por', 'para', 'desde', 'hasta', 'sobre', 'entre',
    'sin', 'ante', 'bajo', 'tras', 'según', 'mediante', 'durante',
    'y', 'o', 'u', 'e', 'ni', 'pero', 'sino', 'que', 'si', 'ya',
    'su', 'sus', 'cuyo', 'cuya', 'este', 'esta', 'estos', 'estas', 'se', 'a',
]);

const INICIO_SUBORDINADA = new Set([
    'desde', 'hasta', 'que', 'realizado', 'realizada', 'realizados', 'realizadas',
    'incluye', 'incluyendo', 'formado', 'formada', 'compuesto', 'compuesta',
    'conectando', 'mediante',
]);

const JERGA_FIN_TITULO = new Set(['incluso', 'totalmente', 'según', 'p.p.']);
const PATRON_NUMERICO_RESUMEN = /^\d+[,.]?\d*\s*(mm|cm|ml|m2|m3|kv|hz|kg|ud|%)/i;
const PATRON_SOLO_NUMERO = /^\d+[,.]?\d*$/;
const SUFIJOS_ADJ_RESUMEN = [
    'ado', 'ada', 'ados', 'adas', 'ido', 'ida', 'idos', 'idas',
    'ble', 'bles', 'oso', 'osa', 'osos', 'osas',
    'ivo', 'iva', 'ivos', 'ivas', 'ente', 'ientes',
];

function _esAdjetivoResumen(p: string): boolean {
    const s = p.toLowerCase().replace(/[.,;:()]+$/, '');
    return SUFIJOS_ADJ_RESUMEN.some(suf => s.endsWith(suf) && s.length > suf.length + 2);
}

function _esBuenSustantivo(p: string): boolean {
    const c = p.replace(/[.,;:()]+$/, '');
    if (!c || c.length < 2) return false;
    if (PALABRAS_PROHIBIDAS_RESUMEN.has(c.toLowerCase())) return false;
    if (_esAdjetivoResumen(c)) return false;
    return true;
}

export function extractSummary(text: string): string {
    if (!text) return '.';
    const clean = sanitizeBC3Text(text).replace(/\s+/g, ' ').trim();
    if (!clean) return '.';
    if (clean.length <= 40) return clean;

    const palabras = clean.split(' ');
    let resumen = '';
    let ultimoSustantivo = '';

    for (const palabra of palabras) {
        const pLower = palabra.toLowerCase().replace(/[.,;:()]+$/, '');
        const candidato = resumen ? `${resumen} ${palabra}` : palabra;

        if (INICIO_SUBORDINADA.has(pLower) && ultimoSustantivo && ultimoSustantivo.length >= 15)
            return ultimoSustantivo.replace(/[,;:.\-–— ]+$/, '').trim();
        if (JERGA_FIN_TITULO.has(pLower) && ultimoSustantivo && ultimoSustantivo.length >= 15)
            return ultimoSustantivo.replace(/[,;:.\-–— ]+$/, '').trim();
        if ((PATRON_NUMERICO_RESUMEN.test(palabra) || PATRON_SOLO_NUMERO.test(palabra))
            && ultimoSustantivo && ultimoSustantivo.length >= 15)
            return ultimoSustantivo.replace(/[,;:.\-–— ]+$/, '').trim();

        if (_esBuenSustantivo(palabra)) ultimoSustantivo = candidato;

        if (candidato.length > 70) {
            if (ultimoSustantivo && ultimoSustantivo.length >= 15)
                return ultimoSustantivo.replace(/[,;:.\-–— ]+$/, '').trim();
            break;
        }
        resumen = candidato;
    }
    return (ultimoSustantivo || resumen).replace(/[,;:.\-–— ]+$/, '').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGA DE DESCOMPOSICIÓN DESDE SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

export async function cargarDescomposiciones(
    codigos: string[]
): Promise<Map<string, ComponenteDescomposicion[]>> {
    const result = new Map<string, ComponenteDescomposicion[]>();
    if (!codigos.length) return result;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return result;

        const { data, error } = await supabase
            .from('partidas_descomposicion')
            .select('*')
            .eq('user_id', user.id)
            .in('partida_codigo', codigos);

        if (error) throw error;

        for (const row of (data || [])) {
            const list = result.get(row.partida_codigo) || [];
            list.push({
                componente_codigo: row.componente_codigo,
                componente_tipo: row.componente_tipo,
                componente_unidad: row.componente_unidad || 'ud',
                componente_resumen: row.componente_resumen || '',
                componente_descripcion: row.componente_descripcion || '',
                componente_precio: Number(row.componente_precio) || 0,
                rendimiento: Number(row.rendimiento) || 0,
            });
            result.set(row.partida_codigo, list);
        }
    } catch (err) {
        console.warn('No se pudo cargar descomposición:', err);
    }
    return result;
}

// Tipo BC3 según tipo de componente
function tipoBC3(tipo: string): string {
    if (tipo === 'MO') return '1';
    if (tipo === 'MAQ') return '2';
    if (tipo === 'MAT') return '3';
    return '0'; // CI, AUX → genérico
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL (async, con descomposición)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBC3BinaryAsync(
    items: ComparisonItem[],
    fileName: string = 'Presupuesto',
    globalPercentage: number = 0
): Promise<Uint8Array> {
    const codigos = items.map(i => i.miPartida?.codigo).filter(Boolean) as string[];
    const descomposiciones = await cargarDescomposiciones(codigos);
    return _buildBC3Buffer(items, fileName, globalPercentage, descomposiciones);
}

// Versión síncrona sin descomposición (compatibilidad hacia atrás)
export function generateBC3Binary(
    items: ComparisonItem[],
    fileName: string = 'Presupuesto',
    globalPercentage: number = 0
): Uint8Array {
    return _buildBC3Buffer(items, fileName, globalPercentage, new Map());
}

function _buildBC3Buffer(
    items: ComparisonItem[],
    fileName: string,
    globalPercentage: number,
    descomposiciones: Map<string, ComponenteDescomposicion[]>
): Uint8Array {
    let buffer: number[] = [];

    const writeLine = (str: string) => {
        buffer.push(...encodeToANSI(str));
        buffer.push(13, 10); // CRLF obligatorio
    };

    const dateObj = new Date();
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2);
    const today = `${day}${month}${year}`;

    const sanitizedFileName = sanitizeBC3Text(fileName).substring(0, 100) || 'Presupuesto';
    const budgetRootCode = sanitizeBC3Code(fileName.replace(/\s+/g, '_')).substring(0, 20) + '##';

    // ~V y ~K ──────────────────────────────────────────────────────────────────
    writeLine(`~V|Comparador BC3|FIEBDC-3/2004|ARQUIMEDES||ANSI|${sanitizedFileName}|1|`);
    writeLine(`~K|-9\\2\\2\\4\\2\\2\\2\\2\\EUR\\|0\\13\\6\\\\21|\\2\\\\\\4\\\\2\\2\\2\\-9\\2\\2\\EUR\\||`);

    // Preparar partidas ─────────────────────────────────────────────────────────
    const processedCodes = new Set<string>([budgetRootCode]);

    interface PartidaData {
        codigo: string;
        codigoOriginal: string;
        unidad: string;
        resumen: string;
        descripcionLarga: string;
        puFinal: number;
        cantidad: number;
        importe: number;
        componentes: ComponenteDescomposicion[];
    }

    const partidas: PartidaData[] = [];
    let totalPresupuesto = 0;

    items.forEach((item, idx) => {
        const codigoOriginal = item.miPartida?.codigo || '';
        let baseCodigo = codigoOriginal
            ? sanitizeBC3Code(codigoOriginal)
            : `P${String(idx + 1).padStart(5, '0')}`;
        if (!baseCodigo) baseCodigo = `P${String(idx + 1).padStart(5, '0')}`;

        let uniqueCodigo = baseCodigo;
        let suffix = 1;
        while (processedCodes.has(uniqueCodigo))
            uniqueCodigo = `${baseCodigo.substring(0, 17)}_${String(suffix++).padStart(2, '0')}`;
        processedCodes.add(uniqueCodigo);

        const rawDesc = item.clientePartida || item.miPartida?.descripcion || '.';
        const resumen = item.clienteResumen || extractSummary(rawDesc);
        const unidad = item.miPartida?.unidad
            ? sanitizeBC3Text(item.miPartida.unidad).substring(0, 8)
            : 'ud';

        const unitPriceBase =
            ((item.precioCoste || 0) * (1 + ((item.porcentaje || 0) / 100))) +
            (item.precioVenta || 0);
        const puFinal = Number((unitPriceBase * (1 + (globalPercentage / 100))).toFixed(2));
        const cantidad = Number(Number(item.cantidad).toFixed(3));
        const importe = Number((cantidad * puFinal).toFixed(2));
        totalPresupuesto += importe;

        partidas.push({
            codigo: uniqueCodigo,
            codigoOriginal,
            unidad,
            resumen,
            descripcionLarga: rawDesc,
            puFinal,
            cantidad,
            importe,
            componentes: descomposiciones.get(codigoOriginal) || [],
        });
    });

    // ~C raíz ──────────────────────────────────────────────────────────────────
    writeLine(`~C|${budgetRootCode}||${sanitizedFileName}|${totalPresupuesto.toFixed(2)}|${today}|0|`);

    // ~D raíz → partidas ───────────────────────────────────────────────────────
    if (partidas.length > 0) {
        writeLine(`~D|${budgetRootCode}`);
        partidas.forEach((p, i) => {
            const prefix = i === 0 ? '|' : '\\';
            writeLine(`${prefix}${p.codigo}\\\\${p.cantidad.toFixed(3)}`);
        });
        writeLine(`\\|`);
    }

    // ~C + ~T + (opcional) ~C componentes + ~D descomposición por partida ──────
    partidas.forEach((p) => {
        // ~C partida
        writeLine(`~C|${p.codigo}|${p.unidad}|${p.resumen}|${p.puFinal.toFixed(2)}|${today}|0|`);

        // ~T texto largo
        const cleanDesc = sanitizeBC3Text(p.descripcionLarga);
        if (cleanDesc && cleanDesc !== p.resumen && cleanDesc.length > p.resumen.length)
            writeLine(`~T|${p.codigo}|${cleanDesc}|`);

        // Si tiene descomposición: ~C de cada componente + ~D de la partida
        if (p.componentes.length > 0) {

            // ~C de cada componente (mano de obra, material, maquinaria…)
            p.componentes.forEach((comp) => {
                const codComp = sanitizeBC3Code(comp.componente_codigo);
                const resComp = sanitizeBC3Text(comp.componente_resumen);
                const unidComp = sanitizeBC3Text(comp.componente_unidad).substring(0, 8) || 'ud';
                const precComp = comp.componente_precio.toFixed(4);
                const tipoComp = tipoBC3(comp.componente_tipo);
                writeLine(`~C|${codComp}|${unidComp}|${resComp}|${precComp}|${today}|${tipoComp}|`);

                if (comp.componente_descripcion && comp.componente_descripcion !== comp.componente_resumen)
                    writeLine(`~T|${codComp}|${sanitizeBC3Text(comp.componente_descripcion)}|`);
            });

            // ~D partida → sus componentes con rendimiento
            writeLine(`~D|${p.codigo}`);
            p.componentes.forEach((comp, i) => {
                const codComp = sanitizeBC3Code(comp.componente_codigo);
                // Rendimiento: quitar ceros finales pero mantener al menos 3 decimales
                const rend = comp.rendimiento.toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
                const prefix = i === 0 ? '|' : '\\';
                writeLine(`${prefix}${codComp}\\\\${rend}`);
            });
            writeLine(`\\|`);
        }
    });

    // EOF ASCII-26 (Ctrl+Z) ────────────────────────────────────────────────────
    buffer.push(26);

    return new Uint8Array(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCARGA
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadBC3File(
    items: ComparisonItem[],
    fileName: string = 'Presupuesto',
    globalPercentage: number = 0
): Promise<void> {
    const binaryData = await generateBC3BinaryAsync(items, fileName, globalPercentage);
    const fullFileName = `${sanitizeBC3Text(fileName)}.bc3`;
    const blob = new Blob([binaryData as any], { type: 'application/octet-stream' });

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: fullFileName,
                types: [{ description: 'Archivo BC3 (FIEBDC-3)', accept: { 'application/x-bc3': ['.bc3'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.warn('Fallback a descarga directa:', err);
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Compatibilidad
export function validateBC3Compatibility(_items: ComparisonItem[]) {
    return { valid: true, errors: [], warnings: [] };
}
export function generateBC3Content(_i: ComparisonItem[], _f: string, _g: number) {
    return 'Use generateBC3BinaryAsync instead';
}
