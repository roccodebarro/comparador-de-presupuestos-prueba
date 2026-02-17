-- =====================================================
-- ESQUEMA DE BASE DE DATOS PARA COMPARADOR DE PRESUPUESTOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Tabla de partidas propias del usuario
CREATE TABLE IF NOT EXISTS partidas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT,
  unidad TEXT,
  precio_unitario DECIMAL(10,2) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_partidas_user ON partidas(user_id);
CREATE INDEX IF NOT EXISTS idx_partidas_descripcion ON partidas USING gin(to_tsvector('spanish', descripcion));

-- Pesos de palabras ajustados por aprendizaje
CREATE TABLE IF NOT EXISTS word_weights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  weight DECIMAL(5,3) DEFAULT 1.0,
  frequency INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_word_weights_word ON word_weights(word);

-- Sinónimos técnicos detectados
CREATE TABLE IF NOT EXISTS synonyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  synonym TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(word, synonym)
);

CREATE INDEX IF NOT EXISTS idx_synonyms_word ON synonyms(word);

-- Historial de confirmaciones para aprendizaje
CREATE TABLE IF NOT EXISTS confirmation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_desc TEXT NOT NULL,
  partida_desc TEXT NOT NULL,
  partida_id UUID REFERENCES partidas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confirmation_history_user ON confirmation_history(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_history ENABLE ROW LEVEL SECURITY;

-- Políticas para partidas: cada usuario ve solo las suyas
CREATE POLICY "Users can view own partidas" ON partidas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own partidas" ON partidas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own partidas" ON partidas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own partidas" ON partidas
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para historial de confirmaciones
CREATE POLICY "Users can view own confirmations" ON confirmation_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own confirmations" ON confirmation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- word_weights y synonyms son compartidos (sin RLS restrictivo)
-- Esto permite que el aprendizaje sea colectivo

-- =====================================================
-- DATOS INICIALES DE EJEMPLO
-- =====================================================

-- Algunas partidas de ejemplo para probar
INSERT INTO word_weights (word, weight, frequency) VALUES
  ('luz', 1.2, 5),
  ('punto', 1.15, 4),
  ('cableado', 1.1, 3),
  ('led', 1.25, 6),
  ('interruptor', 1.2, 4),
  ('tubo', 1.1, 2),
  ('cable', 1.15, 5)
ON CONFLICT (word) DO NOTHING;

-- Algunos sinónimos técnicos comunes
INSERT INTO synonyms (word, synonym, confidence) VALUES
  ('luz', 'iluminacion', 0.8),
  ('cable', 'cableado', 0.9),
  ('tubo', 'tuberia', 0.7),
  ('interruptor', 'mecanismo', 0.6),
  ('luminaria', 'lampara', 0.8),
  ('empotrado', 'embutido', 0.85)
ON CONFLICT (word, synonym) DO NOTHING;

-- Tabla para guardar el resumen de comparaciones recientes
CREATE TABLE IF NOT EXISTS public.comparaciones_recientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  total_estimado DECIMAL(15,2) DEFAULT 0,
  partidas_totales INT DEFAULT 0,
  partidas_vinculadas INT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para guardar proyectos
CREATE TABLE IF NOT EXISTS public.proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'Activo',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.comparaciones_recientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view own comparisons" ON public.comparaciones_recientes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comparisons" ON public.comparaciones_recientes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comparisons" ON public.comparaciones_recientes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON public.proyectos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.proyectos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.proyectos
  FOR UPDATE USING (auth.uid() = user_id);
