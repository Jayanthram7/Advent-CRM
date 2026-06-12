'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, BarChart2, Lock, Mail, Globe } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [tempUserId, setTempUserId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, verifyOtp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data?.otpRequired) {
        setTempUserId(data.userId);
        setStep('otp');
        toast.success('Please enter the daily OTP');
      } else {
        toast.success('Welcome back!');
        router.push('/home');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(tempUserId, otp);
      toast.success('Welcome back!');
      router.push('/home');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col" 
      style={{ 
        background: `radial-gradient(at 0% 0%, rgba(254, 240, 138, 0.35) 0px, transparent 50%),
                    radial-gradient(at 50% 0%, rgba(253, 164, 175, 0.35) 0px, transparent 50%),
                    radial-gradient(at 100% 0%, rgba(254, 240, 138, 0.35) 0px, transparent 50%),
                    radial-gradient(at 0% 100%, rgba(254, 215, 170, 0.35) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, rgba(224, 242, 254, 0.35) 0px, transparent 50%),
                    #ffffff`,
        fontFamily: "'Inter', -apple-system, sans-serif"
      }}
    >
      {/* Navbar */}
      <header className="w-full flex items-center justify-between px-6 lg:px-20 py-5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="sidebar-logo-icon" style={{ background: '#0f172a', width: 28, height: 28, borderRadius: 8, fontSize: 14 }}>A</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Advent CRM</span>
        </div>

        {/* Subtitle / Right Side Tagline */}
        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#475569', textAlign: 'right' }}>
          A lead management platform by Advent Systems
        </div>
      </header>

      {/* Main Hero / Content Section */}
      <main className="flex-1 flex items-center justify-center w-full max-w-[1200px] mx-auto px-6 lg:px-20 py-12">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Headline and Copy */}
          <div className="flex flex-col items-start text-left max-w-xl">
            <h1 
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.12,
                letterSpacing: '-0.03em',
                marginBottom: 20
              }}
            >
              Manage your leads<br />
              <span style={{ background: 'linear-gradient(135deg, #1d4ed8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>with precision</span>
            </h1>
            <p 
              style={{
                fontSize: '1.05rem',
                lineHeight: 1.6,
                color: '#475569',
                marginBottom: 32,
                maxWidth: 480
              }}
            >
              A powerful CRM platform to track, nurture, and convert your leads into loyal customers. Built for modern sales teams.
            </p>
            
            <a 
              href="https://adventsystems.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#0f172a',
                color: 'white',
                padding: '12px 26px',
                borderRadius: 24,
                border: 'none',
                fontSize: 14.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                textDecoration: 'none'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Globe size={16} />
              Visit Website
            </a>
          </div>

          {/* Right Column: Rounded Square Card with Login Form */}
          <div className="flex justify-center lg:justify-end w-full">
            <div 
              className="w-full max-w-[420px] rounded-2xl flex flex-col items-center justify-center p-8 sm:p-10 transition-all duration-300"
              style={{
                background: 'rgba(255, 255, 255, 0.82)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 40px rgba(255, 255, 255, 0.1) inset',
              }}
            >
              {/* Form centered in the card */}
              <div className="w-full flex flex-col gap-4">
                
                {step === 'login' ? (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center">
                      <img src="/Logo.png" alt="Logo" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 16 }} />
                      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>Sign in</h2>
                      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>Enter your credentials to continue</p>
                    </div>

                    <div className="form-group text-left">
                      <label className="form-label" style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email address</label>
                      <div style={{ position: 'relative', marginTop: 4 }}>
                        <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          id="login-email"
                          type="email"
                          className="form-input"
                          style={{ paddingLeft: 36, height: 40, background: 'rgba(255, 255, 255, 0.6)', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13.5 }}
                          placeholder="admin@example.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group text-left">
                      <label className="form-label" style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                      <div style={{ position: 'relative', marginTop: 4 }}>
                        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          style={{ paddingLeft: 36, paddingRight: 40, height: 40, background: 'rgba(255, 255, 255, 0.6)', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13.5 }}
                          placeholder="Enter password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      id="login-submit"
                      type="submit"
                      disabled={loading}
                      style={{
                        background: loading ? '#94a3b8' : '#0f172a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 20,
                        height: 42,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 12,
                        transition: 'all 0.15s',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                      }}
                      onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      {loading ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'transparent' }} />
                          Signing in...
                        </>
                      ) : 'Sign In'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center">
                      <img src="/Logo.png" alt="Logo" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 16 }} />
                      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>Verify OTP</h2>
                      <p style={{ color: '#64748b', fontSize: 12.5, marginBottom: 12, textAlign: 'center' }}>Enter the 6-digit OTP shown on the dashboard.</p>
                    </div>

                    <div className="form-group text-left">
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                          id="otp-input"
                          type="text"
                          className="form-input"
                          style={{ paddingLeft: 36, textAlign: 'center', letterSpacing: '0.4em', fontWeight: 800, fontSize: 17, height: 42, background: 'rgba(255, 255, 255, 0.6)', border: '1px solid #cbd5e1', borderRadius: 8 }}
                          placeholder="000000"
                          maxLength={6}
                          value={otp}
                          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      id="otp-submit"
                      type="submit"
                      disabled={loading}
                      style={{
                        background: loading ? '#94a3b8' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 20,
                        height: 42,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 12,
                        transition: 'all 0.15s',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
                      }}
                      onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      {loading ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'transparent' }} />
                          Verifying...
                        </>
                      ) : 'Verify OTP'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('login')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: 13,
                        cursor: 'pointer',
                        marginTop: 8,
                        textDecoration: 'underline',
                        alignSelf: 'center'
                      }}
                    >
                      Back to login
                    </button>
                  </form>
                )}

              </div>
            </div>
          </div>
          
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6" style={{ borderTop: '1px solid rgba(15, 23, 42, 0.04)', color: '#64748b', fontSize: 13 }}>
        &copy; 2026 Advent CRM. All rights reserved.
      </footer>
    </div>
  );
}
