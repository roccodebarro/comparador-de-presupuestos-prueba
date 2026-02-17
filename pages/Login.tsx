
import React, { useState } from 'react';
import { supabase } from '../utils/supabase';

interface LoginProps {
  onLogin: () => void;
}

const LogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Fila 1 */}
    <circle cx="12.5" cy="12.5" r="10" fill="#9D4291" />
    <circle cx="37.5" cy="12.5" r="10" fill="#88888B" />
    <circle cx="62.5" cy="12.5" r="10" fill="#88888B" />
    <circle cx="87.5" cy="12.5" r="10" fill="#88888B" />
    {/* Fila 2 */}
    <circle cx="12.5" cy="37.5" r="10" fill="#88888B" />
    <circle cx="37.5" cy="37.5" r="10" fill="#88888B" />
    <circle cx="62.5" cy="37.5" r="10" fill="#88888B" />
    {/* Fila 3 */}
    <circle cx="12.5" cy="62.5" r="10" fill="#88888B" />
    <circle cx="37.5" cy="62.5" r="10" fill="#88888B" />
    {/* Fila 4 */}
    <circle cx="37.5" cy="87.5" r="10" fill="#88888B" />
  </svg>
);

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'success'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, introduce tus credenciales');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Por favor, confirma tu email antes de iniciar sesión');
        } else {
          setError(authError.message);
        }
      } else {
        onLogin();
      }
    } catch (err) {
      setError('Error de conexión. Verifica tu conexión a internet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Completa todos los campos');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length !== 6) {
      setError('La contraseña debe tener exactamente 6 caracteres');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        setError(authError.message);
      } else {
        setView('success');
      }
    } catch (err) {
      setError('Error de conexión. Verifica tu conexión a internet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Introduce tu correo electrónico');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setView('success');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>

      <div className="max-w-[440px] w-full bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-slate-100 p-10 z-10 fade-in">

        <div className="flex flex-col items-center mb-10">
          <div className="mb-8 hover:scale-105 transition-transform duration-500">
            <LogoIcon className="w-20 h-20" />
          </div>
          <h1 className="text-[28px] font-black text-[#1a2b4b] text-center leading-tight tracking-tight mb-2">Comparador De Presupuestos</h1>
          <p className="text-slate-400 font-medium text-[15px]">
            {view === 'login' ? 'Accede a tu cuenta de gestión' :
              view === 'register' ? 'Crea tu cuenta' :
                view === 'forgot' ? 'Recupera tu acceso' : 'Revisa tu correo'}
          </p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-7 animate-fade-in">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-red-500 text-xs text-center font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px]"
                placeholder="nombre@empresa.com"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px] tracking-[0.5em]"
                placeholder="••••••"
                maxLength={6}
                required
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-md border-2 border-slate-300 checked:bg-slate-700 checked:border-slate-700 transition-all cursor-pointer" />
                  <span className="material-symbols-outlined absolute text-white text-sm scale-0 peer-checked:scale-100 transition-transform left-0.5 pointer-events-none">check</span>
                </div>
                <span className="text-[14px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">Recordarme</span>
              </label>
              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); }}
                className="text-[14px] font-bold text-[#137fec] hover:text-[#0b5ecb] transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-5 bg-[#137fec] text-white font-black rounded-[1.25rem] hover:bg-[#0b5ecb] transition-all shadow-[0_12px_24px_rgba(19,127,236,0.25)] hover:shadow-[0_15px_30px_rgba(19,127,236,0.35)] hover:-translate-y-0.5 active:translate-y-0.5 text-[17px] mt-2 disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>

            <p className="text-center text-sm text-slate-400">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setView('register'); setError(''); }}
                className="font-bold text-[#137fec] hover:text-[#0b5ecb] transition-colors"
              >
                Regístrate
              </button>
            </p>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-7 animate-fade-in">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-red-500 text-xs text-center font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px]"
                placeholder="nombre@empresa.com"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px] tracking-[0.5em]"
                placeholder="6 caracteres"
                maxLength={6}
                required
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CONFIRMAR CONTRASEÑA</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px] tracking-[0.5em]"
                placeholder="Repite la contraseña"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-5 bg-[#137fec] text-white font-black rounded-[1.25rem] hover:bg-[#0b5ecb] transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">person_add</span>
                  Crear Cuenta
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors py-2"
            >
              Ya tengo cuenta, iniciar sesión
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-7 animate-fade-in">
            <p className="text-sm text-slate-500 text-center px-4 leading-relaxed">
              Introduce tu correo y te enviaremos instrucciones para restablecer tu contraseña.
            </p>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-red-500 text-xs text-center font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4.5 rounded-[1.25rem] border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 text-[15px]"
                placeholder="nombre@empresa.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-5 bg-[#137fec] text-white font-black rounded-[1.25rem] hover:bg-[#0b5ecb] transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">send</span>
                  Enviar instrucciones
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors py-2"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}

        {view === 'success' && (
          <div className="flex flex-col items-center space-y-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
            </div>
            <div className="space-y-3">
              <p className="text-lg font-bold text-slate-900">¡Revisa tu correo!</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Hemos enviado un correo a <span className="font-bold text-slate-700">{email}</span> con las instrucciones.
              </p>
            </div>
            <button
              onClick={() => setView('login')}
              className="w-full py-5 bg-slate-900 text-white font-black rounded-[1.25rem] hover:bg-slate-800 transition-all shadow-lg"
            >
              Entendido, volver
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;
