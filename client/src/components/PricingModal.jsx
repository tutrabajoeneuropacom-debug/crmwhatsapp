import { X, Check, Crown, Star, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PricingModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8 text-center border-b border-slate-800 bg-gradient-to-b from-indigo-900/20 to-slate-900">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Desbloquea tu Potencial</h2>
                        <p className="text-slate-400 max-w-sm mx-auto">
                            Acelera tu aprendizaje con herramientas avanzadas y práctica ilimitada.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-0">
                        {/* Free Plan */}
                        <div className="p-6 md:p-8 md:border-r border-slate-800">
                            <h3 className="text-xl font-bold text-white mb-2">Plan Gratuito</h3>
                            <p className="text-3xl font-bold text-white mb-6">$0 <span className="text-sm font-normal text-slate-500">/mes</span></p>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>3 Escenarios Básicos</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>50 Mensajes / día</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>Feedback Básico</span>
                                </li>
                            </ul>

                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors"
                            >
                                Continuar Gratis
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className="p-6 md:p-8 bg-slate-800/30 relative overflow-hidden">
                            {/* Popular Badge */}
                            <div className="absolute top-0 right-0 bg-gradient-to-bl from-indigo-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                                RECOMENDADO
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                Plan Pro
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            </h3>
                            <p className="text-3xl font-bold text-white mb-6">$9.99 <span className="text-sm font-normal text-slate-500">/mes</span></p>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Escenarios Ilimitados</span>
                                </li>
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Voz Ultra-Realista (ElevenLabs)</span>
                                </li>
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Análisis de Pronunciación</span>
                                </li>
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Sin Límite de Mensajes</span>
                                </li>
                            </ul>

                            <button
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                onClick={() => alert("¡Próximamente! Integración con Stripe en progreso.")}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Zap className="w-4 h-4 fill-white" />
                                    Mejorar Ahora
                                </span>
                            </button>
                            <p className="text-xs text-center text-slate-500 mt-3">Cancela cuando quieras.</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PricingModal;
