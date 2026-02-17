/**
 * Generador de archivos BC3 según estándar FIEBDC-3
 * Especificación: https://www.fiebdc.es
 * 
 * El formato BC3 (FIEBDC-3) es el estándar español para intercambio de presupuestos de construcción.
 * Es compatible con software profesional como Presto, Arquímedes, etc.
 * 
 * Características del formato:
 * - Encoding: ISO-8859-1 (Latin-1) - NO UTF-8
 * - Separador de campos: | (pipe)
 * - Separador de registros: \r\n (CRLF)
 * - Prefijo de registro: ~ (virgulilla) + letra identificadora
 */

import { ComparisonItem } from '../types';



// Mapa de caracteres comunes UTF-8 a ISO-8859-1 / Windows-1252
const ANSI_MAP: { [key: string]: number } = {
    '€': 128, '´': 180, '¨': 168, 'ñ': 241, 'Ñ': 209, 'á': 225, 'é': 233, 'í': 237, 'ó': 243, 'ú': 250,
    'Á': 193, 'É': 201, 'Í': 205, 'Ó': 211, 'Ú': 218, 'ü': 252, 'Ü': 220, 'º': 186, 'ª': 170, '¿': 191, '¡': 161
};

/**
 * Convierte un string de JS (UTF-16) a un Uint8Array en formato ISO-8859-1 (ANSI)
 * Los visores de BC3 profesionales requieren este formato y fallan con UTF-8.
 */
export function convertToISO88591(text: string): Uint8Array {
    // Normalizar a NFC para evitar que los acentos se separen de las letras
    const normalized = text.normalize('NFC');
    const bytes: number[] = [];

    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const code = normalized.charCodeAt(i);

        if (ANSI_MAP[char]) {
            bytes.push(ANSI_MAP[char]);
        } else if (code < 256) {
            bytes.push(code);
        } else {
            // Reemplazo de seguridad para caracteres no soportados
            bytes.push(63); // '?'
        }
    }
    return new Uint8Array(bytes);
}

export function sanitizeBC3Text(text: string): string {
    if (!text) return "";
    return text
        .replace(/\r?\n/g, ' ')      // Sin saltos de línea en campos individuales
        .replace(/\|/g, '/')          // Reemplazar tuberías (|) para no romper registros
        .replace(/~/g, '-')           // Reemplazar virgulillas (~) 
        .substring(0, 250)
        .trim();
}

/**
 * Extrae un resumen corto (tipo título) de una descripción larga.
 */
export function extractSummary(text: string): string {
    if (!text) return "";
    let clean = text.trim();
    if (clean.length <= 60) return clean;

    const parts = clean.split(/[.\n:]/);
    if (parts[0].length > 10 && parts[0].length < 100) {
        clean = parts[0].trim();
    } else {
        clean = clean.substring(0, 80);
        const lastSpace = clean.lastIndexOf(' ');
        if (lastSpace > 40) clean = clean.substring(0, lastSpace);
    }
    return clean.replace(/[,;:. ]+$/, '').trim();
}

/**
 * Valida que el presupuesto sea compatible para exportación BC3
 */
