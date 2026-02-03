import { createClient } from '@supabase/supabase-js'
import config from './config';

// 1. Intentar usar la configuración directa (Hardcoded)
// 2. Si no, intentar usar variables de entorno (Fallback)
const supabaseUrl = config.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = (config.supabaseKey !== "TU_CLAVE_AQUI") ? config.supabaseKey : import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper global para depuración en consola del navegador
if (typeof window !== 'undefined') {
    window.checkEnv = () => {
        console.log('--- ESTADO DE VARIABLES (CONFIG.JS) ---');
        console.log('URL:', supabaseUrl ? 'DEFINIDO (OK)' : 'FALTANTE');
        console.log('KEY:', supabaseKey ? 'DEFINIDO (OK)' : 'FALTANTE');
        console.log('Es Hardcoded?:', (config.supabaseKey !== "TU_CLAVE_AQUI") ? 'SI' : 'NO (Usando Env)');
        console.log('---------------------------------------');

        if (!supabaseUrl || !supabaseKey) return "ERROR: Faltan credenciales.";
        return "OK: Credenciales detectadas.";
    };
}

let supabase = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error("Error inicializando Supabase Client:", e);
    }
} else {
    console.error('CRITICAL: Faltan las llaves de Supabase.');
}

export { supabase };
