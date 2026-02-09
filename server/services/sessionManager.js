
const sessions = new Map();

const SessionManager = {
    getSession: (userId) => {
        if (!sessions.has(userId)) {
            sessions.set(userId, {
                mode: 'ALEX', // Default Mode
                context: {},
                history: []
            });
        }
        return sessions.get(userId);
    },

    setMode: (userId, mode, context = {}) => {
        const session = SessionManager.getSession(userId);
        session.mode = mode;
        session.context = { ...session.context, ...context };
        return session;
    },

    updateContext: (userId, data) => {
        const session = SessionManager.getSession(userId);
        session.context = { ...session.context, ...data };
    },

    clearSession: (userId) => {
        sessions.delete(userId);
    }
};

module.exports = SessionManager;
