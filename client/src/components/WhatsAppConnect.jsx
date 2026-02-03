import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';
import api from '../services/api';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

const WhatsAppConnect = () => {
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('DISCONNECTED');
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        // Initial Status Check
        fetchStatus();

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
        } catch (e) {
            console.error("Failed to fetch WA status", e);
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
            <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                WhatsApp Command Center
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">

                {/* CONNECTION CARD */}
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center text-center shadow-2xl">
                    <h2 className="text-xl font-bold mb-4 text-slate-300">Estado de Conexión</h2>

                    <div className="mb-6">
                        {status === 'READY' ? (
                            <div className="w-48 h-48 bg-green-500/20 rounded-full flex items-center justify-center border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <span className="text-5xl">✅</span>
                            </div>
                        ) : qrCode ? (
                            <div className="bg-white p-4 rounded-xl">
                                <QRCodeSVG value={qrCode} size={200} />
                            </div>
                        ) : (
                            <div className="w-48 h-48 bg-slate-700/50 rounded-full flex items-center justify-center animate-pulse">
                                <span className="text-sm text-slate-400">Esperando QR...</span>
                            </div>
                        )}
                    </div>

                    <div className={`text-lg font-bold mb-6 px-4 py-2 rounded-lg ${status === 'READY' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                        {status === 'READY' ? 'CONECTADO Y ESCUCHANDO' : status === 'QR_READY' ? 'ESCANEA EL QR' : 'DESCONECTADO'}
                    </div>

                    <button
                        onClick={handleRestart}
                        className="text-sm text-slate-400 hover:text-white underline decoration-slate-600 hover:decoration-white"
                    >
                        Reiniciar Servicio WhatsApp
                    </button>
                </div>

                {/* LOGS / CONSOLE CARD */}
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                        <span className="text-green-400 font-bold">LIVE LOGS</span>
                        <div className="flex gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {logs.length === 0 && (
                            <p className="text-slate-600 italic text-center mt-20">Esperando actividad...</p>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="border-l-2 border-slate-700 pl-2 py-1 hover:bg-slate-900/50 transition-colors">
                                <span className="text-xs text-slate-500 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className="text-cyan-400 font-bold">{log.from.split('@')[0]}: </span>
                                <span className="text-slate-300">{log.body}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WhatsAppConnect;
