import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import { Partida } from '../types';
import { parseBC3Full, parseBC3WithDescomp, tipoBC3ToInterno } from '../utils/bc3Parser';

// ─────────────────────────────────────────────────────────────────────────────
// PARSER EXCEL (mantenido igual que el original)
// ─────────────────────────────────────────────────────────────────────────────

function parseExcelData(rows: any[][]): Partida[] {
    const partidas: Partida[] = [];
    let currentCategory = 'General';
    let startRow = 0;

    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const row = rows[i];
        if (row && row[0] === 'Código' && row[1] === 'Nat') {
            startRow = i + 1;
            break;
        }
    }
    if (startRow === 0 && rows.length > 5) startRow = 3;

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const codigo = row[0];
        const nat = row[1];

        if (nat === 'Capítulo') {
            const catName = row[3];
            if (catName && typeof catName === 'string') currentCategory = catName.trim();
            continue;
        }

        if (nat === 'Partida' || (codigo && typeof codigo === 'string' && codigo.includes('.'))) {
            const unidad = row[2];
            let descripcion = row[3];
            const precioUnitario = parseFloat(row[5]);

            if (i + 1 < rows.length) {
                const nextRow = rows[i + 1];
                if (!nextRow[0] && !nextRow[1] && nextRow[3]) {
                    const ext = nextRow[3];
                    if (typeof ext === 'string') {
                        descripcion = ext.length > (descripcion?.length || 0)
                            ? ext
                            : `${descripcion} ${ext}`;
                    }
                }
            }

            if (codigo && descripcion && !isNaN(precioUnitario)) {
                partidas.push({
                    id: `excel_${i}`,
                    codigo: String(codigo).trim(),
                    descripcion: typeof descripcion === 'string' ? descripcion.trim() : String(descripcion),
                    categoria: currentCategory,
                    unidad: unidad || '',
                    precioUnitario,
                });
            }
        }
    }

    return partidas;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER CSV
// ─────────────────────────────────────────────────────────────────────────────

