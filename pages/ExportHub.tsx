
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ComparisonItem } from '../types';
import { downloadBC3File, validateBC3Compatibility, extractSummary } from '../utils/bc3Generator';

const ExportHub: React.FC = () => {
  const location = useLocation();

  // Claves de localStorage (deben coincidir con DetailedComparison.tsx)
  const STORAGE_KEY_ITEMS = 'comparador_items_actuales';
  const STORAGE_KEY_GP = 'comparador_global_percentage';
  const STORAGE_KEY_FILENAME = 'comparador_file_name';

  const items = useMemo(() => {
    const fromState = location.state?.items;
    if (fromState && Array.isArray(fromState) && fromState.length > 0) return fromState as ComparisonItem[];
    const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (saved) {
      try {
        return JSON.parse(saved) as ComparisonItem[];
      } catch (e) {
        console.error("Error parsing saved items in ExportHub", e);
      }
    }
    return [] as ComparisonItem[];
  }, [location.state]);

  const globalPercentage = useMemo(() => {
    const fromState = location.state?.globalPercentage;
    if (fromState !== undefined && fromState !== null) return Number(fromState);
    return Number(localStorage.getItem(STORAGE_KEY_GP)) || 0;
  }, [location.state]);

  const fileName = useMemo(() => {
    const fromState = location.state?.fileName;
    if (fromState) return fromState;
    return localStorage.getItem(STORAGE_KEY_FILENAME) || 'Presupuesto_Final';
  }, [location.state]);

  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  // Calcular cobertura real
  const coverage = useMemo(() => {
    if (items.length === 0) return 0;
    const matchedCount = items.filter(item => item.estado === 'COINCIDENTE').length;
    return Math.round((matchedCount / items.length) * 100);
  }, [items]);

  const budgetData = useMemo(() => {
    if (items.length === 0) return [];

    const data = items.map(item => {
      const unitPriceBase = ((item.precioCoste || 0) * (1 + ((item.porcentaje || 0) / 100))) + (item.precioVenta || 0);
      const realUnitPrice = Number((unitPriceBase * (1 + (globalPercentage / 100))).toFixed(2));
      const rowTotal = Number((item.cantidad * realUnitPrice).toFixed(2));

      const fullDesc = item.clientePartida || "";
      const summary = extractSummary(fullDesc);

      return {
        Código: item.miPartida?.codigo || "",
        Nat: "Partida",
        Ud: item.miPartida?.unidad || "ud",
        Resumen: summary,
        Descripción: fullDesc !== summary ? fullDesc : "",
        CanPres: item.cantidad,
        Pres: realUnitPrice,
        ImpPres: rowTotal
      };
    });

    // Añadir fila de total
    const total = data.reduce((sum, row) => sum + row.ImpPres, 0);
    data.push({
      Código: "",
      Nat: "",
      Ud: "",
      Resumen: "TOTAL PRESUPUESTO",
      Descripción: "",
      CanPres: 0,
      Pres: 0,
      ImpPres: total
    });

    return data;
  }, [items]);

  const triggerDownload = async (format: string) => {
    const suggestedFileName = fileName.replace(/\.[^/.]+$/, ""); // Quitar extensión original si la tiene

    if (format === 'xlsx') {
      // 🏗️ CONSTRUCCIÓN DEL EXCEL CON CABECERA ESPECIAL
      // Formato solicitado: 
      // Fila 1: Código | Nat | Ud | RESUMEN | CanPres | Pres | ImpPres
      // Fila 2: (Vacío)| (Vacío)| (Vacío)| DESCRIPCIÓN COMPLETA | (Vacío) | (Vacío) | (Vacío)

      const wsData: any[][] = [
        ["Presupuesto"], // Fila de Título
        ["Código", "Nat", "Ud", "Resumen / Descripción", "CanPres", "Pres", "ImpPres"], // Encabezados
      ];

      budgetData.forEach(d => {
        // Fila 1: Datos principales + Resumen
        // Si es la fila de TOTAL, solo una fila
        if (d.Resumen === "TOTAL PRESUPUESTO") {
          wsData.push(["", "", "", d.Resumen, "", "", d.ImpPres]);
          return;
        }

        // Fila 1: Item normal
        wsData.push([d.Código, d.Nat, d.Ud, d.Resumen, d.CanPres, d.Pres, d.ImpPres]);

        // Fila 2: Descripción completa (si existe y es diferente)
        if (d.Descripción && d.Descripción !== d.Resumen) {
          wsData.push(["", "", "", d.Descripción, "", "", ""]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Ajustar anchos de columna básicos
      ws['!cols'] = [
        { wch: 15 }, // Código
        { wch: 10 }, // Nat
        { wch: 8 },  // Ud
        { wch: 80 }, // Resumen / Descripción (Ancho grande para leer bien)
        { wch: 12 }, // CanPres
        { wch: 12 }, // Pres
        { wch: 15 }  // ImpPres
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Presupuesto Final");

      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${suggestedFileName}.xlsx`,
            types: [{
              description: 'Libro de Excel',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('File System Access API falló para XLSX, usando fallback:', err);
        }
      }
      XLSX.writeFile(wb, `${suggestedFileName}.xlsx`);

    } else if (format === 'csv') {
      // 🏗️ CONSTRUCCIÓN DEL CSV CON CABECERA ESPECIAL
      const csvLines = [
        "Presupuesto",
        "Código,Nat,Ud,Resumen,Descripción,CanPres,Pres,ImpPres",
        ...budgetData.map(d => `"${d.Código}","${d.Nat}","${d.Ud}","${d.Resumen.replace(/"/g, '""')}","${d.Descripción.replace(/"/g, '""')}",${d.CanPres},${d.Pres},${d.ImpPres}`)
      ];
      const csvContent = "\ufeff" + csvLines.join("\n"); // Añadimos BOM para UTF-8 en Excel
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${suggestedFileName}.csv`,
            types: [{
              description: 'Archivo CSV',
              accept: { 'text/csv': ['.csv'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('File System Access API falló para CSV, usando fallback:', err);
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${suggestedFileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } else if (format === 'bc3') {
      await downloadBC3File(items, suggestedFileName, globalPercentage);
    }
  };

  const handleGenerate = async (format: string) => {
    setSelectedFormat(format);
    setIsGenerating(true);

    try {
      await triggerDownload(format);
      sessionStorage.setItem('comparativa_exportada', 'true');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsGenerating(false);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
        <div className="flex flex-col gap-2">
          <p className="text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Validación de Exportación</p>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
            Tu presupuesto ha sido actualizado con los precios de tu base de datos maestra. Verifica que la cobertura sea total antes de la salida final.
          </p>
        </div>
        <button
          onClick={() => navigate('/comparativa-detallada')}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700 active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver a la Comparativa
        </button>
      </div>

      <div className="flex justify-center mb-10">
        <div className="w-full max-w-md flex flex-col gap-4 rounded-3xl p-8 bg-white dark:bg-card-dark border-2 border-primary/20 shadow-xl shadow-primary/5 transition-transform hover:-translate-y-1 text-primary">
          <div className="flex justify-between items-start">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cobertura de Partidas Vinculadas</p>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">{coverage}%</p>
            <span className={`${coverage === 100 ? 'text-success' : 'text-amber-500'} font-black text-sm uppercase tracking-widest`}>
              {coverage === 100 ? 'Completado' : 'Pendiente'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            {coverage === 100
              ? 'Todas las partidas del cliente tienen un precio maestro asociado'
              : `${items.length - items.filter(i => i.estado === 'COINCIDENTE').length} partidas aún sin vincular a la base de datos`
            }
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl overflow-hidden relative">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex-1 space-y-6">
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
              <div className="pt-1">
                <input
                  type="checkbox"
                  id="approval-check"
                  className="w-6 h-6 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
              <div>
                <label htmlFor="approval-check" className="font-black text-slate-900 dark:text-white text-lg cursor-pointer leading-tight block">
                  Certifico la aplicación de mis precios maestros
                </label>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                  Al marcar esta casilla, confirmas que los precios unitarios del presupuesto final corresponden a tu base de datos actual.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-auto">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full lg:w-72 flex items-center justify-center gap-3 rounded-2xl h-16 bg-primary text-white text-xl font-black hover:bg-primary-dark shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
            >
              <span className="material-symbols-outlined text-2xl">file_export</span>
              Generar y Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Formato de Exportación</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>

            <div className="p-6 sm:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { id: 'xlsx', name: 'Presupuesto Excel', icon: 'table_view', color: 'text-green-600' },
                  { id: 'bc3', name: 'Archivo BC3', icon: 'data_object', color: 'text-primary' },
                  { id: 'csv', name: 'Archivo CSV', icon: 'text_snippet', color: 'text-slate-600' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleGenerate(fmt.id)}
                    disabled={isGenerating}
                    className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-slate-50 dark:border-slate-800 hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <span className={`material-symbols-outlined text-5xl ${fmt.color} group-hover:scale-110 transition-transform`}>{fmt.icon}</span>
                    <span className="font-black text-slate-700 dark:text-slate-200 text-xs uppercase tracking-widest">{fmt.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-8 py-3 rounded-xl font-black text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleGenerate('xlsx')}
                disabled={isGenerating}
                className="px-10 py-3 rounded-xl font-black bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest min-w-[180px]"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  'Exportar Ahora'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportHub;
