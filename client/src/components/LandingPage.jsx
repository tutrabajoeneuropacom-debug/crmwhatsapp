import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-green-500/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 max-w-4xl w-full text-center space-y-8">
                <div className="inline-block animate-bounce p-4 bg-green-500/10 rounded-full border border-green-500/30 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent pb-2">
                    WhatsApp SaaS
                </h1>

                <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Automatización inteligente de Leads para Emprendedores.
                    <br />
                    <span className="text-sm uppercase tracking-widest text-slate-500 mt-2 block">CRM Integration • Auto-Reply • Live Monitoring</span>
                </p>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center mt-8">
                    <button
                        onClick={() => navigate('/login')}
                        className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-green-900/50 flex items-center gap-2"
                    >
                        Ingresar al Sistema
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            <footer className="absolute bottom-6 text-slate-600 text-sm">
                &copy; 2026 WhatsApp SaaS Core • Powered by Render & Supabase
            </footer>
        </div>
    );
};

export default LandingPage;
