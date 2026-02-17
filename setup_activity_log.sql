-- ==============================================================
-- SISTEMA DE REGISTRO DE ACTIVIDAD (VERSIÓN ROBUSTA)
-- Copia y ejecuta este código en el "SQL Editor" de Supabase
-- ==============================================================

-- 1. Asegurar que la tabla existe
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  type TEXT CHECK (type IN ('Info', 'Crítico', 'Alerta')) DEFAULT 'Info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Borrar políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_log;

-- Los administradores ven todo, los técnicos ven lo suyo
CREATE POLICY "Admins can view all logs" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin' 
    OR auth.uid() = user_id
  );

-- 3. Función RPC mejorada (con fallbacks para nombres vacíos)
CREATE OR REPLACE FUNCTION get_activity_logs()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  action TEXT,
  type TEXT,
  created_at TIMESTAMPTZ
) SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.user_id,
    COALESCE(
      (au.raw_user_meta_data->>'full_name'), 
      au.email, 
      'Usuario'
    )::TEXT as full_name,
    al.action,
    al.type,
    al.created_at
  FROM activity_log al
  LEFT JOIN auth.users au ON al.user_id = au.id
  ORDER BY al.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- 4. INSERTAR ACTIVIDAD DE PRUEBA (Para confirmar que funciona)
-- Esto insertará registros para Pablo y Manuel si existen en la base de datos
INSERT INTO public.activity_log (user_id, action, type)
SELECT id, 'ha accedido al sistema (Registro Automático)', 'Info'
FROM auth.users
WHERE email LIKE '%pablo%' OR email LIKE '%manuel%' OR email LIKE '%admin%';

-- Dar un mensaje de éxito si no hay usuarios que coincidan
INSERT INTO public.activity_log (action, type)
VALUES ('Sistema de logs activado correctamente', 'Info');
