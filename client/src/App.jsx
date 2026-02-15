import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import api from './services/api';
import Login from './components/Login';

import LandingPage from './components/LandingPage';
import WhatsAppConnect from './components/WhatsAppConnect';

import AdminDashboard from './components/AdminDashboard';
import OnboardingWizard from './components/Onboarding/OnboardingWizard';
import PaymentSetup from './components/PaymentSetup';
import SaasDashboard from './components/SaasDashboard';


function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    const demoMode = localStorage.getItem('demo_mode') === 'true';

    if (demoMode) {
      console.warn("DEMO MODE ACTIVE: Using Mock Session");
      const mockSession = {
        user: {
          id: 'demo-admin-id',
          email: 'admin@demo.com',
          user_metadata: { is_student: false, payment_completed: true, role: 'admin' }
        }
      };
      setSession(mockSession);
      setLoading(false);
    }

    if (!supabase) {
      if (!demoMode) setLoading(false);
      return;
    }

    if (!demoMode) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) checkProfile(session.user.id);
        else setLoading(false);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (demoMode && !newSession) return;
      setSession(newSession);
      if (newSession) checkProfile(newSession.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const demoMode = localStorage.getItem('demo_mode') === 'true';

  if (!supabase && !demoMode) {
    const handleBypass = () => {
      localStorage.setItem('demo_mode', 'true');
      window.location.reload();
    };

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Configuración Pendiente</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            No hemos detectado la conexión con Supabase en el Frontend. Puedes continuar en <b>Modo de Visualización</b> para ver el panel de WhatsApp.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleBypass}
              className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl transition-all font-bold shadow-lg shadow-green-900/40"
            >
              🚀 Entrar en Modo Demo
            </button>
            <a
              href="/qr-final"
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all font-bold text-slate-300 text-sm"
            >
              📱 Ver QR Directamente
            </a>
          </div>
        </div>
      </div>
    );
  }

  const checkProfile = async (userId) => {
    try {
      // Direct Supabase query (Faster & More Reliable)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        // If they have a subscription, consider onboarding complete
        setOnboardingComplete(!!profile.subscription_tier);
      } else {
        setOnboardingComplete(false);
      }
    } catch (e) {
      console.error("Profile check failed", e);
      setOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
  }

  const getRedirectPath = () => {
    if (!session) return "/login";
    return "/dashboard";
  };

  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to={getRedirectPath()} />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <WhatsAppConnect />
            </ProtectedRoute>
          } />

          {/* Utility Routes */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingWizard session={session} onComplete={() => { setOnboardingComplete(true); }} />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={<ProtectedRoute><AdminDashboard session={session} /></ProtectedRoute>} />
          <Route path="/saas" element={<SaasDashboard />} />
          <Route path="/payment-setup" element={<ProtectedRoute><PaymentSetup /></ProtectedRoute>} />

          <Route path="/" element={<LandingPage />} />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
