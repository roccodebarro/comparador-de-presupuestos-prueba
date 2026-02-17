-- ==============================================================
-- SCRIPT DE LIMPIEZA Y PREVENCIÓN DE DUPLICADOS
-- Copia y ejecuta este código en el "SQL Editor" de Supabase
-- ==============================================================

-- 1. Eliminar duplicados manteniendo solo el registro más reciente
-- (Basado en el código y el usuario)
DELETE FROM public.partidas
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, codigo 
                   ORDER BY created_at DESC
               ) as row_num
        FROM public.partidas
    ) t
    WHERE t.row_num > 1
);

-- 2. Añadir restricción de unicidad para evitar que ocurra de nuevo
-- Esto hará que si intentas meter un código que ya existe para ese usuario, 
-- la base de datos lo rechace o permita actualizarlo en lugar de duplicarlo.
ALTER TABLE public.partidas 
ADD CONSTRAINT unique_user_codigo UNIQUE (user_id, codigo);
