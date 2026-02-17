-- ==============================================================
-- SECURITY HARDENING: RLS, ROLES & RPC PROTECTION
-- ==============================================================

-- 1. ACTIVAR RLS EN TABLAS PÚBLICAS
ALTER TABLE public.word_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA WORD_WEIGHTS (Solo lectura para todos, escritura solo Admin)
DROP POLICY IF EXISTS "Anyone can view word_weights" ON public.word_weights;
CREATE POLICY "Anyone can view word_weights" ON public.word_weights
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage word_weights" ON public.word_weights;
CREATE POLICY "Admins can manage word_weights" ON public.word_weights
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
  );

-- 3. POLÍTICAS PARA SYNONYMS (Solo lectura para todos, escritura solo Admin)
DROP POLICY IF EXISTS "Anyone can view synonyms" ON public.synonyms;
CREATE POLICY "Anyone can view synonyms" ON public.synonyms
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage synonyms" ON public.synonyms;
CREATE POLICY "Admins can manage synonyms" ON public.synonyms
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin'
  );

-- 4. POLÍTICAS PARA ACTIVITY_LOG (Admins ven todo, Técnicos ven lo suyo)
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_log;
CREATE POLICY "Admins can view all logs" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin' 
    OR auth.uid() = user_id
  );

-- 5. ACTUALIZAR RPC: get_users_managed (Usar app_metadata)
DROP FUNCTION IF EXISTS get_users_managed();
CREATE OR REPLACE FUNCTION get_users_managed()
RETURNS TABLE (
  id uuid,
  email varchar,
  full_name jsonb,
  role text,
  last_sign_in_at timestamptz
) SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::varchar, 
    au.raw_user_meta_data->'full_name', 
    au.raw_app_meta_data->>'role',
    au.last_sign_in_at
  FROM auth.users au;
END;
$$ LANGUAGE plpgsql;

-- 6. ACTUALIZAR RPC: get_activity_logs (Fijar search_path)
DROP FUNCTION IF EXISTS get_activity_logs();
CREATE OR REPLACE FUNCTION get_activity_logs()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  action TEXT,
  type TEXT,
  created_at TIMESTAMPTZ
) SECURITY DEFINER
SET search_path = public
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

-- 7. ACTUALIZAR POLÍTICAS DE PARTIDAS (Migrar a app_metadata)
DROP POLICY IF EXISTS "RLS_PARTIDAS_INSERT" ON partidas;
CREATE POLICY "RLS_PARTIDAS_INSERT" ON partidas
  FOR INSERT TO authenticated WITH CHECK (
    LOWER(auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

DROP POLICY IF EXISTS "RLS_PARTIDAS_UPDATE" ON partidas;
CREATE POLICY "RLS_PARTIDAS_UPDATE" ON partidas
  FOR UPDATE TO authenticated USING (
    LOWER(auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

DROP POLICY IF EXISTS "RLS_PARTIDAS_DELETE" ON partidas;
CREATE POLICY "RLS_PARTIDAS_DELETE" ON partidas
  FOR DELETE TO authenticated USING (
    LOWER(auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'admin')
  );

-- 8. MIGRAR ROLES EXISTENTES DE user_metadata A app_metadata
-- Esto asegura que los usuarios actuales sigan teniendo su rol
UPDATE auth.users
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(raw_user_meta_data->>'role', 'Técnico'))
WHERE raw_app_meta_data->>'role' IS NULL;