function parseCSVData(text: string): Partida[] {
    const partidas: Partida[] = [];
    const firstLine = text.split('\n')[0] || '';
    const sep = firstLine.includes(';') ? ';' : ',';

    const rows = text.split('\n').map(line =>
        line.split(sep).map(cell => cell.replace(/^"|"$/g, '').trim())
    ).filter(r => r.some(c => c));

    if (rows.length < 2) return partidas;

    const header = rows[0].map(h =>
        h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const idx = (terms: string[]) => {
        for (const t of terms) {
            const i = header.findIndex(h => h.includes(t));
            if (i !== -1) return i;
        }
        return -1;
    };

    const iCodigo = idx(['codigo', 'code', 'ref']) !== -1 ? idx(['codigo', 'code', 'ref']) : 0;
    const iDescripcion = idx(['descripcion', 'resumen', 'desc']) !== -1 ? idx(['descripcion', 'resumen', 'desc']) : 1;
    const iCategoria = idx(['categoria', 'capitulo', 'chapter']);
    const iUnidad = idx(['unidad', 'ud', 'unit']) !== -1 ? idx(['unidad', 'ud', 'unit']) : 2;
    const iPrecio = idx(['precio', 'price', 'coste', 'importe']) !== -1 ? idx(['precio', 'price', 'coste', 'importe']) : 3;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const codigo = row[iCodigo]?.trim();
        const descripcion = row[iDescripcion]?.trim();
        const categoria = iCategoria !== -1 ? row[iCategoria]?.trim() : 'General';
        const unidad = row[iUnidad]?.trim() || 'ud';
        const precio = parseFloat((row[iPrecio] || '0').replace(',', '.'));

        if (!codigo || !descripcion || isNaN(precio)) continue;

        partidas.push({
            id: `csv_${i}`,
            codigo,
            descripcion,
            categoria: categoria || 'General',
            unidad,
            precioUnitario: precio,
        });
    }

    return partidas;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

const ImportDatabase: React.FC = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'excel' | 'bc3' | 'csv' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<Partida[]>([]);
    const [bc3Cache, setBc3Cache] = useState<{ descomposicion: Map<string, any[]>; conceptos: Map<string, any> } | null>(null);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const detectType = (name: string): 'excel' | 'bc3' | 'csv' => {
        const ext = name.split('.').pop()?.toLowerCase();
        if (ext === 'bc3') return 'bc3';
        if (ext === 'csv') return 'csv';
        return 'excel';
    };

    const resetState = () => {
        setFile(null); setFileType(null); setPreviewData([]);
        setSuccess(false); setError(null);
        setUploadProgress({ current: 0, total: 0 });
        setBc3Cache(null);
    };

    const processFile = (f: File, tipo: 'excel' | 'bc3' | 'csv') => {
        setIsProcessing(true);
        setError(null);
        setPreviewData([]);
        const reader = new FileReader();

        const onError = () => { setError('Error al leer el archivo.'); setIsProcessing(false); };
        reader.onerror = onError;

        if (tipo === 'bc3') {
            reader.onload = (e) => {
                try {
                    const result = parseBC3WithDescomp(e.target!.result as ArrayBuffer);
                    if (!result.partidas.length) setError('No se encontraron partidas con precio en el BC3.');
                    else {
                        setPreviewData(result.partidas as Partida[]);
                        setBc3Cache({ descomposicion: result.descomposicion, conceptos: result.conceptos });
                    }
                } catch (err: any) {
                    setError(`Error al procesar BC3: ${err.message}`);
                } finally { setIsProcessing(false); }
            };
            reader.readAsArrayBuffer(f);

        } else if (tipo === 'csv') {
            reader.onload = (e) => {
                try {
                    const partidas = parseCSVData(e.target!.result as string);
                    if (!partidas.length) setError('No se encontraron filas válidas en el CSV.');
                    else setPreviewData(partidas);
                } catch (err: any) {
                    setError(`Error al procesar CSV: ${err.message}`);
                } finally { setIsProcessing(false); }
            };
            reader.readAsText(f, 'UTF-8');

        } else {
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target!.result, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                    const partidas = parseExcelData(rows);
                    if (!partidas.length) setError('No se encontraron partidas válidas en el Excel.');
                    else setPreviewData(partidas);
                } catch { setError('Error al leer el Excel.'); }
                finally { setIsProcessing(false); }
            };
            reader.readAsBinaryString(f);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const tipo = detectType(f.name);
        setFile(f); setFileType(tipo); setSuccess(false);
        processFile(f, tipo);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        const tipo = detectType(f.name);
        setFile(f); setFileType(tipo); setSuccess(false);
        processFile(f, tipo);
    };

    const handleUploadToSupabase = async () => {
        if (!previewData.length) return;
        setIsProcessing(true);

        const uniqueData = Array.from(
            new Map(previewData.map(item => [item.codigo, item])).values()
        );
        setUploadProgress({ current: 0, total: uniqueData.length });
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const BATCH = 50;
            let done = 0;

            // ── 1. Guardar partidas ────────────────────────────────────────
            for (let i = 0; i < uniqueData.length; i += BATCH) {
                const batch = uniqueData.slice(i, i + BATCH).map(p => ({
                    codigo: p.codigo,
                    resumen: (p as any).resumen || '',
                    descripcion: p.descripcion,
                    categoria: p.categoria,
                    unidad: p.unidad,
                    precio_unitario: p.precioUnitario,
                    user_id: user.id,
                }));

                const { error: err } = await supabase
                    .from('partidas')
                    .upsert(batch as any, { onConflict: 'user_id, codigo' });

                if (err) throw err;
                done += batch.length;
                setUploadProgress({ current: Math.min(done, uniqueData.length), total: uniqueData.length });
            }

            // ── 2. Guardar descomposición BC3 ──────────────────────────────
            if (fileType === 'bc3' && bc3Cache && bc3Cache.descomposicion.size > 0) {
                const codigosConDescomp = Array.from(bc3Cache.descomposicion.keys());

                // Borrar descomposición anterior
                await supabase
                    .from('partidas_descomposicion')
                    .delete()
                    .eq('user_id', user.id)
                    .in('partida_codigo', codigosConDescomp);

                const filasDescomp: any[] = [];
                bc3Cache.descomposicion.forEach((componentes, codigoPartida) => {
                    for (const comp of componentes) {
                        const concepto = bc3Cache.conceptos.get(comp.codigoHijo);
                        if (!concepto) continue;
                        filasDescomp.push({
                            partida_codigo: codigoPartida,
                            user_id: user.id,
                            componente_codigo: comp.codigoHijo,
                            componente_tipo: tipoBC3ToInterno(concepto.tipo),
                            componente_unidad: concepto.unidad || 'ud',
                            componente_resumen: concepto.resumen || '',
                            componente_descripcion: concepto.descripcion || concepto.resumen || '',
                            componente_precio: concepto.precio,
                            rendimiento: comp.rendimiento,
                        });
                    }
                });

                for (let i = 0; i < filasDescomp.length; i += BATCH) {
                    const batch = filasDescomp.slice(i, i + BATCH);
                    const { error: errD } = await supabase
                        .from('partidas_descomposicion')
                        .insert(batch as any);
                    if (errD) console.warn('Error guardando descomposición:', errD.message);
                }
            }

            setSuccess(true);

            (supabase as any).from('activity_log').insert({
                user_id: user.id,
                action: `importó ${uniqueData.length} partidas desde "${file?.name}" (${fileType?.toUpperCase()})`,
                type: 'Info',
            });

        } catch (err: any) {
            setError(`Error al guardar: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Badge formato
    const typeMeta: Record<string, { label: string; color: string; icon: string }> = {
        bc3: { label: 'BC3', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: 'architecture' },
        excel: { label: 'Excel', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: 'table_chart' },
        csv: { label: 'CSV', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: 'text_snippet' },
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 font-sans p-8">
            <div className="max-w-4xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/detalles')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Importar Base de Datos</h1>
                        <p className="text-slate-500 text-sm">Sube tu archivo con partidas y precios</p>
                    </div>
                </div>

                {!success ? (
                    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 p-8">

                        {/* Formatos soportados */}
                        <div className="flex gap-2 mb-6 flex-wrap">
                            {[
                                { label: 'BC3 / FIEBDC', icon: 'architecture' },
                                { label: 'Excel (.xlsx)', icon: 'table_chart' },
                                { label: 'CSV', icon: 'text_snippet' },
                            ].map((fmt, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                                    <span className="material-symbols-outlined text-sm">{fmt.icon}</span>
                                    {fmt.label}
                                </span>
                            ))}
                        </div>

                        {!file ? (
                            /* ── Drop zone ── */
                            <div
                                className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".xlsx,.xls,.bc3,.csv"
                                    className="hidden"
                                />
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-4xl">upload_file</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Arrastra tu archivo aquí</h3>
                                <p className="text-slate-400 text-sm max-w-sm">
                                    o haz clic para explorar. Soporta <strong>BC3</strong>, <strong>Excel</strong> y <strong>CSV</strong>
                                </p>
                            </div>
                        ) : (
                            <div>
                                {/* Info archivo */}
                                <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                                            <span className="material-symbols-outlined">description</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                                                {fileType && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${typeMeta[fileType].color}`}>
                                                        <span className="material-symbols-outlined text-sm">{typeMeta[fileType].icon}</span>
                                                        {typeMeta[fileType].label}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button onClick={resetState} className="text-slate-400 hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {/* Spinner análisis */}
                                {isProcessing && uploadProgress.total === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-slate-500 text-sm font-medium">
                                            {fileType === 'bc3' ? 'Procesando archivo BC3...' : 'Analizando archivo...'}
                                        </p>
                                    </div>
                                )}

                                {/* Barra progreso subida */}
                                {isProcessing && uploadProgress.total > 0 && (
                                    <div className="mb-6">
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                                            <span>Subiendo partidas...</span>
                                            <span className="font-bold text-primary">{uploadProgress.current} / {uploadProgress.total}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Vista previa */}
                                {previewData.length > 0 && !isProcessing && (
                                    <div className="fade-in">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white">
                                                Vista Previa
                                                <span className="text-slate-400 font-normal ml-2">({previewData.length} partidas)</span>
                                            </h3>
                                            <button
                                                onClick={handleUploadToSupabase}
                                                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 text-sm transition-all flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                                                Guardar en Base de Datos
                                            </button>
                                        </div>

                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold">Código</th>
                                                        <th className="px-4 py-3 font-bold">Categoría</th>
                                                        <th className="px-4 py-3 font-bold">Descripción</th>
                                                        <th className="px-4 py-3 font-bold">Ud</th>
                                                        <th className="px-4 py-3 font-bold text-right">Precio</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {previewData.slice(0, 50).map((row, idx) => (
                                                        <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.codigo}</td>
                                                            <td className="px-4 py-3 text-xs font-bold text-primary whitespace-nowrap max-w-[120px] truncate">{row.categoria}</td>
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={row.descripcion}>{row.descripcion}</td>
                                                            <td className="px-4 py-3 text-xs text-slate-500">{row.unidad}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{row.precioUnitario.toFixed(2)} €</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {previewData.length > 50 && (
                                                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                                    ... y {previewData.length - 50} partidas más
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium flex items-center gap-3">
                                        <span className="material-symbols-outlined flex-shrink-0">error</span>
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Éxito ── */
                    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center text-center fade-in">
                        <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <span className="material-symbols-outlined text-6xl">check</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Importación Exitosa!</h2>
                        <p className="text-slate-500 mb-2 max-w-md">
                            Se han guardado <strong>{previewData.length}</strong> partidas en tu base de datos.
                        </p>
                        <p className="text-slate-400 text-sm mb-8">
                            Archivo: <span className="font-medium">{file?.name}</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={resetState}
                                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Importar otro archivo
                            </button>
                            <button
                                onClick={() => navigate('/detalles')}
                                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xl"
                            >
                                Ir a Comparador
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportDatabase;
