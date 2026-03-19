/**
 * Parser BC3 (FIEBDC-3) reutilizable
 * Extraído de ImportDatabase.tsx para uso compartido
 */

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface BC3Concepto {
    codigo: string;
    unidad: string;
    resumen: string;
    descripcion: string;
    precio: number;
    tipo: string;
}

export interface BC3Partida {
    id: string;
    codigo: string;
    resumen: string;
    descripcion: string;
    categoria: string;
    unidad: string;
    precioUnitario: number;
}

export interface BC3SimpleItem {
    resumen: string; // Resumen corto (~C)
    descripcion: string; // Descripción larga (~T)
    cantidad: number;
    codigo?: string;
    precio?: number;
}

// ─── Decodificador ANSI ──────────────────────────────────────────────────────

export function decodeANSI(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let raw = '';
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 26) break; // ASCII-26 = EOF
        raw += String.fromCharCode(bytes[i]);
    }
    try {
        return decodeURIComponent(escape(raw));
    } catch {
        return raw;
    }
}

// ─── Mapeo de tipos BC3 a interno ───────────────────────────────────────────
export function tipoBC3ToInterno(tipo: string): 'MO' | 'MAT' | 'MAQ' | 'CI' | 'AUX' {
    if (tipo === '1') return 'MO';
    if (tipo === '2') return 'MAQ';
    if (tipo === '3') return 'MAT';
    if (tipo === '%') return 'CI';
    return 'MAT'; // Default
}

// ─── Parser BC3 completo (para ImportDatabase) ───────────────────────────────

