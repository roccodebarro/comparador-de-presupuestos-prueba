
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
  resumen?: string; // Nuevo: Resumen corto (~C)
  descripcion: string; // Descripción larga (~T)
  categoria: string;
  unidad?: string;
  precioUnitario: number;
  normalized?: string[];
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
  clientePartida: string; //Descripción larga
  clienteResumen?: string; //Resumen corto
  clienteCodigo?: string;
  cantidad: number;
  estado: 'COINCIDENTE' | 'SIMILAR' | 'SIN COINCIDENCIA';
  confianza: number;
  miPartida?: Partida;
  precioVenta: number;
  precioCoste: number;
  porcentaje: number;
  clientePrecio?: number;
}
