
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Técnico';
  status: 'Activo' | 'Inactivo';
}

export interface Partida {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  unidad?: string; // Nuevo campo opcional
  precioUnitario: number;
  normalized?: string[]; // Caché de palabras normalizadas para rendimiento
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  type: 'Info' | 'Crítico' | 'Alerta';
}

export interface ComparisonItem {
  id: string;
  clientePartida: string;
  cantidad: number;
  estado: 'COINCIDENTE' | 'SIMILAR' | 'SIN COINCIDENCIA';
  confianza: number;
  miPartida?: Partida;
  precioVenta: number;
  precioCoste: number;
  porcentaje: number;
}
