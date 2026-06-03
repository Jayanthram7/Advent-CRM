'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, BarChart2, Lock, Mail } from 'lucide-react';

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
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f1229 0%, #1a1f36 50%, #0d1b4b 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="sidebar-logo-icon">A</div>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>Advent CRM</span>
        </div>
        
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
            Manage your leads<br />
            <span style={{ color: '#60a5fa' }}>with precision</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.6, maxWidth: 380 }}>
            A powerful CRM platform to track, nurture, and convert your leads into loyal customers. Built for modern sales teams.
          </p>
          
          <div className="flex gap-6 mt-10">
            {[
              { label: 'Leads Tracked', value: '10K+' },
              { label: 'Conversion Rate', value: '34%' },
              { label: 'Teams Using', value: '500+' },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#60a5fa' }}>{stat.value}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ color: '#475569', fontSize: 13 }}>
          © 2024 Advent CRM. All rights reserved.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div style={{ 
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 20,
            padding: '40px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
          }}>
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="sidebar-logo-icon">A</div>
              <span style={{ fontWeight: 700, color: '#1a1f36' }}>Advent CRM</span>
            </div>
            
            <div className="mb-8">
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1f36', marginBottom: 6 }}>
                Sign in
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14 }}>
                Enter your credentials to access the platform
              </p>
            </div>

            {step === 'login' ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      id="login-email"
                      type="email"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="admin@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingLeft: 36, paddingRight: 40 }}
                      placeholder="Enter password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#93c5fd' : '#1a73e8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 18, height: 18 }} />
                      Signing in...
                    </>
                  ) : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
                <div className="form-group">
                  <label className="form-label">Daily OTP</label>
                  <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
                    Please enter the 6-digit daily OTP shown on the admin dashboard.
                  </p>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      id="otp-input"
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36, textAlign: 'center', letterSpacing: '0.5em', fontWeight: 800, fontSize: 18 }}
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
                    background: loading ? '#93c5fd' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 18, height: 18 }} />
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
                    fontSize: 14,
                    cursor: 'pointer',
                    marginTop: 8,
                    textDecoration: 'underline'
                  }}
                >
                  Back to login
                </button>
              </form>
            )}


            <div style={{ marginTop: 24, padding: '14px 16px', background: '#f0f5ff', borderRadius: 10, border: '1px solid #dbeafe' }}>
              <p style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <BarChart2 size={12} /> Demo Credentials
              </p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                Email: <code style={{ background: '#e0ecff', padding: '1px 4px', borderRadius: 3 }}>jayanthramnithin@gmail.com</code>
              </p>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Password: <code style={{ background: '#e0ecff', padding: '1px 4px', borderRadius: 3 }}>181104</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
