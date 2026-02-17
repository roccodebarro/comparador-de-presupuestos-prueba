import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { User } from '@supabase/supabase-js';

const Settings: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [sensitivity, setSensitivity] = useState(75);
  const [saveHistory, setSaveHistory] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        setFullName(user.user_metadata?.full_name || '');
      }
    });

    // Cargar settings persistidos
    const savedSensitivity = localStorage.getItem('search_sensitivity');
    if (savedSensitivity) setSensitivity(parseInt(savedSensitivity));

    const savedHistory = localStorage.getItem('save_match_history');
    if (savedHistory !== null) setSaveHistory(savedHistory === 'true');
  }, []);

  const handleSensitivityChange = (val: string) => {
    const num = parseInt(val);
    setSensitivity(num);
    localStorage.setItem('search_sensitivity', val);
  };

  const handleHistoryToggle = (checked: boolean) => {
    setSaveHistory(checked);
    localStorage.setItem('save_match_history', checked.toString());
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      if (error) throw error;
      setMessage({ text: 'Perfil actualizado correctamente', type: 'success' });

      // Actualizar localmente para reflejar cambios inmediatos si es necesario
      // (Aunque un reload o re-fetch sería lo ideal para propagar al sidebar)
      window.location.reload();

    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      setMessage({ text: 'Correo de restablecimiento enviado', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Configuración</h1>
        <p className="text-slate-500">Administra tus preferencias de usuario y parámetros del sistema.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuración de Sistema */}
        <section className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined">tune</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Configuración de Coincidencias</h2>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Sensibilidad de Búsqueda</label>
                <span className="text-sm font-black text-primary">{sensitivity}%</span>
              </div>
              <input
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                type="range"
                min="0"
                max="100"
                value={sensitivity}
                onChange={(e) => handleSensitivityChange(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-3 italic">Un valor mayor requiere descripciones más exactas para considerar una coincidencia.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:white">Guardar Historial</p>
                <p className="text-xs text-slate-400">Recordar validaciones manuales para futuras comparaciones.</p>
              </div>
              <input
                type="checkbox"
                checked={saveHistory}
                onChange={(e) => handleHistoryToggle(e.target.checked)}
                className="w-6 h-6 text-primary rounded-md focus:ring-primary border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </section>

        {/* Perfil de Usuario */}
        <section className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined">person</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Perfil de Usuario</h2>
          </div>

          <form className="space-y-5" onSubmit={handleUpdateProfile}>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre Completo</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-800 dark:text-white"
                type="text"
                placeholder="Escribe tu nombre y apellidos..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 italic">Este nombre se mostrará en el menú lateral y en tus presupuestos.</p>
            </div>
            <div className="space-y-1.5 opacity-60 cursor-not-allowed">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email Corporativo (No editable)</label>
              <input
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none text-slate-500 cursor-not-allowed"
                type="email"
                readOnly
                value={user.email}
              />
            </div>

            <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl gap-3">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Último acceso: <span className="font-bold">{new Date(user.last_sign_in_at || '').toLocaleDateString()}</span>
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : 'Actualizar Nombre'}
              </button>

              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="w-full py-3 text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold transition-all text-sm"
              >
                Enviar correo de cambio de contraseña
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Settings;
