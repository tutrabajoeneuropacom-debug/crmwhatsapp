import React from 'react';
import { motion } from 'framer-motion';

const interestsList = [
    'Tecnología', 'Negocios', 'Viajes', 'Cultura Pop',
    'Deportes', 'Ciencia', 'Arte', 'Cocina',
    'Videojuegos', 'Cine', 'Música', 'Política'
];

export default function InterestsSelection({ value = [], onChange }) {
    const toggleInterest = (interest) => {
        if (value.includes(interest)) {
            onChange(value.filter(i => i !== interest));
        } else {
            if (value.length < 5) {
                onChange([...value, interest]);
            }
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-2">¿Qué te interesa?</h2>
            <p className="text-slate-400 text-center mb-6 text-sm">Selecciona hasta 5 temas para tus lecciones.</p>

            <div className="flex flex-wrap justify-center gap-3">
                {interestsList.map((item) => {
                    const isSelected = value.includes(item);
                    return (
                        <motion.button
                            key={item}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleInterest(item)}
                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${isSelected
                                    ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-500/30'
                                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
                                }`}
                        >
                            {item}
                        </motion.button>
                    );
                })}
            </div>
            <div className="text-center mt-4">
                <span className="text-xs text-slate-500">{value.length}/5 seleccionados</span>
            </div>
        </div>
    );
}
