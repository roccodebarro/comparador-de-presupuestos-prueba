export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            partidas: {
                Row: {
                    id: string
                    codigo: string
                    descripcion: string
                    categoria: string | null
                    unidad: string | null
                    precio_unitario: number
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    codigo: string
                    descripcion: string
                    categoria?: string | null
                    unidad?: string | null
                    precio_unitario: number
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    codigo?: string
                    descripcion?: string
                    categoria?: string | null
                    unidad?: string | null
                    precio_unitario?: number
                    user_id?: string | null
                    created_at?: string
                }
            }
            word_weights: {
                Row: {
                    id: string
                    word: string
                    weight: number
                    frequency: number
                    updated_at: string
                }
                Insert: {
                    id?: string
                    word: string
                    weight?: number
                    frequency?: number
                    updated_at?: string
                }
                Update: {
                    id?: string
                    word?: string
                    weight?: number
                    frequency?: number
                    updated_at?: string
                }
            }
            synonyms: {
                Row: {
                    id: string
                    word: string
                    synonym: string
                    confidence: number
                }
                Insert: {
                    id?: string
                    word: string
                    synonym: string
                    confidence?: number
                }
                Update: {
                    id?: string
                    word?: string
                    synonym?: string
                    confidence?: number
                }
            }
            confirmation_history: {
                Row: {
                    id: string
                    user_id: string | null
                    cliente_desc: string
                    partida_desc: string
                    partida_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    cliente_desc: string
                    partida_desc: string
                    partida_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    cliente_desc?: string
                    partida_desc?: string
                    partida_id?: string | null
                    created_at?: string
                }
            }
            activity_log: {
                Row: {
                    id: string
                    user_id: string | null
                    action: string
                    type: 'Info' | 'Crítico' | 'Alerta'
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    action: string
                    type?: 'Info' | 'Crítico' | 'Alerta'
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    action?: string
                    type?: 'Info' | 'Crítico' | 'Alerta'
                    created_at?: string
                }
            }
            comparaciones_recientes: {
                Row: {
                    id: string
                    file_name: string
                    total_estimado: number
                    partidas_totales: number
                    partidas_vinculadas: number
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    file_name: string
                    total_estimado?: number
                    partidas_totales?: number
                    partidas_vinculadas?: number
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    file_name?: string
                    total_estimado?: number
                    partidas_totales?: number
                    partidas_vinculadas?: number
                    user_id?: string | null
                    created_at?: string
                }
            }
            proyectos: {
                Row: {
                    id: string
                    nombre: string
                    descripcion: string | null
                    estado: string
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    nombre: string
                    descripcion?: string | null
                    estado?: string
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    nombre?: string
                    descripcion?: string | null
                    estado?: string
                    user_id?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_activity_logs: {
                Args: Record<PropertyKey, never>
                Returns: {
                    id: string
                    user_id: string
                    full_name: string
                    action: string
                    type: string
                    created_at: string
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}
