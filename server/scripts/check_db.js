require('dotenv').config({ path: '../.env' }); // Adjust if needed, trying parent first
require('dotenv').config(); // Try default (current dir) as fallback override
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log('🔍 Checking Profiles...');
    const { data, error } = await supabase.from('profiles').select('*');

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log('📋 Profiles Found:', data.length);
    data.forEach(p => {
        console.log(`- User: ${p.id}`);
        console.log(`  Goal: ${p.goal}`);
        console.log(`  Onboarding Completed: ${p.onboarding_completed}`); // This is the key
        console.log('-------------------');
    });
}

checkProfiles();
