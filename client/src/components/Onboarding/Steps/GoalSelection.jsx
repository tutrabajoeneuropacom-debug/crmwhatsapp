import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plane, GraduationCap, Globe } from 'lucide-react';

const goals = [
    { id: 'trabajo_remoto', label: 'Trabajo Remoto', icon: Briefcase, desc: 'Entrevistas, emails y reuniones.' },
    { id: 'viajar', label: 'Viajar', icon: Plane, desc: 'Aeropuertos, hoteles y socializar.' },
    { id: 'estudio_examen', label: 'Estudios / Examen', icon: GraduationCap, desc: 'TOEFL, IELTS o universidad.' },
    { id: 'migrar', label: 'Migrar', icon: Globe, desc: 'Vivir en otro país día a día.' },
];

export default function GoalSelection({ value, onChange }) {
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">¿Cuál es tu objetivo principal?</h2>
            <div className="grid grid-cols-1 gap-4">
                {goals.map((g) => (
                    <motion.button
                        key={g.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onChange(g.id)}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${value === g.id
                                ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/30'
                                : 'bg-slate-800/50 border-white/10 hover:bg-slate-800 hover:border-white/20'
                            }`}
                    >
                        <div className={`p-3 rounded-lg ${value === g.id ? 'bg-white/20' : 'bg-slate-700'}`}>
                            <g.icon size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-white">{g.label}</div>
                            <div className="text-sm text-slate-400">{g.desc}</div>
                        </div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
