import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  console.log('⚠️⚠️⚠️ BUILD DEBUG START ⚠️⚠️⚠️');
  console.log('Mode:', mode);
  console.log('VITE_SUPABASE_URL exists?:', env.VITE_SUPABASE_URL ? 'YES' : 'NO');
  console.log('VITE_SUPABASE_URL length:', env.VITE_SUPABASE_URL ? env.VITE_SUPABASE_URL.length : 0);
  console.log('VITE_SUPABASE_ANON_KEY exists?:', env.VITE_SUPABASE_ANON_KEY ? 'YES' : 'NO');
  console.log('⚠️⚠️⚠️ BUILD DEBUG END ⚠️⚠️⚠️');

  return {
    plugins: [react()],
    base: '/',
  };
})
