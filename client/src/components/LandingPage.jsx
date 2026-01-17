import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Globe, MessageCircle, Calendar, Briefcase,
    CheckCircle, Mic, Star, Menu, X, FileText, UserCheck, Bot
} from 'lucide-react';

const LandingPage = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 }
    };

    const staggerContainer = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500/30">

            {/* --- NAVIGATION BAR --- */}
            <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-lg border-b border-cyan-500/10">
                <div className="container mx-auto px-6 py-5 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-cyan-500/20">
                            <Globe className="text-white w-6 h-6" />
                        </div>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                            Puentes Globales
                        </span>
                    </Link>



                    {/* CTA Button */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/login" className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-full font-bold text-lg shadow-lg shadow-cyan-500/40 transition-all flex items-center gap-2">
                            Crear Cuenta <ArrowRight size={20} />
                        </Link>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden text-slate-300" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X size={32} /> : <Menu size={32} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="md:hidden bg-slate-900 border-b border-white/10"
                    >
                        <div className="px-6 py-6 flex flex-col gap-6 text-lg">
                            <a href="https://www.puentesglobales.com/home/#/login" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-cyan-400 py-2 border-b border-white/5" onClick={() => setIsMenuOpen(false)}>Talkme AI (Idiomas)</a>
                            <Link to="/login" className="text-cyan-400 font-bold py-2">Ingresar / Registrarse</Link>
                        </div>
                    </motion.div>
                )}
            </nav>

            {/* 1. HERO SECTION */}
            <section className="relative min-h-[90vh] flex items-center justify-center pt-24 overflow-hidden bg-slate-950">
                {/* Abstract Background (NO PHOTOS) */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] filter mix-blend-screen"></div>
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] filter mix-blend-screen"></div>
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                </div>

                <div className="relative z-10 container mx-auto px-6 text-center">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 mb-10 backdrop-blur-sm">
                            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
                            <span className="text-base font-bold tracking-wide uppercase">Plataforma Integral de Carrera</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black mb-10 leading-tight tracking-tight text-white">
                            Emigrar no es suerte.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 drop-shadow-sm">
                                Es Estrategia.
                            </span>
                        </h1>

                        <p className="text-2xl md:text-3xl text-slate-300 font-light max-w-4xl mx-auto mb-16 leading-relaxed">
                            La primera suite de herramientas impulsadas por IA diseñada específicamente para profesionales latinos que buscan su futuro en Europa.
                        </p>

                        {/* MAIN UTILITIES GRID (Direct Access) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
                            {/* Card 1: ATS */}
                            <Link to="/ats-scanner" className="group p-8 bg-slate-900 border border-slate-800 rounded-3xl hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                                <div className="w-16 h-16 bg-cyan-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <FileText className="text-cyan-400 w-8 h-8" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-3">Scanner ATS</h3>
                                <p className="text-slate-400 text-lg">Analiza tu CV contra ofertas reales y descubre por qué no te llaman.</p>
                                <div className="mt-6 flex items-center text-cyan-400 text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Probar ahora <ArrowRight size={20} className="ml-2" />
                                </div>
                            </Link>

                            {/* Card 2: Interview */}
                            <Link to="/interview" className="group p-8 bg-slate-900 border border-slate-800 rounded-3xl hover:border-blue-500/50 hover:bg-slate-800/80 transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                                <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <UserCheck className="text-blue-400 w-8 h-8" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-3">Roleplay Entrevista</h3>
                                <p className="text-slate-400 text-lg">Simula entrevistas técnicas y de RRHH con feedback en tiempo real.</p>
                                <div className="mt-6 flex items-center text-blue-400 text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Practicar ahora <ArrowRight size={20} className="ml-2" />
                                </div>
                            </Link>

                            {/* Card 3: Talkme */}
                            <a href="https://www.puentesglobales.com/home/#/login" target="_blank" rel="noopener noreferrer" className="group p-8 bg-slate-900 border border-slate-800 rounded-3xl hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Bot className="text-indigo-400 w-8 h-8" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-3">Talkme AI</h3>
                                <p className="text-slate-400 text-lg">Tu coach de idiomas inteligente disponible 24/7.</p>
                                <div className="mt-6 flex items-center text-indigo-400 text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Chatear ahora <ArrowRight size={20} className="ml-2" />
                                </div>
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 2. SOMOS PUENTES GLOBALES (Modernizado - SIN FOTOS) */}
            <section className="py-28 bg-slate-950 relative border-t border-slate-900">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <h2 className="text-cyan-500 font-bold tracking-widest uppercase mb-4 text-lg">Metodología Comprobada</h2>
                            <h3 className="text-4xl md:text-6xl font-black mb-8 leading-none">
                                Más que una plataforma,<br />tu ecosistema de éxito.
                            </h3>
                            <p className="text-2xl text-slate-400 mb-8 leading-relaxed font-light">
                                En Puentes Globales no solo te damos herramientas; te damos un sistema. Integramos tecnología de punta con la experiencia humana.
                            </p>
                            <ul className="space-y-6">
                                <li className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"><CheckCircle size={20} /></div>
                                    <span className="text-slate-200 text-xl">Validación de perfil profesional (Europa & USA)</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"><CheckCircle size={20} /></div>
                                    <span className="text-slate-200 text-xl">Entrenamiento de soft-skills y confianza</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"><CheckCircle size={20} /></div>
                                    <span className="text-slate-200 text-xl">Networking estratégico</span>
                                </li>
                            </ul>
                        </div>

                        {/* Logo Puentes Globales */}
                        <div className="relative h-[500px] w-full bg-slate-900 rounded-3xl border border-cyan-500/20 overflow-hidden flex items-center justify-center group p-12 shadow-2xl">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_60%)]"></div>
                            <img
                                src="/logo-new.png"
                                alt="Puentes Globales Logo"
                                className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-transform duration-700 group-hover:scale-105"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. CTA FINAL */}
            <section className="py-32 relative overflow-hidden bg-slate-950 border-t border-slate-900">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"></div>

                <div className="relative container mx-auto px-6 text-center z-10">
                    <h2 className="text-5xl md:text-7xl font-bold mb-10 text-white">¿Listo para dar el salto?</h2>
                    <div className="flex flex-col md:flex-row justify-center gap-6">
                        <Link to="/login" className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-bold text-xl hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all transform hover:-translate-y-1">
                            Crear Cuenta
                        </Link>
                        <a href="https://calendly.com/puentesglobales" target="_blank" rel="noopener noreferrer" className="px-10 py-5 bg-transparent border border-white/10 text-white rounded-full font-bold text-xl hover:bg-white/5 transition-all outline-none focus:ring-2 focus:ring-cyan-500">
                            Agendar Mentoría
                        </a>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-950 py-16 border-t border-slate-900/50">
                <div className="container mx-auto px-6 text-center text-slate-500 text-base">
                    <p>&copy; 2026 Puentes Globales. Todos los derechos reservados.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
