import { createClient } from '@supabase/supabase-js'
import type { Database } from '../utils/database.types'

// Estas variables leerán lo que configuraste en Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase Config Check:', {
    url: supabaseUrl ? 'Defined' : 'MISSING',
    key: supabaseAnonKey ? 'Defined' : 'MISSING'
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Critical: Supabase environment variables are missing! Falling back to placeholders to prevent crash.');
}

export const supabase = createClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
)
