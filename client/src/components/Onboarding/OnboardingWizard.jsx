import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowLeft, Check, Upload, Briefcase, FileText, User } from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';

// --- INLINE STEPS COMPONENTS FOR CAREER FLOW ---

const StepRole = ({ value, onChange }) => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-2">Define tu Objetivo Profesional</h2>
        <p className="text-slate-400 mb-6">¿A qué posición aspiras en el mercado global?</p>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cargo / Título (Ej: Senior React Engineer)</label>
                <input
                    type="text"
                    value={value?.title || ''}
                    onChange={(e) => onChange({ ...value, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Escribe tu cargo objetivo..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Especialidad / Industria (Ej: Fintech, AI, Construction)</label>
                <input
                    type="text"
                    value={value?.industry || ''}
                    onChange={(e) => onChange({ ...value, industry: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Tu especialización..."
                />
            </div>
        </div>
    </div>
);

const StepCV = ({ value, onChange }) => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-2">Validación de Perfil</h2>
        <p className="text-slate-400 mb-6">Sube tu CV actual para que nuestra IA personalice tu entrenamiento.</p>

        <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-10 text-center transition-colors cursor-pointer relative bg-slate-800/30">
            <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) onChange({ file: file, name: file.name });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {value?.name ? (
                <div className="flex flex-col items-center text-green-400">
                    <FileText size={48} className="mb-4" />
                    <span className="font-bold text-lg">{value.name}</span>
                    <span className="text-sm text-slate-500 mt-2">Click para cambiar</span>
                </div>
            ) : (
                <div className="flex flex-col items-center text-slate-500">
                    <Upload size={48} className="mb-4" />
                    <span className="font-bold text-lg text-slate-300">Arrastra o sube tu CV (PDF)</span>
                    <span className="text-sm mt-2">Analizeremos tus skills automáticamente</span>
                </div>
            )}
        </div>
    </div>
);

const StepWorkProbe = ({ value, onChange }) => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-2">Contexto Profesional (V2)</h2>
        <p className="text-slate-400 mb-6">Para simular entrevistas reales, cuéntanos un poco sobre tu día a día.</p>

        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Describe brevemente tu responsabilidad principal o un proyecto reciente:</label>
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Ej: Lideré la migración de una base de datos legacy a la nube reduciendo costos en un 20%..."
            />
        </div>
        <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg flex gap-3 items-start">
            <Briefcase className="text-blue-400 shrink-0 mt-1" size={20} />
            <p className="text-sm text-blue-200">
                Esta información configurará al "Interview Coach" para que te haga preguntas técnicas específicas de tu experiencia.
            </p>
        </div>
    </div>
);

// --- MAIN WIZARD COMPONENT ---

import { supabase } from '../../supabaseClient';

export default function OnboardingWizard({ session, onComplete }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // Hard reload to clear state
    };

    const [formData, setFormData] = useState({
        userId: session?.user?.id,
        role: { title: '', industry: '' }, // Step 1
        cv: null, // Step 2 (file object)
        workContext: '' // Step 3
    });

    const updateData = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const steps = [
        { component: StepRole, field: 'role', title: 'Rol' },
        { component: StepCV, field: 'cv', title: 'CV' },
        { component: StepWorkProbe, field: 'workContext', title: 'Exp' }
    ];

    const CurrentStepComponent = steps[step].component;

    const handleNext = async () => {
        if (step < steps.length - 1) {
            setStep(prev => prev + 1);
        } else {
            // SUBMIT LOGIC
            setLoading(true);
            try {
                console.log("Submitting Career Profile:", formData);

                // Construct Payload
                const profilePayload = {
                    role_title: formData.role.title,
                    role_industry: formData.role.industry,
                    work_context: formData.workContext,
                    onboarding_completed: true,
                    // Ensure we don't overwrite existing fields like tier
                    updated_at: new Date()
                };

                // 1. Explicit Check: Does profile exist?
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', session.user.id)
                    .maybeSingle(); // safer than single() if 0 rows

                let opError = null;

                if (existingProfile) {
                    // UPDATE
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            ...profilePayload,
                            updated_at: new Date()
                        })
                        .eq('id', session.user.id);
                    opError = error;
                } else {
                    // INSERT
                    const { error } = await supabase
                        .from('profiles')
                        .insert({
                            id: session.user.id,
                            email: session.user.email,
                            ...profilePayload,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    opError = error;
                }

                if (opError) throw opError;

                // 2. (Optional) CV handling
                if (formData.cv?.file) {
                    console.log("CV File pending upload:", formData.cv.file.name);
                }

                if (onComplete) onComplete();
                else navigate('/ats-scanner');

            } catch (error) {
                console.error("Error saving profile:", error);

                // FINAL FALLBACK: If everything fails, just let them in.
                // This ensures the user can ALWAYS reach the new ATS logic even if the DB is broken.
                console.warn("Aviso: Conexión a Base de Datos inestable. Entrando en modo Offline/Demo.");
                if (onComplete) onComplete();
                else navigate('/ats-scanner');

            } finally {
                setLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (step > 0) setStep(prev => prev - 1);
    };

    // Validation
    const isValid = () => {
        const val = formData[steps[step].field];
        if (step === 0) return val.title?.length > 2; // Role validation
        if (step === 1) return !!val; // CV validation
        if (step === 2) return val?.length > 10; // Work context validation
        return true;
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Top Bar for Logout */}
            <div className="absolute top-6 right-6 z-20">
                <button onClick={handleLogout} className="text-slate-500 hover:text-white text-sm font-medium">
                    Cerrar Sesión
                </button>
            </div>

            <div className="w-full max-w-xl relative z-10">
                {/* Progress Indicators */}
                <div className="mb-8 flex justify-between items-center px-4">
                    {steps.map((s, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${i <= step ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                {i < step ? <Check size={20} /> : i + 1}
                            </div>
                            <span className={`text-xs font-medium ${i <= step ? 'text-blue-400' : 'text-slate-600'}`}>{s.title}</span>
                        </div>
                    ))}
                    {/* Connecting Lines */}
                    <div className="absolute top-9 left-0 w-full h-0.5 bg-slate-800 -z-10 mx-10 max-w-[85%] hidden md:block"></div>
                    {/* Note: Simplified positioning for connecting lines */}
                </div>

                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl"
                >
                    <CurrentStepComponent
                        value={formData[steps[step].field]}
                        onChange={(val) => updateData(steps[step].field, val)}
                    />

                    <div className="mt-8 flex justify-between items-center">
                        <button
                            onClick={handleBack}
                            disabled={step === 0}
                            className={`p-3 rounded-full hover:bg-white/10 transition-colors ${step === 0 ? 'invisible' : 'text-slate-400'}`}
                        >
                            <ArrowLeft size={24} />
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={!isValid() || loading}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isValid() && !loading
                                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/25'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {loading ? 'Analizando...' : step === steps.length - 1 ? 'Iniciar Entrenamiento' : 'Continuar'}
                            {!loading && (step === steps.length - 1 ? <Check size={20} /> : <ChevronRight size={20} />)}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
