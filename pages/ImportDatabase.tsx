
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import { Partida } from '../types';

const ImportDatabase: React.FC = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<Partida[]>([]);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Mapeo de columnas basado en el análisis del Excel
    // Row 2: ["Código","Nat","Ud","Resumen","CanPres","PrPres","ImpPres"]
    // Indices: 0: Código, 1: Nat, 2: Ud, 3: Resumen, 4: CanPres, 5: PrPres, 6: ImpPres

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            parseExcel(selectedFile);
        }
    };

    const parseExcel = async (file: File) => {
        setIsProcessing(true);
        setPreviewData([]);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                processRows(jsonData as any[]);
            } catch (err) {
                setError('Error al leer el archivo. Asegúrate de que es un Excel válido.');
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            setError('Error al leer el archivo.');
            setIsProcessing(false);
        };
        reader.readAsBinaryString(file);
    };

    const processRows = (rows: any[]) => {
        const partidas: Partida[] = [];
        let currentCategory = 'General';
        let rowIndex = 0;

        // Buscar la fila de cabecera para empezar después
        let startRow = 0;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            if (row && row[0] === 'Código' && row[1] === 'Nat') {
                startRow = i + 1;
                break;
            }
        }

        if (startRow === 0 && rows.length > 5) {
            // Fallback si no encuentra cabecera exacta, intentar empezar desde la fila 3
            startRow = 3;
        }

        for (let i = startRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const codigo = row[0];
            const nat = row[1]; // Naturaleza: Capítulo o Partida

            // Detección de Capítulo (Categoría)
            if (nat === 'Capítulo') {
                // La descripción del capítulo suele estar en la columna 3 ('Resumen')
                const catName = row[3];
                if (catName && typeof catName === 'string') {
                    currentCategory = catName.trim();
                }
                continue;
            }

            // Procesamiento de Partida
            if (nat === 'Partida' || (codigo && typeof codigo === 'string' && codigo.includes('.'))) {
                const unidad = row[2];
                let descripcion = row[3];
                const precioUnitario = parseFloat(row[5]);

                // Buscar descripción extendida en la siguiente fila
                // A veces la descripción larga está en la fila siguiente, celdas vacías al principio
                if (i + 1 < rows.length) {
                    const nextRow = rows[i + 1];
                    // Si la siguiente fila no tiene código ni naturaleza, pero tiene texto en col 3, es descripción
                    if ((!nextRow[0] && !nextRow[1]) && nextRow[3]) {
                        const extendedDesc = nextRow[3];
                        // A veces la descripción corta es igual al inicio de la larga
                        if (extendedDesc && typeof extendedDesc === 'string') {
                            // Usar la descripción larga si es más detallada
                            if (extendedDesc.length > (descripcion?.length || 0)) {
                                descripcion = extendedDesc;
                            } else {
                                descripcion = `${descripcion} ${extendedDesc}`;
                            }
                        }
                        // Saltar la siguiente fila ya que la consumimos
                        // i++; // Comentado para ser seguros, mejor procesar y descartar si es necesario
                    }
                }

                if (codigo && descripcion && !isNaN(precioUnitario)) {
                    partidas.push({
                        id: `imported_${i}`, // ID temporal
                        codigo: String(codigo).trim(),
                        descripcion: typeof descripcion === 'string' ? descripcion.trim() : String(descripcion),
                        categoria: currentCategory,
                        unidad: unidad || '',
                        precioUnitario: precioUnitario
                    });
                }
            }
        }

        if (partidas.length === 0) {
            setError('No se encontraron partidas válidas. Revisa el formato del archivo.');
        } else {
            setPreviewData(partidas);
        }
        setIsProcessing(false);
    };

    const handleUploadToSupabase = async () => {
        if (previewData.length === 0) return;

        setIsProcessing(true);
        // Deduplicar previewData por código (último gana)
        const uniquePreviewData = Array.from(
            new Map(previewData.map(item => [item.codigo, item])).values()
        );

        setUploadProgress({ current: 0, total: uniquePreviewData.length });
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const total = uniquePreviewData.length;
            let uploaded = 0;
            const BATCH_SIZE = 50;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = uniquePreviewData.slice(i, i + BATCH_SIZE).map(p => ({
                    codigo: p.codigo,
                    descripcion: p.descripcion,
                    categoria: p.categoria,
                    unidad: p.unidad,
                    precio_unitario: p.precioUnitario,
                    user_id: user.id
                }));

                const { error: uploadError } = await supabase
                    .from('partidas')
                    .upsert(batch as any, {
                        onConflict: 'user_id, codigo'
                    });

                if (uploadError) throw uploadError;

                uploaded += batch.length;
                setUploadProgress({ current: Math.min(uploaded, total), total });
            }

            setSuccess(true);

            // Log activity
            (supabase as any).from('activity_log').insert({
                user_id: user.id,
                action: `importó ${uniquePreviewData.length} partidas desde el archivo "${file.name}"`,
                type: 'Info'
            });

        } catch (err: any) {
            console.error('Error uploading:', err);
            setError(`Error al guardar en base de datos: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 font-sans p-8">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/detalles')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Importar Base de Datos</h1>
                        <p className="text-slate-500 text-sm">Sube tu Excel con partidas y precios</p>
                    </div>
                </div>

                {!success ? (
                    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden p-8">

                        {!file ? (
                            <div
                                className="border-3 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                />
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-4xl">upload_file</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sube tu archivo Excel</h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                    Arrastra tu archivo aquí o haz clic para explorar. Formato esperado: Codigo, Nat, Ud, Resumen, PrPres...
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                                            <span className="material-symbols-outlined">description</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setFile(null); setPreviewData([]); setSuccess(false); }}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {isProcessing && uploadProgress.total === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-slate-500 text-sm font-medium">Analizando archivo...</p>
                                    </div>
                                )}

                                {previewData.length > 0 && !success && (
                                    <div className="fade-in">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white">Vista Previa <span className="text-slate-400 font-normal ml-2">({previewData.length} partidas encontradas)</span></h3>
                                            {isProcessing ? (
                                                <div className="text-xs font-bold text-primary">
                                                    Subiendo... {uploadProgress.current} / {uploadProgress.total}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleUploadToSupabase}
                                                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 text-sm transition-all flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-lg">cloud_upload</span>
                                                    Guardar en Base de Datos
                                                </button>
                                            )}
                                        </div>

                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold">Código</th>
                                                        <th className="px-4 py-3 font-bold">Categoría</th>
                                                        <th className="px-4 py-3 font-bold">Descripción</th>
                                                        <th className="px-4 py-3 font-bold text-right">Precio</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {previewData.slice(0, 50).map((row, idx) => (
                                                        <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.codigo}</td>
                                                            <td className="px-4 py-3 text-xs font-bold text-primary">{row.categoria}</td>
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-md truncate" title={row.descripcion}>
                                                                {row.descripcion}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                                                {row.precioUnitario.toFixed(2)} €
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {previewData.length > 50 && (
                                                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                                    ... y {previewData.length - 50} más
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center text-center fade-in">
                        <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <span className="material-symbols-outlined text-6xl">check</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Importación Exitosa!</h2>
                        <p className="text-slate-500 mb-8 max-w-md">
                            Se han guardado {previewData.length} partidas en tu base de datos correctamente.
                        </p>
                        <button
                            onClick={() => navigate('/detalles')}
                            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl"
                        >
                            Ir a Comparador
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportDatabase;
