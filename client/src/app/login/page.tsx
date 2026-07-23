'use client';
import { useState, FormEvent, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, Globe, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '@/lib/api';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [adminOtpError, setAdminOtpError] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [step, setStep] = useState<'login' | 'otp' | 'email-otp'>('login');
  const [tempUserId, setTempUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login, verifyOtp, verifyEmailOtp } = useAuth();
  const router = useRouter();
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
  }, [resendCooldown]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter email and password'); return; }
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data?.otpRequired) {
        setTempUserId(data.userId);
        setMaskedEmail(data.maskedEmail || data.email);
        setStep('otp');
        toast.success('Enter the admin OTP shown on the dashboard');
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

  const handleVerifyAdminOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminOtp) { toast.error('Please enter the admin OTP'); return; }
    setLoading(true);
    setAdminOtpError('');
    try {
      const data = await verifyOtp(tempUserId, adminOtp);
      if (data.emailOtpRequired) {
        setMaskedEmail(data.maskedEmail || maskedEmail);
        setStep('email-otp');
        setResendCooldown(60);
        toast.success(`Email OTP sent to ${data.maskedEmail || maskedEmail}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setAdminOtpError(error?.response?.data?.message || 'Wrong OTP');
      setAdminOtp(''); // Clear input to let them enter the correct OTP
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailOtp) { toast.error('Please enter the email OTP'); return; }
    setLoading(true);
    setEmailOtpError('');
    try {
      await verifyEmailOtp(tempUserId, emailOtp);
      toast.success('Welcome back!');
      router.push('/home');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setEmailOtpError(error?.response?.data?.message || 'Wrong OTP');
      setEmailOtp(''); // Clear input to let them enter the correct OTP
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post('/auth/resend-email-otp', { userId: tempUserId });
      toast.success('OTP resent to your email');
      setResendCooldown(60);
    } catch {
      toast.error('Failed to resend OTP');
    }
  };

  const inputStyle = {
    paddingLeft: 36, height: 42, background: 'rgba(255,255,255,0.6)',
    border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13.5, width: '100%', outline: 'none',
    boxSizing: 'border-box' as const
  };

  const btnPrimary = (color = '#0f172a') => ({
    background: loading ? '#94a3b8' : color,
    color: 'white', border: 'none', borderRadius: 20, height: 44,
    fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, transition: 'all 0.15s',
    boxShadow: `0 4px 12px rgba(15,23,42,0.12)`, width: '100%'
  });

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: `radial-gradient(at 0% 0%, rgba(254,240,138,0.35) 0px, transparent 50%),
                     radial-gradient(at 50% 0%, rgba(253,164,175,0.35) 0px, transparent 50%),
                     radial-gradient(at 100% 0%, rgba(254,240,138,0.35) 0px, transparent 50%),
                     radial-gradient(at 0% 100%, rgba(254,215,170,0.35) 0px, transparent 50%),
                     radial-gradient(at 100% 100%, rgba(224,242,254,0.35) 0px, transparent 50%),
                     #ffffff`,
        fontFamily: "'Inter', -apple-system, sans-serif"
      }}
    >
      {/* Navbar */}
      <header style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="sidebar-logo-icon" style={{ background: '#0f172a', width: 28, height: 28, borderRadius: 8, fontSize: 14 }}>A</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Advent CRM</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#475569' }}>A lead management platform by Advent Systems</div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 80px' }}>
        <div style={{ width: '100%', maxWidth: 1100, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem,5vw,3.75rem)', fontWeight: 700, color: '#0f172a', lineHeight: 1.12, letterSpacing: '-0.03em', marginBottom: 20 }}>
              Manage your leads<br />
              <span style={{ background: 'linear-gradient(135deg,#1d4ed8,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>with precision</span>
            </h1>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#475569', marginBottom: 32, maxWidth: 480 }}>
              A powerful CRM platform to track, nurture, and convert your leads into loyal customers. Built for modern sales teams.
            </p>
            <a
              href="https://adventsystems.vercel.app" target="_blank" rel="noopener noreferrer"
              style={{ background: '#0f172a', color: 'white', padding: '12px 26px', borderRadius: 24, border: 'none', fontSize: 14.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.15)', textDecoration: 'none' }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Globe size={16} />Visit Website<ExternalLink size={14} style={{ opacity: 0.8 }} />
            </a>
          </div>

          {/* Right Column: Card */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: '100%', maxWidth: 420, borderRadius: 20, padding: '40px 36px',
                background: 'rgba(255,255,255,0.84)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08), 0 0 40px rgba(255,255,255,0.1) inset',
                transition: 'all 0.3s'
              }}
            >

              {/* ── STEP 1: Login ── */}
              {step === 'login' && (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                    <img src="/Logo.png" alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 14 }} />
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', textAlign: 'center' }}>Sign in</h2>
                    <p style={{ color: '#64748b', fontSize: 13, margin: 0, textAlign: 'center' }}>Enter your credentials to continue</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input id="login-email" type="email" style={inputStyle} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input id="login-password" type={showPassword ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 40 }} placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button id="login-submit" type="submit" disabled={loading} style={btnPrimary('#0f172a')}
                    onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'transparent' }} />Signing in...</> : 'Sign In'}
                  </button>
                </form>
              )}

              {/* ── STEP 2: Admin OTP ── */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyAdminOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <ShieldCheck size={26} color="white" />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', textAlign: 'center' }}>Step 1 of 2</h2>
                    <p style={{ color: '#64748b', fontSize: 13, margin: 0, textAlign: 'center' }}>Enter the <strong>daily admin OTP</strong> shown on the dashboard</p>
                  </div>

                  {/* Progress indicator */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: '#0f172a' }} />
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: '#e2e8f0' }} />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: adminOtpError ? '#ef4444' : '#9ca3af' }} />
                    <input
                      id="otp-input" type="text" autoFocus maxLength={6}
                      style={{ 
                        ...inputStyle, 
                        textAlign: 'center', 
                        letterSpacing: '0.4em', 
                        fontWeight: 800, 
                        fontSize: 20,
                        border: adminOtpError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                        boxShadow: adminOtpError ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                      }}
                      placeholder="000000" value={adminOtp}
                      onChange={e => {
                        setAdminOtp(e.target.value.replace(/\D/g, ''));
                        if (adminOtpError) setAdminOtpError('');
                      }} required
                    />
                  </div>
                  {adminOtpError && (
                    <div style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '-4px', textAlign: 'center', fontWeight: 500 }}>
                      {adminOtpError}
                    </div>
                  )}

                  <button id="otp-submit" type="submit" disabled={loading} style={btnPrimary('#0f172a')}
                    onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'transparent' }} />Verifying...</> : 'Verify Admin OTP →'}
                  </button>

                  <button type="button" onClick={() => { setStep('login'); setAdminOtp(''); setAdminOtpError(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginTop: 4, textDecoration: 'underline', alignSelf: 'center' }}>
                    ← Back to login
                  </button>
                </form>
              )}

              {/* ── STEP 3: Email OTP ── */}
              {step === 'email-otp' && (
                <form onSubmit={handleVerifyEmailOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#0284c7,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <Mail size={26} color="white" />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', textAlign: 'center' }}>Step 2 of 2</h2>
                    <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 2px', textAlign: 'center' }}>
                      Check your email — we sent a 6-digit code to
                    </p>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0284c7', textAlign: 'center' }}>{maskedEmail}</span>
                  </div>

                  {/* Progress indicator */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: '#0f172a' }} />
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: '#0284c7' }} />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: emailOtpError ? '#ef4444' : '#9ca3af' }} />
                    <input
                      id="email-otp-input" type="text" autoFocus maxLength={6}
                      style={{ 
                        ...inputStyle, 
                        textAlign: 'center', 
                        letterSpacing: '0.4em', 
                        fontWeight: 800, 
                        fontSize: 20,
                        border: emailOtpError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                        boxShadow: emailOtpError ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                      }}
                      placeholder="000000" value={emailOtp}
                      onChange={e => {
                        setEmailOtp(e.target.value.replace(/\D/g, ''));
                        if (emailOtpError) setEmailOtpError('');
                      }} required
                    />
                  </div>
                  {emailOtpError && (
                    <div style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '-4px', textAlign: 'center', fontWeight: 500 }}>
                      {emailOtpError}
                    </div>
                  )}

                  <button id="email-otp-submit" type="submit" disabled={loading} style={btnPrimary('#0284c7')}
                    onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'transparent' }} />Verifying...</> : '✓ Complete Login'}
                  </button>

                  {/* Resend button */}
                  <button
                    type="button" onClick={handleResendEmailOtp}
                    disabled={resendCooldown > 0}
                    style={{ background: 'none', border: 'none', color: resendCooldown > 0 ? '#9ca3af' : '#0284c7', fontSize: 13, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', alignSelf: 'center' }}
                  >
                    <RefreshCw size={13} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email OTP'}
                  </button>

                  <button type="button" onClick={() => { setStep('otp'); setEmailOtp(''); setEmailOtpError(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', alignSelf: 'center' }}>
                    ← Back to admin OTP
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ width: '100%', textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(15,23,42,0.04)', color: '#64748b', fontSize: 13 }}>
        © 2026 Advent CRM. All rights reserved.
      </footer>
    </div>
  );
}
