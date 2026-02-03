const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

/**
 * Custom Auth Adapter for Supabase
 * Stores WhatsApp session keys in a 'whatsapp_sessions' table.
 */
const useSupabaseAuthState = async (supabase) => {

    // 1. Fetch existing creds
    const readData = async (type, id) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('value')
                .eq('session_id', 'main_session') // We use a single constant ID for now
                .eq('key_type', type)
                .eq('key_id', id)
                .single();

            if (error || !data) return null;
            return JSON.parse(data.value, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    const writeData = async (data) => {
        const updates = [];

        for (const category in data) {
            for (const id in data[category]) {
                const value = data[category][id];
                const keyId = id;
                const keyType = category;

                if (value) {
                    updates.push({
                        session_id: 'main_session',
                        key_type: keyType,
                        key_id: keyId,
                        value: JSON.stringify(value, BufferJSON.replacer)
                    });
                } else {
                    // If value is null, delete it (not strictly necessary but keeps DB clean)
                    await supabase
                        .from('whatsapp_sessions')
                        .delete()
                        .eq('session_id', 'main_session')
                        .eq('key_type', keyType)
                        .eq('key_id', keyId);
                }
            }
        }

        if (updates.length > 0) {
            const { error } = await supabase.from('whatsapp_sessions').upsert(updates);
            if (error) console.error('Error saving session to Supabase:', error.message);
        }
    };

    const creds = (await readData('creds', 'base')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(type, id);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    await writeData(data);
                }
            }
        },
        saveCreds: async () => {
            await writeData({ 'creds': { 'base': creds } });
        }
    };
};

module.exports = useSupabaseAuthState;
