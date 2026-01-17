import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import api from '../services/api';
import { motion } from 'framer-motion';

export default function PaymentSetup({ session }) {
    const [loading, setLoading] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [name, setName] = useState('');
    const navigate = useNavigate();

    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // In a real app, you would tokenize the card here with Stripe/etc.
            // For MVP/Freemium flow, we just mark the user as 'having billing method'
            // and maybe start a generic 'trial' subscription.

            // We'll update the profile to say "billing_method_added: true"
            // Since we don't have a specific column, let's just proceed to Onboarding.
            // But ideally, save this state.

            // Update user metadata to mark payment as completed
            const { error } = await supabase.auth.updateUser({
                data: { payment_completed: true }
            });

            if (error) throw error;

            // Navigate to Language Selection -> Onboarding
            navigate('/languages');

        } catch (error) {
            console.error('Payment Error:', error);
            alert('Error procesando: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
                {/* Header with Lock Icon */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Comienza tu Prueba Gratis</h2>
                    <p className="text-slate-500 mt-2 text-sm">
                        Ingresa tu tarjeta para verificar tu cuenta. <br />
                        <span className="font-semibold text-green-600">No se te cobrará nada hoy.</span>
                    </p>
                </div>

                <form onSubmit={handlePayment} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre en la tarjeta</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej. Juan Perez"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Número de Tarjeta</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-10 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                placeholder="0000 0000 0000 0000"
                                value={cardNumber}
                                onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Expira (MM/YY)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                placeholder="MM/YY"
                                value={expiry}
                                onChange={e => setExpiry(e.target.value)}
                                maxLength={5}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">CVC</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                placeholder="123"
                                value={cvc}
                                onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                maxLength={4}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-slate-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Verificando...' : 'Iniciar Prueba Gratis'}
                        {!loading && <Check className="w-5 h-5" />}
                    </button>

                    <p className="text-center text-xs text-slate-400 mt-4">
                        Pagos seguros encriptados con SSL. Puedes cancelar en cualquier momento.
                    </p>
                </form>

            </motion.div>
        </div>
    );
}