export function validateBC3Compatibility(items: ComparisonItem[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (items.length === 0) {
        errors.push('El presupuesto está vacío.');
        return { valid: false, errors, warnings };
    }
    return { valid: true, errors, warnings };
}

/**
 * Estructura optimizada para Presto, Arquímedes y Menfis.
 */
export function generateBC3Content(items: ComparisonItem[], fileName: string = 'Presupuesto', globalPercentage: number = 0): string {
    const lines: string[] = [];
    // Código raíz alfanumérico simple (evitamos caracteres especiales que marean a visores antiguos)
    const budgetRootCode = "C000";

    const dateObj = new Date();
    const today = dateObj.getDate().toString().padStart(2, '0') +
        (dateObj.getMonth() + 1).toString().padStart(2, '0') +
        dateObj.getFullYear().toString().slice(-2);

    const sanitizedFileName = sanitizeBC3Text(fileName);

    // 1. Registro ~V: Identificación (9 campos para máxima compatibilidad)
    // ~V|VERSIÓN|ORIGEN|FECHA|CÓDIGO|TÍTULO|MONEDA|IDIOMA/PAGINA|ENCODING|
    lines.push(`~V|FIEBDC-3/2016|ComparadorPresupuestos|${today}|${budgetRootCode}|${sanitizedFileName}|EUR|0|ANSI|`);

    // 2. Registro ~K: Configuración de decimales
    lines.push('~K|2|EUR|2|2|2|2|');

    let totalPresupuesto = 0;
    const conceptEntries: string[] = [];
    const decompositionEntries: string[] = [];
    const processedCodes = new Set<string>();

    items.forEach((item, idx) => {
        // Garantizar código único
        const baseCodigo = item.miPartida?.codigo ? sanitizeBC3Text(item.miPartida.codigo) : `P${String(idx + 1).padStart(5, '0')}`;
        let uniqueCodigo = baseCodigo;
        let suffix = 1;
        while (processedCodes.has(uniqueCodigo)) {
            uniqueCodigo = `${baseCodigo}-${suffix++}`;
        }
        processedCodes.add(uniqueCodigo);

        const rawDesc = item.clientePartida || "";
        const resumen = sanitizeBC3Text(extractSummary(rawDesc));
        const unidad = item.miPartida?.unidad || 'ud';

        // Lógica de cálculo idéntica a la UI
        const unitPriceBase = ((item.precioCoste || 0) * (1 + ((item.porcentaje || 0) / 100))) + (item.precioVenta || 0);
        const puFinal = Number((unitPriceBase * (1 + (globalPercentage / 100))).toFixed(2));
        const subtotal = Number((item.cantidad * puFinal).toFixed(2));

        totalPresupuesto += subtotal;

        // Registro ~C: Concepto (Partida)
        // El 7º campo '1' indica que es una partida (no un capítulo)
        conceptEntries.push(`~C|${uniqueCodigo}|${unidad}|${resumen}|${puFinal.toFixed(2)}||1|`);

        // Registro ~T: Texto descriptivo extendido
        if (rawDesc.length > resumen.length) {
            conceptEntries.push(`~T|${uniqueCodigo}|${sanitizeBC3Text(rawDesc)}|`);
        }

        // Registro ~D: Descomposición (Vínculo al presupuesto raíz)
        // ~D|PADRE|HIJO|CANTIDAD|FACTOR_PRECIO|FACTOR_INCREMENTO|TIPO_RENDIMIENTO|
        decompositionEntries.push(`~D|${budgetRootCode}|${uniqueCodigo}|${item.cantidad.toFixed(2)}|1|0|`);
    });

    // 3. Registro ~C: Cabecera del presupuesto (Capítulo Raíz / PROYECTO)
    // El 7º campo '0' indica que es el nodo raíz/capítulo
    lines.push(`~C|${budgetRootCode}||${sanitizedFileName}|${totalPresupuesto.toFixed(2)}||0|`);

    // 4. Añadir todos los conceptos y sus textos
    lines.push(...conceptEntries);

    // 5. Añadir jerarquía final
    lines.push(...decompositionEntries);

    const finalContent = lines.join('\r\n') + '\r\n';

    // Log para depuración en consola del navegador
    console.log('BC3 Generated Successfully. Structure Check:', {
        root: budgetRootCode,
        total: totalPresupuesto,
        items: items.length
    });

    return finalContent;
}

/**
 * Función principal para descarga del archivo BC3
 */
export async function downloadBC3File(items: ComparisonItem[], fileName: string = 'Presupuesto', globalPercentage: number = 0): Promise<void> {
    const bc3Content = generateBC3Content(items, fileName, globalPercentage);
    const blobData = convertToISO88591(bc3Content);

    // Usamos octet-stream para prevenir cualquier interferencia del navegador con el encoding binario
    const blob = new Blob([blobData as any], { type: 'application/octet-stream' });
    const fullFileName = `${sanitizeBC3Text(fileName)}.bc3`;

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: fullFileName,
                types: [{
                    description: 'Archivo BC3 (FIEBDC-3)',
                    accept: { 'application/x-bc3': ['.bc3'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blobData);
            await writable.close();
            return;
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.warn('Fallback a descarga tradicional por error en Picker:', err);
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
