import { createClient } from '@supabase/supabase-js'

// Fallback config object (empty) to avoid errors if file missing
const config = { supabaseUrl: null, supabaseKey: "TU_CLAVE_AQUI" };

// 1. Intentar usar variables de entorno (PRIORIDAD)
// 2. Si no, intentar usar config hardcoded (DESARROLLO LOCAL)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || config.supabaseUrl;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || config.supabaseKey;

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
