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


function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      // CHECK DEMO MODE (Bypass)
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
        return;
      }

      setSession(session);
      if (session) checkProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const demoMode = localStorage.getItem('demo_mode') === 'true';
      if (demoMode && !newSession) return;

      setSession(newSession);
      if (newSession) checkProfile(newSession.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400 mb-4">Error de Conexión</h2>
          <p className="text-slate-300 mb-4">No se ha podido conectar con el servidor (Supabase).</p>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
