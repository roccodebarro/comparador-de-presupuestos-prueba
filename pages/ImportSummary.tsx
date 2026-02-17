
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { dbCache } from '../services/dbCache';
import { getWordWeights, getSynonyms } from '../utils/learningEngine';

const ImportSummary: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { items = [], fileName = 'Archivo desconocido' } = location.state || {};
  const [customName, setCustomName] = useState(fileName);
  const [counts, setCounts] = useState({ green: 0, yellow: 0, red: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [analyzedItems, setAnalyzedItems] = useState<any[]>([]);

  useEffect(() => {
    if (!location.state || items.length === 0) {
      navigate('/importar-simple');
      return;
    }

    const analyzeData = async () => {
      setIsLoading(true);
      try {
        let allPartidas = dbCache.get();

        if (!allPartidas) {
          console.log('ImportSummary: Cache miss, fetching from Supabase...');
          allPartidas = [];
          let hasMore = true;
          let page = 0;
          const pageSize = 1000;

          while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;
            const { data, error } = await supabase
              .from('partidas')
              .select('*')
              .range(from, to);

            if (error) {
              console.error('Error fetching partidas page:', error);
              break;
            }

            if (data && data.length > 0) {
              allPartidas.push(...data);
              hasMore = data.length === pageSize;
              page++;
            } else {
              hasMore = false;
            }
          }

          const normalized = allPartidas.map((p: any) => ({
            ...p,
            precioUnitario: Number(p.precio_unitario) || 0
          }));
          dbCache.set(normalized);
          allPartidas = normalized;
        } else {
          console.log('ImportSummary: Cache hit, reusing database.');
        }

        const weights = await getWordWeights();
        const synonyms = await getSynonyms();

        const worker = new Worker(new URL('../utils/comparison.worker.ts', import.meta.url), { type: 'module' });
        let accumulated: any[] = [];

        worker.onmessage = (e) => {
          const { type, chunk } = e.data;

          if (type === 'PROGRESS' && chunk) {
            accumulated.push(...chunk);
          } else if (type === 'COMPLETE') {
            let green = 0, yellow = 0, red = 0;
            accumulated.forEach((it: any) => {
              if (it.estado === 'COINCIDENTE') green++;
              else if (it.estado === 'SIMILAR') yellow++;
              else red++;
            });
            setCounts({ green, yellow, red });
            setAnalyzedItems(accumulated);
            setIsLoading(false);
            worker.terminate();
          }
        };

        worker.onerror = (err) => {
          console.error('Worker error in summary:', err);
          setIsLoading(false);
          worker.terminate();
        };

        worker.postMessage({
          rawItems: items,
          dbPartidas: allPartidas,
          wordWeights: weights,
          synonyms: synonyms,
          chunkSize: 200
        });

      } catch (error) {
        console.error('Error analyzing summary:', error);
        setIsLoading(false);
      }
    };

    analyzeData();
  }, [items, navigate, location.state]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Analizando coincidencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto fade-in">
      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-3xl p-8 text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-500 text-white rounded-full mb-4 shadow-lg shadow-emerald-500/20">
          <span className="material-symbols-outlined text-3xl">check</span>
        </div>
        <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-400 mb-1">Importación completada con éxito</h2>
        <div className="max-w-md mx-auto mt-4">
          <p className="text-emerald-700/70 text-xs font-bold uppercase tracking-widest mb-2">Identificador del Proyecto / Comparación</p>
          <input
            type="text"
            className="w-full px-4 py-3 bg-white/50 dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center font-bold text-emerald-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Introduce un nombre para identificar esta comparativa..."
          />
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm mb-10">
        <h3 className="text-xl font-black flex items-center mb-6 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined text-primary mr-3">auto_awesome</span>
          Análisis del Motor de Coincidencias
        </h3>
        <div className="grid gap-4">
          <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mr-4">
              <span className="material-symbols-outlined text-emerald-600">verified</span>
            </div>
            <div className="flex-grow">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{counts.green} partidas coincidentes</p>
              <p className="text-xs text-slate-500">Coincidencia exacta encontrada en tu base de datos.</p>
            </div>
            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Verde</div>
          </div>
          <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-yellow-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center mr-4">
              <span className="material-symbols-outlined text-yellow-600">visibility</span>
            </div>
            <div className="flex-grow">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{counts.yellow} partidas similares</p>
              <p className="text-xs text-slate-500">Coincidencia parcial detectada. Requiere revisión manual.</p>
            </div>
            <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Amarillo</div>
          </div>
          <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-red-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mr-4">
              <span className="material-symbols-outlined text-red-600">link_off</span>
            </div>
            <div className="flex-grow">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{counts.red} partidas sin coincidencia</p>
              <p className="text-xs text-slate-500">No se han encontrado referencias. Debes vincularlas manualmente.</p>
            </div>
            <div className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Rojo</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate('/comparativa-detallada', {
            state: {
              items: analyzedItems,
              fileName: customName,
              resultsAlreadyAnalyzed: true
            }
          })}
          className="flex-1 py-4 bg-primary text-white text-center rounded-2xl font-black text-lg shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all focus:outline-none"
        >
          Iniciar Comparativa Detallada
        </button>
        <Link to="/" className="px-10 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-center">
          Volver al Panel
        </Link>
      </div>
    </div>
  );
};

export default ImportSummary;
