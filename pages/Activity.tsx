
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface ActivityItem {
  id: string;
  user_id: string;
  name: string;
  user: string; // Initials
  action: string;
  time: string;
  type: 'Info' | 'Crítico' | 'Alerta';
  color: string;
  date: Date;
}

const Activity: React.FC = () => {
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_activity_logs');

      if (error) throw error;

      if (data) {
        const formattedLogs: ActivityItem[] = (data as any[]).map((item: any) => {
          const name = item.full_name || 'Usuario desconocido';
          // Get initials
          const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

          // Determine color and friendly time
          let color = 'bg-primary';
          if (item.type === 'Crítico') color = 'bg-red-500';
          if (item.type === 'Alerta') color = 'bg-amber-500';

          const date = new Date(item.created_at);
          const time = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          }).format(date);

          return {
            id: item.id,
            user_id: item.user_id,
            name: name,
            user: initials || '??',
            action: item.action,
            time: time,
            type: item.type as 'Info' | 'Crítico' | 'Alerta',
            color: color,
            date: date
          };
        });
        setLogs(formattedLogs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesUser = log.name.toLowerCase().includes(filterUser.toLowerCase());
      const matchesType = filterType === '' || log.type === filterType;
      return matchesUser && matchesType;
    });
  }, [logs, filterUser, filterType]);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 fade-in">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-background-dark/50 p-6 sm:p-8 sticky top-0 backdrop-blur-md z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Registro de Actividad</h2>
          <button
            onClick={fetchLogs}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-primary"
            title="Actualizar"
          >
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-full sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">person</span>
            <input
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="Filtrar por usuario..."
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
            />
          </div>
          <div className="relative flex-1 max-w-full sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">filter_list</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer shadow-sm"
            >
              <option value="">Todas las prioridades</option>
              <option value="Info">Informativo</option>
              <option value="Alerta">Alertas</option>
              <option value="Crítico">Críticos</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Cargando registros reales...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log: ActivityItem, i: number) => (
            <div key={log.id} className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-6 hover:border-primary/30 transition-colors relative overflow-hidden group shadow-sm animate-fade-in-up cursor-default" style={{ animationDelay: `${i * 30}ms` }}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${log.color}`}></div>
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-white group-hover:bg-primary/10 transition-colors shrink-0">
                {log.user}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-2 py-0.5 ${log.color} bg-opacity-10 ${log.color.replace('bg-', 'text-')} text-[9px] font-black uppercase rounded border border-current border-opacity-20 tracking-widest`}>
                    {log.type}
                  </span>
                  <p className="text-xs text-slate-400 font-bold">{log.time}</p>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="font-bold text-slate-900 dark:text-white">{log.name}</span> {log.action}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">history_toggle_off</span>
            <p className="text-lg font-bold">No hay actividad registrada</p>
            <p className="text-sm">Asegúrese de ejecutar el script SQL de actividad en Supabase.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
