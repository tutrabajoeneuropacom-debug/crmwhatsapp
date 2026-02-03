import React from 'react';
import { motion } from 'framer-motion';
import { FileText, User, Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = ({ session }) => {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4 text-center"
            >
                Career Mastery Engine
            </motion.h1>
            <p className="text-slate-400 mb-12 text-center max-w-xl text-lg">
                Selecciona una herramienta para potenciar tu perfil profesional con Inteligencia Artificial.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl cursor-pointer">
                {/* CARD 1: ATS SCANNER */}
                <Link to="/ats-scanner" className="group">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 h-full flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-900/20 transition-all"
                    >
                        <div>
                            <div className="w-16 h-16 bg-cyan-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-cyan-600 transition-colors">
                                <FileText className="text-cyan-400 group-hover:text-white w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">Escáner ATS</h2>
                            <p className="text-slate-400 leading-relaxed">
                                Analiza tu CV contra ofertas reales. Descubre palabras clave faltantes, errores de formato y por qué no te llaman.
                            </p>
                        </div>
                        <div className="mt-8 flex items-center font-bold text-cyan-500 group-hover:translate-x-2 transition-transform">
                            Probar ahora <ArrowRight className="ml-2 w-4 h-4" />
                        </div>
                    </motion.div>
                </Link>

                {/* CARD 2: INTERVIEW SIMULATOR */}
                <Link to="/interview" className="group">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 h-full flex flex-col justify-between hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/20 transition-all"
                    >
                        <div>
                            <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                                <User className="text-blue-400 group-hover:text-white w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Juego de rol Entrevista</h2>
                            <p className="text-slate-400 leading-relaxed">
                                Simula entrevistas técnicas y de RRHH con "Alex" (IA). Recibe feedback en tiempo real sobre tu tono y respuestas.
                            </p>
                        </div>
                        <div className="mt-8 flex items-center font-bold text-blue-500 group-hover:translate-x-2 transition-transform">
                            Iniciar simulación <ArrowRight className="ml-2 w-4 h-4" />
                        </div>
                    </motion.div>
                </Link>
            </div>

            <div className="mt-12 text-center">
                <Link to="/admin" className="text-slate-600 text-xs hover:text-slate-400 transition-colors">
                    Admin Panel (Acceso Reservado)
                </Link>
            </div>
        </div>
    );
};

export default Dashboard;
