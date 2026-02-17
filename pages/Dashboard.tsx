import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [partidasCount, setPartidasCount] = React.useState<number | null>(null);
  const [proyectosCount, setProyectosCount] = React.useState<number>(0);
  const [latestProjectName, setLatestProjectName] = React.useState<string | null>(null);
  const [criticoCount, setCriticoCount] = React.useState<number>(0);
  const [alertaCount, setAlertaCount] = React.useState<number>(0);
  const [isLoadingAlerts, setIsLoadingAlerts] = React.useState(true);
  const [recientes, setRecientes] = React.useState<any[]>([]);
  const [isLoadingRecientes, setIsLoadingRecientes] = React.useState(true);
  const [stats, setStats] = React.useState({
    monthCount: 0,
    monthTrend: 0,
    totalVolume: 0
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Conteo de partidas
        const { count: pCount } = await supabase
          .from('partidas')
          .select('id', { count: 'exact', head: true });
        setPartidasCount(pCount || 0);

        // Conteo de alertas y críticos - Mejorado para asegurar que se cuenten correctamente
        const { data: logs, error } = await supabase
          .from('activity_log')
          .select('type')
          .in('type', ['Alerta', 'Crítico']) as { data: { type: string }[] | null, error: any };

        if (!error && logs) {
          const c = logs.filter(l => l.type === 'Crítico').length;
          const a = logs.filter(l => l.type === 'Alerta').length;
          setCriticoCount(c);
          setAlertaCount(a);
        }

        // Conteo de proyectos reales
        let { count: projCount } = await supabase
          .from('proyectos')
          .select('id', { count: 'exact', head: true });

        // Si no hay proyectos, creamos uno de prueba para que no se vea vacío
        if (projCount === 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await (supabase.from('proyectos') as any).insert({
              nombre: 'Mi Primer Proyecto',
              descripcion: 'Proyecto inicial creado automáticamente',
              user_id: user.id
            });
            projCount = 1;
          }
        }
        setProyectosCount(projCount || 0);

        // Obtener el nombre del último proyecto para mostrar en la card
        const { data: latestProj } = await (supabase
          .from('proyectos')
          .select('nombre')
          .order('created_at', { ascending: false })
          .limit(1)
          .single() as any);

        if (latestProj) {
          setLatestProjectName(latestProj.nombre);
        }

        // Cargar comparaciones recientes
        const { data: cDataRaw, error: cError } = await supabase
          .from('comparaciones_recientes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        const cData = cDataRaw as any[];

        if (!cError && cData) {
          setRecientes(cData);

          // Calcular estadísticas para TAREA 2.1
          const now = new Date();
          const thisMonth = now.getMonth();
          const thisYear = now.getFullYear();
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

          const currentMonthComps = cData.filter(c => {
            const d = new Date(c.created_at);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
          });

          const lastMonthComps = cData.filter(c => {
            const d = new Date(c.created_at);
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
          });

          const totalVol = cData.reduce((sum, c) => sum + (Number(c.total_estimado) || 0), 0);

          let trend = 0;
          if (lastMonthComps.length > 0) {
            trend = ((currentMonthComps.length - lastMonthComps.length) / lastMonthComps.length) * 100;
          } else if (currentMonthComps.length > 0) {
            trend = 100; // Incremento del 100% si no había nada el mes pasado
          }

          setStats({
            monthCount: currentMonthComps.length,
            monthTrend: trend,
            totalVolume: totalVol
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoadingAlerts(false);
        setIsLoadingRecientes(false);
      }
    };

    fetchData();
  }, []);

  const totalAlerts = criticoCount + alertaCount;

  // Clases dinámicas según el tipo de alerta predominante (Crítico manda sobre Alerta)
  const isCritico = criticoCount > 0;
  const isAlerta = alertaCount > 0;

  const cardBaseClass = "p-6 rounded-2xl border transition-all shadow-sm group hover:border-primary/50";
  const cardStatusClass = "bg-white dark:bg-card-dark border-slate-200 dark:border-slate-800";

  const iconBgClass = isCritico ? "bg-red-500" : isAlerta ? "bg-orange-500" : "bg-slate-400";
  const textColorClass = isCritico ? "text-red-500" : isAlerta ? "text-orange-500" : "text-slate-900 dark:text-white";
  const iconColorClass = isCritico || isAlerta ? textColorClass : "text-slate-500";

  return (
    <div className="p-4 sm:p-8 fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">Panel General</h2>
          <p className="text-slate-500 dark:text-slate-400">Resumen general de su actividad.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-primary">analytics</span>
            </div>
            {stats.monthTrend !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stats.monthTrend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {stats.monthTrend > 0 ? '+' : ''}{stats.monthTrend.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">Comparativas este mes</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">
            {isLoadingRecientes ? '...' : stats.monthCount}
          </h3>
          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
            {stats.monthTrend >= 0 ? 'Crecimiento mensual' : 'Descenso mensual'}
          </p>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-success/10">
              <span className="material-symbols-outlined text-success">payments</span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">Volumen económico</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">
            {isLoadingRecientes ? '...' : stats.totalVolume.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Suma de proyectos activos</p>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500 bg-opacity-10">
              <span className="material-symbols-outlined text-blue-500">database</span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">Partidas en Base de Datos</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">
            {partidasCount === null ? '...' : partidasCount}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="w-full space-y-4">
          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Comparaciones Recientes</h4>

          {isLoadingRecientes ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <p className="text-slate-400 font-bold animate-pulse">Cargando historial...</p>
            </div>
          ) : recientes.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {recientes.map((comp) => (
                <div
                  key={comp.id}
                  className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">{comp.file_name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {new Date(comp.created_at).toLocaleDateString()}
                        </span>
                        <div className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {comp.partidas_vinculadas} / {comp.partidas_totales} partidas
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {Number(comp.total_estimado).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </p>
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-0.5">Total Estimado</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-center items-center text-center p-8">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <span className="material-symbols-outlined text-4xl">folder_off</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No hay comparaciones recientes</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                Comienza importando un presupuesto de cliente para compararlo con tu base de datos maestra.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
