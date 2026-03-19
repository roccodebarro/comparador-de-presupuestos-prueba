import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Partida, ComparisonItem } from '../types';
import { supabase } from '../utils/supabase';
import {
  calculateSimilarity,
  classifyMatch,
  findBestMatches,
  simplifyText,
  normalizeText,
  type WordWeightMap,
  type SynonymMap
} from '../utils/textSimilarity';
import {
  getWordWeights,
  getSynonyms,
  recordConfirmation
} from '../utils/learningEngine';
import { dbCache } from '../services/dbCache';
import VincularPartidaForm from '../components/Partidas/VincularPartidaForm';


// Componente de Fila Memoizado
const ComparisonRow = React.memo(({
  item,
  handleConfirm,
  openLinkingModal,
  onQuantityChange,
  onCosteChange,
  onVentaChange,
  onPorcentajeChange,
  gp
}: {
  item: ComparisonItem;
  handleConfirm: (id: string) => void;
  openLinkingModal: (id: string) => void;
  onQuantityChange: (id: string, newQty: number) => void;
  onCosteChange: (id: string, val: number) => void;
  onVentaChange: (id: string, val: number) => void;
  onPorcentajeChange: (id: string, val: number) => void;
  gp: number;
}) => {
  return (
    <div className="grid grid-cols-12 p-6 items-start border-b border-slate-100 dark:border-slate-800 relative transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/20 gap-4">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.estado === 'COINCIDENTE' ? 'bg-success' :
        item.estado === 'SIMILAR' ? 'bg-warning' : 'bg-danger'
        }`}></div>

      {/* Columna Izquierda: Descripción Cliente */}
      <div className="col-span-7 pr-4">
        {item.clienteCodigo && (
          <span className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">{item.clienteCodigo}</span>
        )}
        <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-relaxed mb-2">{item.clientePartida}</h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${item.estado === 'COINCIDENTE' ? 'bg-green-100 text-green-700' :
            item.estado === 'SIMILAR' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
            {item.estado === 'SIN COINCIDENCIA' ? 'No vinculado' : item.estado}
          </span>
          {item.estado === 'SIMILAR' && (
            <button
              onClick={() => handleConfirm(item.id)}
              className="px-4 py-1 bg-primary text-white text-[9px] font-black rounded hover:shadow-lg transition-all active:scale-95 uppercase tracking-widest"
            >
              Validar
            </button>
          )}
        </div>
      </div>

      {/* Columna Derecha: Tarjeta de Vinculación + Precios */}
      <div className="col-span-5 flex justify-end">
        <div className="w-full max-w-[480px] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm relative group/card">

          {/* Información del Cliente (Importado) */}
          {item.clientePrecio !== undefined && (
            <div className="flex items-center justify-between mb-2 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-200/50 pb-2">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">description</span> BC3 Original:
              </span>
              <span>
                {item.clientePrecio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/ud →
                <span className="text-slate-500 ml-1">Total: {(item.cantidad * item.clientePrecio).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
              </span>
            </div>
          )}

          {/* Header de la Card: Inputs de Cantidad y Precio */}
          <div className="flex items-center justify-between mb-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <label className="text-[8px] text-slate-400 font-black uppercase">Cant</label>
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={(e) => onQuantityChange(item.id, Number(e.target.value))}
                  className="w-12 bg-slate-100 dark:bg-slate-800 px-1 py-1 rounded font-black text-slate-700 dark:text-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all border-none"
                  min="0"
                  step="any"
                />
              </div>
              <span className="text-slate-300 font-bold">×</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-300 font-bold ml-1">(</span>
              {/* Coste */}
              <div className="flex flex-col items-center">
                <label className="text-[8px] text-slate-400 font-black uppercase">Coste</label>
                <input
                  type="number"
                  value={item.precioCoste || 0}
                  onChange={(e) => onCosteChange(item.id, Number(e.target.value))}
                  className="w-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-1 py-1 rounded font-bold text-slate-600 dark:text-slate-300 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  step="0.01"
                />
              </div>

              <span className="text-slate-300 font-bold">+</span>

              {/* Porcentaje */}
              <div className="flex flex-col items-center">
                <label className="text-[8px] text-slate-400 font-black uppercase">%</label>
                <input
                  type="number"
                  value={item.porcentaje || 0}
                  onChange={(e) => onPorcentajeChange(item.id, Number(e.target.value))}
                  className="w-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-1 py-1 rounded font-bold text-slate-600 dark:text-slate-300 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  step="0.1"
                />
              </div>

              <span className="text-slate-300 font-bold">+</span>

              {/* Venta (Precio Base) */}
              <div className="flex flex-col items-center">
                <label className="text-[8px] text-primary/60 font-black uppercase">Venta</label>
                <input
                  type="number"
                  value={item.precioVenta || 0}
                  onChange={(e) => onVentaChange(item.id, Number(e.target.value))}
                  className="w-16 bg-white dark:bg-slate-800 border-2 border-primary/10 px-1 py-1 rounded font-black text-primary text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  step="0.01"
                />
              </div>
              <span className="text-slate-300 font-bold">)</span>
            </div>

            <div className="text-right pl-2 border-l border-slate-100 dark:border-slate-700 flex-shrink-0">
              <p className="text-[10px] text-slate-400 font-bold">Total</p>
              <p className="text-sm font-black text-success leading-tight whitespace-nowrap">
                {(() => {
                  const puBase = (item.precioVenta || 0) + (item.precioCoste || 0) * (1 + ((item.porcentaje || 0) / 100));
                  const puFinal = Number((puBase * (1 + (gp / 100))).toFixed(2));
                  const total = Number((item.cantidad * puFinal).toFixed(2));
                  return total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()} €
              </p>
            </div>
          </div>

          {/* Contenido de la Partida Vinculada o Botón vincular */}
          {item.miPartida ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md text-slate-500">{item.miPartida.codigo}</span>
                <button onClick={() => openLinkingModal(item.id)} className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-xs">sync</span> Cambiar
                </button>
              </div>
              <p
                className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed line-clamp-2 hover:line-clamp-none transition-all"
              >
                {item.miPartida.descripcion}
              </p>
            </>
          ) : (
            <button
              onClick={() => openLinkingModal(item.id)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">add_link</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Asociar partida</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
});

const DetailedComparison: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateItems = location.state?.items as { descripcion: string; cantidad: number }[] | undefined;

  const STORAGE_KEY_ITEMS = 'comparador_items_actuales';
  const STORAGE_KEY_GP = 'comparador_global_percentage';
  const STORAGE_KEY_FILENAME = 'comparador_file_name';
  const STORAGE_KEY_ID = 'comparador_id';

  // 🛠️ Función Helper para normalizar items y evitar errores de cálculo
  const normalizeItem = useCallback((it: any) => {
    if (!it) return null;

    // Prioridad de precio de venta:
    // 1. Ya editado por usuario (it.precioVenta)
    // 2. Partida vinculada (it.miPartida.precioUnitario)
    // 3. Precio base original del BC3 (it.clientePrecio)
    const venta = it.precioVenta ?? (it.miPartida?.precioUnitario ?? it.clientePrecio ?? 0);

    const baseCost = it.precioCoste ?? 0;
    const percentage = it.porcentaje ?? 0;

    return {
      ...it,
      precioCoste: baseCost,
      porcentaje: percentage,
      precioVenta: venta
    };
  }, []);

  const [items, setItems] = useState<ComparisonItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[0]?.clientePartida === 'Instalación de punto de luz simple') {
            localStorage.removeItem(STORAGE_KEY_ITEMS);
            return [];
          }
          return parsed.map(normalizeItem).filter(Boolean) as ComparisonItem[];
        }
      } catch (e) {
        console.error("Error parsing saved items", e);
      }
    }
    return [];
  });

  const [globalPercentage, setGlobalPercentage] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_GP) || '';
  });

  const [dbPartidas, setDbPartidas] = useState<Partida[]>([]);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [visibleItemsCount, setVisibleItemsCount] = useState(50);
  const [comparisonId, setComparisonId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ID));

  const [isAutoValidating, setIsAutoValidating] = useState(false);
  const [itemsToAutoValidate, setItemsToAutoValidate] = useState<string[]>([]);

  const [fileName, setFileName] = useState<string>(() => {
    const fromState = location.state?.fileName;
    if (fromState) {
      localStorage.setItem(STORAGE_KEY_FILENAME, fromState);
      return fromState;
    }
    return localStorage.getItem(STORAGE_KEY_FILENAME) || 'Presupuesto sin nombre';
  });

  const saveComparison = useCallback(async (isExporting = false) => {
    if (items.length === 0) return;

    const gp = parseFloat(globalPercentage) || 0;
    const totalEstimado = items.reduce((acc, item) => {
      if (item.estado === 'SIN COINCIDENCIA') return acc;
      const puBase = (item.precioVenta || 0) + (item.precioCoste || 0) * (1 + ((item.porcentaje || 0) / 100));
      const puFinal = Number((puBase * (1 + (gp / 100))).toFixed(2));
      const totalRow = Number((item.cantidad * puFinal).toFixed(2));
      return acc + totalRow;
    }, 0);
    const vinculadas = items.filter(i => i.estado !== 'SIN COINCIDENCIA').length;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (comparisonId) {
        await (supabase.from('comparaciones_recientes') as any).update({
          total_estimado: totalEstimado,

          partidas_vinculadas: vinculadas,
          partidas_totales: items.length
        }).eq('id', comparisonId);
      } else {
        const { data, error } = await (supabase.from('comparaciones_recientes') as any).insert({
          file_name: fileName,

          total_estimado: totalEstimado,
          partidas_totales: items.length,
          partidas_vinculadas: vinculadas,
          user_id: user.id
        }).select().single();
        if (!error && data) {
          setComparisonId(data.id);
          localStorage.setItem(STORAGE_KEY_ID, data.id);
        }
      }
    } catch (err) {
      console.error('Error saving comparison summary:', err);
    }
  }, [items, comparisonId, fileName, globalPercentage]);

  // ✅ OPTIMIZACIÓN: Guardar con debounce
  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
      localStorage.setItem(STORAGE_KEY_GP, globalPercentage);
      saveComparison();
    }, 5000);
    return () => clearTimeout(t);
  }, [items, globalPercentage, saveComparison]);
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 🏗️ 1. Cargar Base de Datos Maestra
        // Siempre recargamos frescos para tener precios actualizados (Punto 3)
        let allPartidas: any[] = [];
        let hasMore = true;
        let page = 0;
        const pageSize = 2000; // Páginas más grandes = menos llamadas a BD

        while (hasMore) {
          const { data, error } = await supabase
            .from('partidas')
            .select('id, codigo, descripcion, categoria, precio_unitario, unidad')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allPartidas = [...allPartidas, ...data];
            page++;
            if (data.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        const normalized = allPartidas.map((p: any) => ({
          ...p,
          precioUnitario: Number(p.precio_unitario) || 0,
          searchContent: simplifyText(`${p.codigo} ${p.descripcion} ${p.categoria || ''}`)
        }));
        dbCache.set(normalized);
        allPartidas = normalized;
        setDbPartidas(allPartidas);

        // Punto 3: Si hay items en localStorage con partidas vinculadas,
        // refrescar sus precios con los datos recién cargados de la BD
        setItems(prev => {
          if (prev.length === 0) return prev;
          const partidaMap = new Map(allPartidas.map((p: any) => [p.id, p]));
          return prev.map(item => {
            if (!item.miPartida?.id) return item;
            const fresca = partidaMap.get(item.miPartida.id) as any;
            if (!fresca) return item;
            return {
              ...item,
              miPartida: fresca,
              precioVenta: item.precioVenta === item.miPartida.precioUnitario
                ? fresca.precioUnitario  // Solo actualizar si el usuario no lo cambió manualmente
                : item.precioVenta
            };
          });
        });

        // 🏗️ 2. Determinar qué items mostrar para comparar

        // Prioridad 1: Sesión en localStorage (ya cargada en el useState inicial)
        if (items.length > 0) {
          setIsLoading(false);
          setAnalysisProgress({ current: items.length, total: items.length });
          return;
        }

        // Prioridad 2: Ya vienen analizados en el estado (Ruta desde ImportSummary)
        if (location.state?.resultsAlreadyAnalyzed && location.state?.items) {
          const normalized = location.state.items.map(normalizeItem).filter(Boolean);
          setItems(normalized);
          localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(normalized));
          setAnalysisProgress({
            current: normalized.length,
            total: normalized.length
          });
          setIsLoading(false);
          return;
        }

        // Caso C: Nueva importación (Necesita análisis)
        const [w, s] = await Promise.all([getWordWeights(), getSynonyms()]);
        const itemsToProcess = location.state.items as { descripcion: string; cantidad: number; codigo?: string }[];
        const raw = itemsToProcess.filter(item => {
          const desc = String(item.descripcion || '').toLowerCase();
          return !desc.startsWith('total') && !desc.includes('subtotal') && desc.trim() !== '';
        });

        if (raw.length === 0) {
          setItems([]);
          setIsLoading(false);
          return;
        }

        setAnalysisProgress({ current: 0, total: raw.length });
        const worker = new Worker(new URL('../utils/comparison.worker.ts', import.meta.url), { type: 'module' });
        let accumulated: ComparisonItem[] = [];

        worker.onmessage = (e) => {
          const { type, current, total, chunk } = e.data;
          if (type === 'PROGRESS') {
            if (chunk) accumulated.push(...chunk);
            setAnalysisProgress({ current, total });
          } else if (type === 'COMPLETE') {
            setItems([...accumulated]);
            setIsLoading(false);
            worker.terminate();
          }
        };

        worker.postMessage({
          rawItems: raw,
          dbPartidas: allPartidas,
          wordWeights: w,
          synonyms: s,
          chunkSize: 200
        });

      } catch (e: any) {
        console.error('Error en carga de comparativa:', e);
        setRenderError(e.message);
        setIsLoading(false);
      }
    };
    loadData();
  }, [location.state]);

  // Total Venta Real = Suma de [ (Coste*(1+%)) + Venta ] * Cantidad * (1 + %global)
  const gp = parseFloat(globalPercentage) || 0;
  // 💰 Cálculos de totales
  const totalCliente = useMemo(() => {
    return items.reduce((s, i) => s + ((i.cantidad || 0) * (i.clientePrecio || 0)), 0);
  }, [items]);

  const totalCalculado = useMemo(() => {
    return items.reduce((s, i) => {
      if (i.estado === 'SIN COINCIDENCIA') return s;
      const puBase = (i.precioVenta || 0) + (i.precioCoste || 0) * (1 + ((i.porcentaje || 0) / 100));
      const puFinal = Number((puBase * (1 + (gp / 100))).toFixed(2));
      const lineTotal = Number((i.cantidad * puFinal).toFixed(2));
      return s + lineTotal;
    }, 0);
  }, [items, gp]);

  // Coste Total Real = Suma de (Coste Base * Cantidad) + Venta (que es el base de BD)
  const totalCoste = useMemo(() => items.reduce((s, i) => {
    if (i.estado === 'SIN COINCIDENCIA') return s;
    return s + ((i.precioCoste || 0) * i.cantidad) + ((i.precioVenta || 0) * i.cantidad);
  }, 0), [items]);

  const totalVinculadas = useMemo(() => items.filter(i => i.estado === 'COINCIDENTE').length, [items]);

  const handleGlobalPercentageChange = (val: string) => {
    // % Global es independiente: NO modifica el % individual de cada partida
    setGlobalPercentage(val);
  };

  const handleConfirm = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.miPartida) {
        recordConfirmation(item.clientePartida, item.miPartida.descripcion, item.miPartida.id);
      }
      return prev.map(i => i.id === id ? { ...i, estado: 'COINCIDENTE', confianza: 100 } : i);
    });
  }, []);

  const openLinkingModal = useCallback((id: string) => {
    setActiveItemId(id);
    setIsLinkingModalOpen(true);
  }, []);

  const handleUpdateQuantity = useCallback((id: string, newQty: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad: newQty } : i));
  }, []);

  const handleUpdateCoste = useCallback((id: string, val: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, precioCoste: val } : i));
  }, []);

  const handleUpdateVenta = useCallback((id: string, val: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, precioVenta: val } : i));
  }, []);

  const handleUpdatePorcentaje = useCallback((id: string, val: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, porcentaje: val } : i));
  }, []);

  const selectPartida = (p: Partida) => {
    setItems(prev => {
      const item = prev.find(i => i.id === activeItemId);
      if (item) {
        recordConfirmation(item.clientePartida, p.descripcion, p.id);
      }
      return prev.map(i => i.id === activeItemId ? {
        ...i,
        estado: 'COINCIDENTE',
        miPartida: p,
        confianza: 100,
        precioCoste: 0,
        precioVenta: p.precioUnitario,
        porcentaje: 0
      } : i);
    });
    setIsLinkingModalOpen(false);
  };

  const handleAutoValidate = () => {
    // Buscar items con SIMILAR y alta confianza (>80%)
    const validatable = items.filter(i => i.estado === 'SIMILAR' && i.confianza >= 80).map(i => i.id);
    setItemsToAutoValidate(validatable);
    setIsAutoValidating(true);
  };

  const confirmAutoValidate = () => {

    setItems(prev => prev.map(i =>
      itemsToAutoValidate.includes(i.id)
        ? {
          ...i,
          estado: 'COINCIDENTE',
          confianza: 100
          // No cambiamos precios aqui porque ya vienen seteados del worker si era SIMILAR
        }
        : i
    ));
    setIsAutoValidating(false);
  };



  const handleReset = () => {
    if (confirm('¿Reiniciar?')) {
      localStorage.removeItem(STORAGE_KEY_ITEMS);
      setItems([]);
      navigate('/importar-simple');
    }
  };

  const filteredDB = useMemo(() => {
    const s = simplifyText(searchTerm);
    if (!s) return dbPartidas.slice(0, 100);
    return dbPartidas.filter(p => (p as any).searchContent?.includes(s)).slice(0, 100);
  }, [dbPartidas, searchTerm]);

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center font-black text-primary text-xl">
              {Math.round((analysisProgress.current / analysisProgress.total) * 100 || 0)}%
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Analizando Presupuesto</h3>
            <p className="text-slate-500 font-medium italic">
              Procesando partida {analysisProgress.current} de {analysisProgress.total}...
            </p>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  if (renderError) return <div className="p-20 text-center text-red-500 font-bold">{renderError}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 flex flex-col min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">Comparativa</h2>
          <p className="text-slate-500 font-medium">Gestiona {items.length} partidas encontradas</p>
        </div>
        <div className="flex gap-3">

          <button
            onClick={handleAutoValidate}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary-dark transition-all shadow-md active:scale-95 uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            Validar Similares
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-sm font-black hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
            Reiniciar
          </button>
          <button
            onClick={() => navigate('/importar-resumen')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-32">
        <div className="grid grid-cols-12 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-7">Cliente</div>
          <div className="col-span-5 text-right">Vinculación y Precios</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.slice(0, visibleItemsCount).map(item => (
            <ComparisonRow
              key={item.id}
              item={item}
              handleConfirm={handleConfirm}
              openLinkingModal={openLinkingModal}
              onQuantityChange={handleUpdateQuantity}
              onCosteChange={handleUpdateCoste}
              onVentaChange={handleUpdateVenta}
              onPorcentajeChange={handleUpdatePorcentaje}
              gp={gp}
            />
          ))}
          {items.length > visibleItemsCount && (
            <button onClick={() => setVisibleItemsCount(v => v + 100)} className="w-full p-8 text-primary font-black uppercase text-xs hover:bg-slate-50 transition-colors">
              Cargar más partidas (+{items.length - visibleItemsCount} restantes)
            </button>
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-6xl bg-slate-900 dark:bg-slate-800 text-white p-4 sm:p-6 rounded-[2.5rem] shadow-2xl z-50 transition-all">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">

          <div className="flex items-center gap-6 sm:gap-10 w-full md:w-auto justify-between md:justify-start">
            <div>
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Coste Total</p>
              <p className="text-lg sm:text-xl font-bold opacity-80">{totalCoste.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">% Global</p>
              <div className="flex items-center gap-2 relative group">
                <input
                  type="number"
                  value={globalPercentage}
                  onChange={(e) => handleGlobalPercentageChange(e.target.value)}
                  placeholder="0"
                  className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-center font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-white/30"
                />
                <span className="text-xs font-bold absolute right-8 pointer-events-none text-white/50">%</span>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Presupuesto Cliente</p>
              <p className="text-sm sm:text-lg font-bold opacity-60 line-through decoration-white/20">{totalCliente.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
            </div>

            <div>
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Venta Total</p>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-success">{totalCalculado.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t border-white/10 pt-4 md:pt-0 md:border-0">
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Beneficio</p>
              <p className={`text-lg font-bold ${(totalCalculado - totalCoste) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {/* Beneficio = Total Venta - Total Coste = Suma(Venta * Cantidad) */}
                {(totalCalculado - totalCoste).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
                  localStorage.setItem(STORAGE_KEY_GP, globalPercentage);
                  await saveComparison(true);
                  navigate('/export-hub', { state: { items, globalPercentage: parseFloat(globalPercentage) || 0, fileName } });
                }}
                className="bg-primary px-6 sm:px-10 h-14 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest flex items-center gap-2"
              >
                <span>Exportar</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <VincularPartidaForm
        isOpen={isLinkingModalOpen}
        onClose={() => setIsLinkingModalOpen(false)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filteredDB={filteredDB}
        onSelectPartida={selectPartida}
        currentItem={items.find(i => i.id === activeItemId)}
      />

      {/* Modal de Preview Validación Masiva */}
      {isAutoValidating && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-[#1a202c] w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <span className="material-symbols-outlined text-5xl">verified</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Validación Automática</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
              He encontrado <span className="text-primary font-black">{itemsToAutoValidate.length} partidas</span> con una similitud superior al <span className="font-bold">80%</span>. ¿Deseas validarlas todas ahora?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsAutoValidating(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAutoValidate}
                disabled={itemsToAutoValidate.length === 0}
                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validar Ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default DetailedComparison;
