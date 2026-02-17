-- Habilitar la replicación para la tabla 'partidas'
-- Esto permite que Supabase Realtime detecte cambios y los notifique a los clientes conectados

-- Primero, nos aseguramos de que la tabla esté en la publicación de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE partidas;

-- Nota: Si la publicación no existe (raro en proyectos nuevos), se crearía con:
-- CREATE PUBLICATION supabase_realtime FOR TABLE partidas;
