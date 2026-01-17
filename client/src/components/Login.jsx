import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [accountType, setAccountType] = useState('student');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        console.log("Intentando auth:", { isSignUp, email, accountType });

        try {
            if (isSignUp) {
                // Validación básica
                /*
                if (accountType === 'student' && accessCode.length < 6) {
                    throw new Error('El código debe tener 6 caracteres.');
                }
                */

                // SIMPLIFICADO: Sin opciones extra para probar si es el Redirect lo que falla
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    // Eliminamos 'options' temporalmente para aislar el error 'Anonymous sign-ins disabled'
                    // options: { ... } 
                });

                if (error) {
                    console.error("Supabase Error:", error);
                    throw error;
                }

                console.log("Registro Exitoso:", data);
                setMessage('¡Registro exitoso! Si no entras directo, revisa tu email.');

                // Auto login workaround or redirect logic
                if (data.session) {
                    if (accountType === 'freemium') navigate('/payment-setup');
                    else navigate('/languages');
                } else {
                    // Caso donde requiere confirmación de email (común en producción)
                    setMessage('Registro creado. Por favor confirma tu email para ingresar.');
                }

            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                console.log("Login Exitoso:", data);
                navigate('/languages');
            }
        } catch (error) {
            console.error("Catch Error:", error);
            setMessage(error.message || "Error desconocido");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="absolute top-6 left-6 z-10">
                <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} /> Volver al inicio
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-800 relative z-10"
            >
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-cyan-600/20 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                        <Globe className="text-cyan-400 w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">
                    {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                </h1>

                {/* LOGIN / SIGNUP TOGGLE */}
                <div className="flex justify-center gap-4 mb-8 bg-slate-950 p-1 rounded-xl border border-slate-800 mt-6">
                    <button
                        onClick={() => setIsSignUp(false)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        onClick={() => setIsSignUp(true)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Registrarse
                    </button>
                </div>

                {/* DEMO BYPASS BUTTON */}
                <button
                    onClick={() => {
                        localStorage.setItem('demo_mode', 'true');
                        window.location.reload();
                    }}
                    className="w-full mb-4 py-2 border border-yellow-600/50 text-yellow-500 rounded-xl text-xs font-bold hover:bg-yellow-900/20 transition-all flex items-center justify-center gap-2"
                >
                    🚀 ACCESO DEMO (ADMIN/INVITADO)
                </button>

                <form onSubmit={handleAuth} className="space-y-5">
                    {isSignUp && (
                        <div className="flex flex-col gap-2 mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de cuenta</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAccountType('student')}
                                    className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold border transition-all ${accountType === 'student' ? 'bg-cyan-600/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                >
                                    Soy Alumno
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('freemium')}
                                    className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold border transition-all ${accountType === 'freemium' ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                >
                                    Cuenta Freemium
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-medium"
                                placeholder="tu@email.com"
                                required
                            />
                        </div>

                        {/* Access Code removed for Open MVP */}

                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${message.includes('exitoso') || message.includes('creado') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            <span>{message}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-900/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={20} />}
                        {isSignUp ? 'Crear Cuenta' : 'Entrar'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                    {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="ml-2 text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
                    >
                        {isSignUp ? 'Ingresa aquí' : 'Regístrate gratis'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
