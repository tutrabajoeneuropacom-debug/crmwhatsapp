import React from 'react';
import { motion } from 'framer-motion';

const levels = [
    { id: 'principiante', label: 'Principiante (A1-A2)', desc: 'Puedo decir frases básicas y presentarme.' },
    { id: 'intermedio', label: 'Intermedio (B1-B2)', desc: 'Puedo mantener conversaciones sobre temas conocidos.' },
    { id: 'avanzado', label: 'Avanzado (C1-C2)', desc: 'Entiendo casi todo y me expreso con fluidez.' },
];

export default function LevelAssessment({ value, onChange }) {
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">¿Cuál es tu nivel actual?</h2>
            <div className="space-y-3">
                {levels.map((l) => (
                    <motion.button
                        key={l.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onChange(l.id)}
                        className={`w-full text-left p-5 rounded-xl border transition-all ${value === l.id
                                ? 'bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/30'
                                : 'bg-slate-800/50 border-white/10 hover:bg-slate-800'
                            }`}
                    >
                        <div className="font-bold text-lg text-white mb-1">{l.label}</div>
                        <div className="text-sm text-slate-300">{l.desc}</div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
