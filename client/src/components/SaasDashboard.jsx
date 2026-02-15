import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, DollarSign, Activity, Users, FileText, QrCode, Cloud, Lock, Settings } from 'lucide-react';
import axios from 'axios';

// API configuration
const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:3000';
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

const SaasDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('clients'); // Default tab

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === 'Lore2027$') {
            setIsAuthenticated(true);
        } else {
            alert('Acceso Denegado');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
                <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700">
                    <h2 className="text-2xl font-bold mb-6 text-center">SaaS Admin Panel</h2>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4"
                        placeholder="Contraseña Maestra"
                    />
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold">Entrar</button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6 hidden md:flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-8">
                    Xari SaaS
                </h1>

                <nav className="space-y-2 flex-1">
                    <SidebarItem icon={<Users />} label="Clientes Activos" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
                    <SidebarItem icon={<Zap />} label="Generador Bots" active={activeTab === 'bots'} onClick={() => setActiveTab('bots')} />
                    <SidebarItem icon={<DollarSign />} label="Facturación" active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} />
                    <SidebarItem icon={<Activity />} label="Métricas Uso" active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')} />
                    <SidebarItem icon={<Settings />} label="Configuración" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-700">
                    <p className="text-xs text-slate-500">v2.0.0 - Multi-Tenant Core</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'clients' && <ClientsSection />}
                {activeTab === 'bots' && <BotGeneratorSection />}
                {activeTab === 'billing' && <BillingSection />}
                {/* Add other sections as needed */}
            </main>
        </div>
    );
};

const SidebarItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
    >
        {React.cloneElement(icon, { size: 20 })}
        <span className="font-medium">{label}</span>
    </button>
);

// --- SECCIONES ---

const ClientsSection = () => {
    // Mock Data for MVP
    const clients = [
        { id: 1, name: 'Pizzería Don Mario', plan: 'Pro', status: 'active', renewal: '15 Feb', mrr: '$49' },
        { id: 2, name: 'Consultorio Dental Vital', plan: 'Enterprise', status: 'active', renewal: '01 Mar', mrr: '$99' },
        { id: 3, name: 'Tienda de Ropa Fashion', plan: 'Basic', status: 'pending', renewal: '-', mrr: '$29' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6">Clientes Activos</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <MetricCard title="MRR Total" value="$177" trend="+12%" icon={<DollarSign className="text-green-400" />} />
                <MetricCard title="Clientes Activos" value="3" trend="+1" icon={<Users className="text-blue-400" />} />
                <MetricCard title="Bots Online" value="2" trend="stable" icon={<Zap className="text-yellow-400" />} />
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                        <tr>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Plan</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4">Renovación</th>
                            <th className="p-4">MRR</th>
                            <th className="p-4">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 text-sm">
                        {clients.map(client => (
                            <tr key={client.id} className="hover:bg-slate-700/30 transition-colors">
                                <td className="p-4 font-medium text-white">{client.name}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">{client.plan}</span></td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${client.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                        {client.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-400">{client.renewal}</td>
                                <td className="p-4 text-white font-mono">{client.mrr}</td>
                                <td className="p-4">
                                    <button className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                                    <button className="text-red-400 hover:text-red-300">Pausar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

const BotGeneratorSection = () => {
    const [formData, setFormData] = useState({
        companyName: '',
        businessType: 'generic',
        connectionType: 'QR',
        customPrompt: ''
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            // Call the SaaS backend
            const response = await api.post('/saas/connect', formData);
            setResult(response.data);
        } catch (err) {
            setResult({ error: 'Error al conectar: ' + (err.response?.data?.error || err.message) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6">Generador de Bots (SaaS)</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
                    <h3 className="text-xl font-bold mb-6">Nueva Instancia</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-sm mb-2">Nombre Cliente</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                                placeholder="Ej: TechStore SA"
                                value={formData.companyName}
                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-slate-400 text-sm mb-2">Plantilla de Negocio</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                                value={formData.businessType}
                                onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                            >
                                <option value="generic">Genérico (Soporte)</option>
                                <option value="pizzeria">Restaurante / Delivery</option>
                                <option value="dentista">Salud / Turnos</option>
                                <option value="ecommerce">E-commerce (Catálogo)</option>
                                <option value="custom">✏️ Personalizado</option>
                            </select>
                        </div>

                        {formData.businessType === 'custom' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                                <label className="block text-slate-400 text-sm mb-2">Prompt del Sistema</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono text-sm h-32"
                                    placeholder="Eres un experto en..."
                                    value={formData.customPrompt}
                                    onChange={e => setFormData({ ...formData, customPrompt: e.target.value })}
                                />
                            </motion.div>
                        )}

                        <div>
                            <label className="block text-slate-400 text-sm mb-2">Método de Conexión</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => setFormData({ ...formData, connectionType: 'QR' })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${formData.connectionType === 'QR' ? 'bg-green-600 border-green-500' : 'bg-slate-900 border-slate-700'}`}>
                                    <QrCode />
                                    <span className="font-bold">WhatsApp Web (QR)</span>
                                </button>
                                <button type="button" onClick={() => setFormData({ ...formData, connectionType: 'API' })} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${formData.connectionType === 'API' ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700'}`}>
                                    <Cloud />
                                    <span className="font-bold">Cloud API (Meta)</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-4 rounded-xl font-bold text-lg shadow-lg mt-4 disabled:opacity-50"
                        >
                            {loading ? 'Inicializando...' : 'Crear Bot'}
                        </button>
                    </form>
                </div>

                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
                    {!result && !loading && (
                        <div className="text-center text-slate-500">
                            <Zap size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Configura el bot para ver el<br />QR o credenciales aquí.</p>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-blue-400 font-bold">Conectando con Servidor...</p>
                        </div>
                    )}

                    {result && result.success && result.connection_type === 'QR' && (
                        <div className="text-center">
                            <h3 className="text-2xl font-bold mb-4">¡Escanea Ahora!</h3>
                            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl mb-4">
                                <img src={result.qr_code} alt="QR" className="w-64 h-64" />
                            </div>
                            <p className="text-slate-400 text-sm">Sesión ID: <span className="font-mono text-white">{result.instance_id}</span></p>
                        </div>
                    )}

                    {result && result.error && (
                        <div className="bg-red-900/20 text-red-400 p-6 rounded-xl border border-red-500/30">
                            <p className="font-bold">Error de Conexión</p>
                            <p className="text-sm">{result.error}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const BillingSection = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold mb-6">Facturación</h2>
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center">
            <DollarSign size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Panel de integración con Stripe / MercadoPago en construcción.</p>
        </div>
    </motion.div>
);

const MetricCard = ({ title, value, trend, icon }) => (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-start">
        <div>
            <p className="text-slate-400 text-sm mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
            {trend && <span className="px-2 py-1 bg-slate-700 rounded text-xs text-green-400 font-bold">{trend}</span>}
        </div>
        <div className="p-3 bg-slate-700/50 rounded-xl">
            {icon}
        </div>
    </div>
);

export default SaasDashboard;
