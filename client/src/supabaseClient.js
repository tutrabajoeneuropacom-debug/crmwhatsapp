import { createClient } from '@supabase/supabase-js'

// Fallback config object (empty) to avoid errors if file missing
const config = { supabaseUrl: null, supabaseKey: "TU_CLAVE_AQUI" };

// 1. Intentar usar variables de entorno (PRIORIDAD)
// 2. Si no, intentar usar config hardcoded (DESARROLLO LOCAL)
const cleanStr = (s) => (s || "").trim();

const supabaseUrl = cleanStr(import.meta.env.VITE_SUPABASE_URL) || config.supabaseUrl;
const supabaseKey = cleanStr(import.meta.env.VITE_SUPABASE_ANON_KEY) || config.supabaseKey;

// ... debug helper ...

let supabase = null;

if (supabaseUrl && supabaseKey && supabaseKey !== "TU_CLAVE_AQUI") {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error("Error inicializando Supabase Client:", e);
    }
} else {
    console.warn('⚠️ Supabase no configurado o en Modo Demo.');
}

export { supabase };
