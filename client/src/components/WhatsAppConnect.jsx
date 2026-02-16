import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';
import api from '../services/api';
import { motion } from 'framer-motion';
import { QrCode, Cloud, Activity } from 'lucide-react';

const getSocketUrl = () => {
    if (import.meta.env.PROD) {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            if (origin.includes('crmwhatsapp-frontend')) {
                return 'https://crmwhatsapp-1-ggpi.onrender.com';
            }
            return origin;
        }
        return 'https://crmwhatsapp-1-ggpi.onrender.com';
    }
    return 'http://localhost:3000';
};

const socket = io(getSocketUrl());

const WhatsAppConnect = () => {
    const [mode, setMode] = useState('QR'); // 'QR' or 'CLOUD'
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('DISCONNECTED');
    const [cloudStatus, setCloudStatus] = useState({ configured: false });
    const [logs, setLogs] = useState([]);

    const [persona, setPersona] = useState('ALEX_MIGRATION');

    useEffect(() => {
        // Initial Status Checks
        fetchStatus();
        fetchCloudStatus();

        // Socket Listeners
        socket.on('wa_qr', (data) => {
            console.log("QR Received via Socket");
            setQrCode(data.qr);
            setStatus('QR_READY');
        });

        socket.on('wa_status', (data) => {
            console.log("Status Update:", data.status);
            setStatus(data.status);
            if (data.status === 'READY') setQrCode(null);
        });

        socket.on('wa_log', (data) => {
            setLogs(prev => [data, ...prev].slice(0, 50)); // Keep last 50
        });

        return () => {
            socket.off('wa_qr');
            socket.off('wa_status');
            socket.off('wa_log');
        };
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/whatsapp/status');
            setStatus(res.data.status);
            if (res.data.qr) setQrCode(res.data.qr);
            if (res.data.persona) setPersona(res.data.persona);
        } catch (e) {
            console.error("Failed to fetch WA status", e);
        }
    };

    const handlePersonaChange = async (newPersona) => {
        try {
            await api.post('/whatsapp/persona', { persona: newPersona });
            setPersona(newPersona);
        } catch (e) {
            alert("Error al cambiar persona");
        }
    };

    const fetchCloudStatus = async () => {
        try {
            const res = await api.get('/api/whatsapp/cloud/status');
            setCloudStatus(res.data);
        } catch (e) {
            console.error("Failed to fetch Cloud API status", e);
        }
    };

    const handleRestart = async () => {
        if (confirm("¿Reiniciar cliente WhatsApp? Esto desconectará la sesión actual.")) {
            await api.post('/whatsapp/restart');
            setStatus('RESTARTING...');
            setQrCode(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
            <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                Alex IO v5.1 Dashboard
            </h1>
            <p className="text-center text-slate-500 mb-8 text-sm">Control de Inteligencia y Consumo en Tiempo Real</p>

            {/* PERSONA SWITCHER */}
            <div className="flex justify-center mb-6 gap-4">
                <button
                    onClick={() => handlePersonaChange('ALEX_MIGRATION')}
                    className={`px-6 py-2 rounded-xl font-bold border transition-all ${persona === 'ALEX_MIGRATION' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                    🌍 MIGRACIONES
                </button>
                <button
                    onClick={() => handlePersonaChange('ALEX_DEV')}
                    className={`px-6 py-2 rounded-xl font-bold border transition-all ${persona === 'ALEX_DEV' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                    💻 SISTEMAS
                </button>
            </div>

            {/* MODE SELECTOR */}
            <div className="flex justify-center mb-8 bg-slate-800/50 p-1 rounded-2xl max-w-sm mx-auto border border-slate-700">
                <button
                    onClick={() => setMode('QR')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'QR' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <QrCode size={18} /> WhatsApp Web
                </button>
                <button
                    onClick={() => setMode('CLOUD')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'CLOUD' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <Cloud size={18} /> Cloud API
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">

                {/* CONNECTION CARD */}
                <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                    {mode === 'QR' ? (
                        <>
                            <h2 className="text-xl font-bold mb-4 text-slate-300">Conexión vía QR</h2>
                            <div className="mb-6">
                                {status === 'READY' ? (
                                    <div className="w-48 h-48 bg-green-500/20 rounded-full flex items-center justify-center border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-pulse">
                                        <span className="text-5xl">✅</span>
                                    </div>
                                ) : qrCode ? (
                                    <div className="bg-white p-5 rounded-3xl shadow-2xl">
                                        <QRCodeSVG value={qrCode} size={200} />
                                    </div>
                                ) : (
                                    <div className="w-48 h-48 bg-slate-700/30 rounded-full flex items-center justify-center border-2 border-slate-600 border-dashed">
                                        <span className="text-sm text-slate-500">Esperando QR...</span>
                                    </div>
                                )}
                            </div>

                            <div className={`text-sm font-bold mb-6 px-6 py-2 rounded-full transform transition-all ${status === 'READY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                {status === 'READY' ? '• CONECTADO Y ESCUCHANDO' : status === 'QR_READY' ? '• ESCANEA EL CÓDIGO QR' : '• DESCONECTADO'}
                            </div>

                            <button onClick={handleRestart} className="text-xs text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest font-bold">
                                Reiniciar Sesión
                            </button>
                        </>
                    ) : (
                        <>
                            <Cloud className="text-blue-500 mb-4" size={48} />
                            <h2 className="text-xl font-bold mb-2 text-slate-300">Meta Cloud API</h2>
                            <p className="text-xs text-slate-500 mb-6 max-w-[250px]">Conexión oficial mediante Facebook Developers. Ideal para producción masiva.</p>

                            <div className="flex flex-col gap-3 w-full max-w-xs">
                                <StatusBadge label="Configuración" value={cloudStatus.configured ? 'OK' : 'Faltante'} ok={cloudStatus.configured} />
                                <StatusBadge label="Phone ID" value={cloudStatus.phoneNumberId || 'No Encontrado'} ok={!!cloudStatus.phoneNumberId} />
                            </div>

                            {!cloudStatus.configured && (
                                <div className="mt-8 p-4 bg-blue-900/20 border border-blue-500/20 rounded-2xl text-xs text-blue-300 text-left">
                                    <p className="font-bold mb-1">💡 ¿Cómo configurar?</p>
                                    <p>Sube las llaves `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` a tu Panel de Render.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* LOGS / CONSOLE CARD */}
                <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 font-mono text-sm overflow-hidden flex flex-col h-[550px] shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                            <span className="text-slate-400 font-bold tracking-tighter">COGNITIVE LOGS & CONSUMPTION</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 opacity-50">
                                <Activity size={32} className="mb-2" />
                                <p className="italic">Esperando actividad de chat...</p>
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="border-l-2 border-slate-700 pl-4 py-2 hover:bg-slate-900/50 transition-colors rounded-r-lg group">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-bold ${log.from === 'SISTEMA' ? 'text-yellow-500' : 'text-cyan-500'}`}>{log.from.split('@')[0]}</span>
                                    <span className="text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className={`leading-relaxed ${log.from === 'SISTEMA' ? 'text-slate-300 italic' : 'text-slate-400'}`}>{log.body}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

// Final exports and badges
const StatusBadge = ({ label, value, ok }) => (
    <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
        <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
        <span className={`text-xs font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>{value}</span>
    </div>
);

export default WhatsAppConnect;