export function parseBC3Full(buffer: ArrayBuffer): BC3Partida[] {
    const raw = decodeANSI(buffer);
    const lineas = raw.split(/\r?\n/);

    const conceptos = new Map<string, BC3Concepto>();
    const descomposiciones = new Map<string, string[]>();
    const mediciones = new Map<string, number>();

    let dentroD = false;
    let codigoPadreActual = '';

    for (const linea of lineas) {
        const trimmed = linea.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('~C|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            if (!codigo) continue;
            const precio = parseFloat((campos[4] || '0').replace(',', '.')) || 0;
            conceptos.set(codigo, {
                codigo,
                unidad: (campos[2] || '').trim(),
                resumen: (campos[3] || '').trim(),
                descripcion: '',
                precio,
                tipo: (campos[6] || '0').trim(),
            });
            continue;
        }

        if (trimmed.startsWith('~T|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            const texto = (campos[2] || '').trim();
            if (codigo && conceptos.has(codigo)) {
                conceptos.get(codigo)!.descripcion = texto;
            }
            continue;
        }

        if (trimmed.startsWith('~M|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigoPadre = (campos[1] || '').trim();
            const medTotal = parseFloat((campos[3] || '0').replace(',', '.')) || 0;
            if (codigoPadre && medTotal > 0) {
                mediciones.set(codigoPadre, (mediciones.get(codigoPadre) || 0) + medTotal);
            }
            continue;
        }

        if (trimmed.startsWith('~D|')) {
            codigoPadreActual = trimmed.substring(3).replace(/\|.*$/, '').trim();
            dentroD = true;
            if (!descomposiciones.has(codigoPadreActual)) {
                descomposiciones.set(codigoPadreActual, []);
            }
            continue;
        }

        if (trimmed.startsWith('~')) {
            dentroD = false;
            codigoPadreActual = '';
            continue;
        }

        if (dentroD && codigoPadreActual) {
            if (trimmed === '\\|') {
                dentroD = false;
                codigoPadreActual = '';
                continue;
            }
            let contenido = trimmed;
            if (contenido.startsWith('|')) contenido = contenido.substring(1);
            else if (contenido.startsWith('\\')) contenido = contenido.substring(1);

            const codigoHijo = contenido.split('\\')[0].trim();
            if (codigoHijo && codigoHijo !== '|') {
                descomposiciones.get(codigoPadreActual)!.push(codigoHijo);
            }
        }
    }

    const todosLosHijos = new Set<string>();
    descomposiciones.forEach(hijos => hijos.forEach(h => todosLosHijos.add(h)));
    const conceptosRaiz = [...descomposiciones.keys()].filter(p => !todosLosHijos.has(p));
    const categoriaDePartida = new Map<string, string>();

    const recorrer = (codigoPadre: string, categoriaActual: string) => {
        const hijos = descomposiciones.get(codigoPadre) || [];
        for (const hijo of hijos) {
            const concept = conceptos.get(hijo);
            if (!concept) continue;

            const tipo = concept.tipo;
            const esCapitulo = hijo.includes('#');

            // CRITERIO: Si es partida (tipo 0) y NO es capítulo, la añadimos a la lista maestra y PARAMOS
            if (tipo === '0' && !esCapitulo) {
                categoriaDePartida.set(hijo, categoriaActual);
            } else if (esCapitulo || descomposiciones.has(hijo)) {
                // Es capítulo o subcapítulo, seguir bajando
                const nombreCap = concept.resumen || hijo;
                recorrer(hijo, nombreCap);
            }
            // Los componentes (tipo 1,2,3) o elementos sin tipo '0' se ignoran para la lista de partidas
        }
    };

    for (const raiz of conceptosRaiz) {
        const hijos = descomposiciones.get(raiz) || [];
        for (const hijo of hijos) {
            const nombreCap = conceptos.get(hijo)?.resumen || hijo;
            if (descomposiciones.has(hijo)) {
                recorrer(hijo, nombreCap);
            } else {
                categoriaDePartida.set(hijo, nombreCap);
            }
        }
    }

    const partidas: BC3Partida[] = [];
    const procesados = new Set<string>();
    const TIPOS_COMPONENTE = new Set(['1', '2', '3', '%']);

    categoriaDePartida.forEach((categoria, codigo) => {
        if (procesados.has(codigo)) return;
        const c = conceptos.get(codigo);
        if (!c || c.precio <= 0) return;

        // FILTRO: Solo partidas (tipo 0) y que no sean capítulos (#)
        if (c.tipo !== '0' || codigo.includes('#')) return;
        if (TIPOS_COMPONENTE.has(c.tipo)) return;

        procesados.add(codigo);
        partidas.push({
            id: `bc3_${codigo}`,
            codigo,
            resumen: c.resumen,
            descripcion: c.descripcion || c.resumen,
            categoria: categoria || 'Sin categoría',
            unidad: c.unidad || 'ud',
            precioUnitario: c.precio,
        });
    });

    return partidas;
}

export function parseBC3WithDescomp(buffer: ArrayBuffer): {
    partidas: BC3Partida[];
    descomposicion: Map<string, any[]>;
    conceptos: Map<string, BC3Concepto>;
} {
    const raw = decodeANSI(buffer);
    const lineas = raw.split(/\r?\n/);

    const conceptos = new Map<string, BC3Concepto>();
    const descomposiciones = new Map<string, string[]>();
    const mediciones = new Map<string, number>();

    let dentroD = false;
    let codigoPadreActual = '';

    for (const linea of lineas) {
        const trimmed = linea.trim();
        if (!trimmed) continue;

        // ── Registro ~C ─────────────────────────────────────────────────────
        if (trimmed.startsWith('~C|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            if (!codigo) continue;
            const precio = parseFloat((campos[4] || '0').replace(',', '.')) || 0;
            conceptos.set(codigo, {
                codigo,
                unidad: (campos[2] || '').trim(),
                resumen: (campos[3] || '').trim(),
                descripcion: '',
                precio,
                tipo: (campos[6] || '0').trim(),
            });
            continue;
        }

        // ── Registro ~T ─────────────────────────────────────────────────────
        if (trimmed.startsWith('~T|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            const texto = (campos[2] || '').trim();
            if (codigo && conceptos.has(codigo)) {
                conceptos.get(codigo)!.descripcion = texto;
            }
            continue;
        }

        // ── Registro ~M (mediciones) ────────────────────────────────────────
        if (trimmed.startsWith('~M|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigoPadre = (campos[1] || '').trim();
            // Buscar la medición total en los campos restantes
            // Formato: ~M|codigoPadre|posicion|medicionTotal|...
            // O puede tener líneas de medición detalladas
            const medTotal = parseFloat((campos[3] || '0').replace(',', '.')) || 0;
            if (codigoPadre && medTotal > 0) {
                mediciones.set(codigoPadre, (mediciones.get(codigoPadre) || 0) + medTotal);
            }
            continue;
        }

        // ── Registro ~D (inicio) ────────────────────────────────────────────
        if (trimmed.startsWith('~D|')) {
            codigoPadreActual = trimmed.substring(3).replace(/\|.*$/, '').trim();
            dentroD = true;
            if (!descomposiciones.has(codigoPadreActual)) {
                descomposiciones.set(codigoPadreActual, []);
            }
            continue;
        }

        // ── Cualquier otro ~ cierra el ~D activo ────────────────────────────
        if (trimmed.startsWith('~')) {
            dentroD = false;
            codigoPadreActual = '';
            continue;
        }

        // ── Líneas de hijos dentro de ~D ────────────────────────────────────
        if (dentroD && codigoPadreActual) {
            if (trimmed === '\\|') {
                dentroD = false;
                codigoPadreActual = '';
                continue;
            }
            let contenido = trimmed;
            if (contenido.startsWith('|')) contenido = contenido.substring(1);
            else if (contenido.startsWith('\\')) contenido = contenido.substring(1);

            const partes = contenido.split('\\');
            const codigoHijo = partes[0].trim();
            const rendimiento = parseFloat((partes[2] || '1').replace(',', '.')) || 1;

            if (codigoHijo && codigoHijo !== '|') {
                descomposiciones.get(codigoPadreActual)!.push({
                    codigoHijo,
                    rendimiento
                } as any);
            }
        }
    }

    // ── Resolver jerarquía y asignar categorías ─────────────────────────────
    const todosLosHijos = new Set<string>();
    descomposiciones.forEach(hijos => hijos.forEach((h: any) => todosLosHijos.add(h.codigoHijo)));

    const conceptosRaiz = [...descomposiciones.keys()].filter(p => !todosLosHijos.has(p));

    const categoriaDePartida = new Map<string, string>();

    const recorrer = (codigoPadre: string, categoriaActual: string) => {
        const hijos = descomposiciones.get(codigoPadre) || [];
        for (const hijoObj of hijos) {
            const hijo = (hijoObj as any).codigoHijo;
            const concept = conceptos.get(hijo);
            if (!concept) continue;

            const tipo = concept.tipo;
            const esCapitulo = hijo.includes('#');

            // CRITERIO: Si es partida (tipo 0) y NO es capítulo, la añadimos a la lista maestra y PARAMOS
            if (tipo === '0' && !esCapitulo) {
                categoriaDePartida.set(hijo, categoriaActual);
            } else if (esCapitulo || descomposiciones.has(hijo)) {
                // Es capítulo o subcapítulo, seguir bajando
                const nombreCap = concept.resumen || hijo;
                recorrer(hijo, nombreCap);
            }
            // Los componentes (tipo 1,2,3) o elementos sin tipo '0' se ignoran para la lista de partidas
        }
    };

    for (const raiz of conceptosRaiz) {
        const hijos = descomposiciones.get(raiz) || [];
        for (const hijoObj of hijos) {
            const hijo = (hijoObj as any).codigoHijo;
            const nombreCap = conceptos.get(hijo)?.resumen || hijo;
            if (descomposiciones.has(hijo)) {
                recorrer(hijo, nombreCap);
            } else {
                categoriaDePartida.set(hijo, nombreCap);
            }
        }
    }

    // ── Construir Partidas ──────────────────────────────────────────────────
    const partidas: BC3Partida[] = [];
    const procesados = new Set<string>();
    const TIPOS_COMPONENTE = new Set(['1', '2', '3', '%']);

    categoriaDePartida.forEach((categoria, codigo) => {
        if (procesados.has(codigo)) return;
        const c = conceptos.get(codigo);
        if (!c || c.precio <= 0) return;

        // FILTRO: Solo partidas (tipo 0) y que no sean capítulos (#)
        if (c.tipo !== '0' || codigo.includes('#')) return;
        if (TIPOS_COMPONENTE.has(c.tipo)) return;

        procesados.add(codigo);
        partidas.push({
            id: `bc3_${codigo}`,
            codigo,
            resumen: c.resumen,
            descripcion: c.descripcion || c.resumen,
            categoria: categoria || 'Sin categoría',
            unidad: c.unidad || 'ud',
            precioUnitario: c.precio,
        });
    });

    return {
        partidas,
        descomposicion: descomposiciones,
        conceptos
    };
}

// ─── Parser BC3 simplificado (para ImportSimple) ─────────────────────────────
// Devuelve { descripcion, cantidad } que es lo que ImportSummary espera

export function parseBC3Simple(buffer: ArrayBuffer): BC3SimpleItem[] {
    const raw = decodeANSI(buffer);
    const lineas = raw.split(/\r?\n/);

    const conceptos = new Map<string, BC3Concepto>();
    const descomposiciones = new Map<string, { codigo: string; factor: number }[]>();
    const mediciones = new Map<string, number>();

    let dentroD = false;
    let codigoPadreActual = '';

    for (const linea of lineas) {
        const trimmed = linea.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('~C|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            if (!codigo) continue;
            const precio = parseFloat((campos[4] || '0').replace(',', '.')) || 0;
            conceptos.set(codigo, {
                codigo,
                unidad: (campos[2] || '').trim(),
                resumen: (campos[3] || '').trim(),
                descripcion: '',
                precio,
                tipo: (campos[6] || '0').trim(),
            });
            continue;
        }

        if (trimmed.startsWith('~T|')) {
            dentroD = false;
            const campos = trimmed.substring(2).split('|');
            const codigo = (campos[1] || '').trim();
            const texto = (campos[2] || '').trim();
            if (codigo && conceptos.has(codigo)) {
                conceptos.get(codigo)!.descripcion = texto;
            }
            continue;
        }

        if (trimmed.startsWith('~M|')) {
            dentroD = false;
            const sinTilde = trimmed.substring(3);
            const partes = sinTilde.split('|');
            const primerCampo = (partes[0] || '');
            const subCampos = primerCampo.split('\\');
            const padre = subCampos[0]?.trim() || '';
            const hijo = subCampos[1]?.trim() || '';

            let medTotal = 0;
            // Buscar medicion total en los campos restantes
            for (let fi = 1; fi < partes.length; fi++) {
                const val = parseFloat((partes[fi] || '').replace(',', '.'));
                if (!isNaN(val) && val > 0) {
                    medTotal = val;
                }
            }

            if (padre && hijo && medTotal > 0) {
                mediciones.set(`${padre}\\${hijo}`, medTotal);
            } else if (padre && medTotal > 0) {
                mediciones.set(padre, medTotal);
            }
            continue;
        }

        if (trimmed.startsWith('~D|')) {
            const sinTilde = trimmed.substring(3);
            const partes = sinTilde.split('|');
            codigoPadreActual = (partes[0] || '').trim();
            dentroD = true;
            if (!descomposiciones.has(codigoPadreActual)) {
                descomposiciones.set(codigoPadreActual, []);
            }

            const hijosStr = partes[1] || '';
            if (hijosStr) {
                const hijoParts = hijosStr.split('\\');
                for (let hi = 0; hi < hijoParts.length; hi += 2) {
                    const c = hijoParts[hi]?.trim();
                    const f = parseFloat((hijoParts[hi + 1] || '1').replace(',', '.')) || 0;
                    if (c) descomposiciones.get(codigoPadreActual)!.push({ codigo: c, factor: f });
                }
            }
            continue;
        }

        if (trimmed.startsWith('~')) {
            dentroD = false;
            codigoPadreActual = '';
            continue;
        }

        if (dentroD && codigoPadreActual) {
            let content = trimmed;
            if (content.startsWith('|')) content = content.substring(1);
            else if (content.startsWith('\\')) content = content.substring(1);

            const parts = content.split('\\');
            for (let hi = 0; hi < parts.length; hi += 2) {
                const c = parts[hi]?.trim();
                const f = parseFloat((parts[hi + 1] || '1').replace(',', '.')) || 0;
                if (c && c !== '|') {
                    descomposiciones.get(codigoPadreActual)!.push({ codigo: c, factor: f });
                }
            }
        }
    }

    const TIPOS_COMPONENTE = new Set(['1', '2', '3', '%']);
    const resultados = new Map<string, BC3SimpleItem>();

    const todosLosHijos = new Set<string>();
    descomposiciones.forEach(h => h.forEach(item => todosLosHijos.add(item.codigo)));
    const raices = [...descomposiciones.keys()].filter(id => !todosLosHijos.has(id));

    const recorrerRecursivo = (padre: string, factorPadre: number = 1) => {
        const hijos = descomposiciones.get(padre) || [];
        for (const { codigo: hijo, factor: factorHijo } of hijos) {
            const concept = conceptos.get(hijo);
            if (!concept) continue;

            const tipo = concept.tipo;
            if (TIPOS_COMPONENTE.has(tipo)) continue;

            // DETERMINAR CANTIDAD: Prioridad Medición (~M clave padre\hijo) -> Factor Acumulado
            const medCompuesta = mediciones.get(`${padre}\\${hijo}`);
            const medSimple = mediciones.get(hijo);
            const q = medCompuesta !== undefined ? medCompuesta : (medSimple !== undefined ? medSimple : (factorHijo * factorPadre));

            // CRITERIO: Solo es partida final si tipo === '0' Y NO tiene '#' (no es capítulo)
            const esCapitulo = hijo.includes('#');

            if (tipo === '0' && !esCapitulo) {
                const existing = resultados.get(hijo);
                if (existing) {
                    existing.cantidad += q;
                } else {
                    resultados.set(hijo, {
                        resumen: concept.resumen,
                        descripcion: concept.descripcion || concept.resumen,
                        cantidad: q,
                        codigo: hijo,
                        precio: concept.precio
                    });
                }
                // Paramos aquí porque es una partida real; sus hijos serán componentes MO/MAT
            } else {
                // Es capítulo (tiene #) o nodo intermedio sin tipo '0' -> Recurrir
                recorrerRecursivo(hijo, q);
            }
        }
    };

    raices.forEach(raiz => recorrerRecursivo(raiz, 1));

    // Fallback: si no se encontró nada por jerarquía, extraer partidas tipo '0' sueltas
    if (resultados.size === 0) {
        conceptos.forEach((c, codigo) => {
            if (c.tipo === '0' && !codigo.includes('#') && (c.resumen || c.descripcion)) {
                resultados.set(codigo, {
                    resumen: c.resumen,
                    descripcion: c.descripcion || c.resumen,
                    cantidad: mediciones.get(codigo) || 1,
                    codigo,
                    precio: c.precio
                });
            }
        });
    }

    return Array.from(resultados.values());
}
