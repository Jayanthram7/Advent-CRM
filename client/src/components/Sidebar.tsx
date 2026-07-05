'use client';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Home, Users, Target, LogOut,
  ChevronDown, ChevronRight, ChevronLeft, Circle,
  Inbox, Clock, Calendar, CheckCircle2,
  Database, Upload, FileText, X, Phone, Building2, Contact, CheckSquare, Award, Mail
} from 'lucide-react';
import { useState, useEffect } from 'react';





export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout, isAdmin, sidebarCollapsed, toggleSidebar } = useAuth();

  const isLeadsActive = pathname === '/leads' || pathname.startsWith('/leads/');
  const isCallsActive = pathname === '/calls' || pathname.startsWith('/calls/');

  const isEventsActive = pathname.startsWith('/events');
  const [eventsOpen, setEventsOpen] = useState(isEventsActive);
  const [eventDatasets, setEventDatasets] = useState<any[]>([]);
  const [isEventImportModalOpen, setIsEventImportModalOpen] = useState(false);

  const isTssActive = pathname.startsWith('/tss');
  const [tssOpen, setTssOpen] = useState(isTssActive);
  const [tssDatasets, setTssDatasets] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [tssAuthModalOpen, setTssAuthModalOpen] = useState(false);
  const [tssAuthenticated, setTssAuthenticated] = useState(false);
  const [tssForm, setTssForm] = useState({ username: '', password: '' });
  const [tssAuthLoading, setTssAuthLoading] = useState(false);

  const [adminAuthStep, setAdminAuthStep] = useState(0); // 0=closed, 1=user/pass, 2=pin
  const [adminForm, setAdminForm] = useState({ username: '', password: '', pin: '' });
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminTargetRoute, setAdminTargetRoute] = useState('/users');

  useEffect(() => {
    fetch('/api/events/datasets', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEventDatasets(data);
      })
      .catch(err => console.error('Error fetching Event datasets:', err));
  }, [isEventImportModalOpen]);

  useEffect(() => {
    fetch('/api/tss/datasets', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTssDatasets(data);
      })
      .catch(err => console.error('Error fetching TSS datasets:', err));
  }, [isImportModalOpen]);



  // Keep expanded if navigating between Event views
  useEffect(() => {
    if (isEventsActive) setEventsOpen(true);
  }, [isEventsActive]);

  const currentView = searchParams.get('view');

  const isSubActive = (href: string, basePath: string) => {
    const view = href.split('view=')[1];
    return pathname === basePath && currentView === view;
  };

  const handleTssClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tssOpen) {
      setTssOpen(false);
    } else {
      if (tssAuthenticated || user?.email === 'jayanthramnithin@gmail.com') {
        setTssOpen(true);
      } else {
        setTssAuthModalOpen(true);
      }
    }
  };

  const handleTssAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTssAuthLoading(true);
    try {
      const res = await fetch('/api/tss/settings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(tssForm)
      });
      const data = await res.json();
      if (data.success) {
        setTssAuthenticated(true);
        setTssAuthModalOpen(false);
        setTssOpen(true);
        setTssForm({ username: '', password: '' });
      } else {
        alert('Invalid credentials');
      }
    } catch {
      alert('Error verifying credentials');
    } finally {
      setTssAuthLoading(false);
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthLoading(true);
    try {
      const res = await fetch('/api/users/settings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username: adminForm.username, password: adminForm.password })
      });
      if (res.ok) {
        setAdminAuthStep(2);
      } else {
        alert('Invalid credentials');
      }
    } catch (err) { alert('Error verifying admin credentials'); }
    finally { setAdminAuthLoading(false); }
  };

  const handleAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminForm.pin === '1811') {
      setAdminAuthStep(0);
      setAdminForm({ username: '', password: '', pin: '' });
      router.push(adminTargetRoute);
    } else {
      alert('Invalid PIN');
    }
  };

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      {sidebarCollapsed ? (
        <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
          <div className="sidebar-logo-icon">A</div>
          <button 
            onClick={toggleSidebar} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
            title="Expand Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo-icon">A</div>
            <span className="sidebar-logo-text">Advent CRM</span>
          </div>
          <button 
            onClick={toggleSidebar} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {/* Dashboard */}
        <Link
          href="/home"
          className={`sidebar-item ${pathname === '/home' ? 'active' : ''}`}
        >
          <Home size={15} />
          <span className="sidebar-item-text">Dashboard</span>
        </Link>

        {!sidebarCollapsed && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />}
        <div className="sidebar-section-title">Sales</div>

        {/* Leads */}
        <Link
          href="/leads"
          className={`sidebar-item ${isLeadsActive ? 'active' : ''}`}
        >
          <Target size={15} />
          <span className="sidebar-item-text">Leads</span>
        </Link>

        {/* Calls */}
        <Link
          href="/calls"
          className={`sidebar-item ${isCallsActive ? 'active' : ''}`}
        >
          <Phone size={15} />
          <span className="sidebar-item-text">Calls</span>
        </Link>

        {/* Events parent row */}
        <Link
          href="#"
          onClick={(e) => { e.preventDefault(); setEventsOpen(o => !o); }}
          className={`sidebar-item ${isEventsActive ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', paddingRight: sidebarCollapsed ? 0 : 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={15} />
            <span className="sidebar-item-text">Events</span>
          </div>
          {!sidebarCollapsed && (
            <div style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="sidebar-arrow" style={{ opacity: 0.5, transition: 'transform 0.2s', transform: eventsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'flex' }}>
                <ChevronDown size={13} />
              </span>
            </div>
          )}
        </Link>

        {/* Events Sub-items */}
        {eventsOpen && !sidebarCollapsed && (
          <div style={{ marginLeft: 0 }}>
            {user?.role !== 'Agent' && (
              <div
                onClick={() => setIsEventImportModalOpen(true)}
                className="sidebar-item"
                style={{ paddingLeft: 38, fontSize: 13, cursor: 'pointer', color: '#38bdf8' }}
              >
                <Upload size={13} style={{ opacity: 1 }} />
                <span className="sidebar-item-text">Import Event</span>
              </div>
            )}

            {eventDatasets.map((ds) => {
              const href = `/events/${ds._id}`;
              const active = pathname === href;
              return (
                <Link
                  key={ds._id}
                  href={href}
                  className={`sidebar-item ${active ? 'active' : ''}`}
                  style={{ paddingLeft: 38, fontSize: 13 }}
                >
                  <FileText size={13} style={{ opacity: active ? 1 : 0.6 }} />
                  <span className="sidebar-item-text">{ds.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Tasks */}
        <Link
          href="/tasks"
          className={`sidebar-item ${pathname === '/tasks' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <CheckSquare size={15} />
          <span className="sidebar-item-text">Tasks</span>
        </Link>

        {/* TSS Section */}
        {isAdmin && (
          <>
            {!sidebarCollapsed && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />}
            <div className="sidebar-section-title">Operations</div>

            <Link
              href="#"
              onClick={handleTssClick}
              className={`sidebar-item ${isTssActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', paddingRight: sidebarCollapsed ? 0 : 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={15} />
                <span className="sidebar-item-text">TSS</span>
              </div>
              {!sidebarCollapsed && (
                <div style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="sidebar-arrow" style={{ opacity: 0.5, transition: 'transform 0.2s', transform: tssOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'flex' }}>
                    <ChevronDown size={13} />
                  </span>
                </div>
              )}
            </Link>

            {tssOpen && !sidebarCollapsed && (
              <div style={{ marginLeft: 0 }}>
                {user?.role !== 'Agent' && (
                  <div
                    onClick={() => setIsImportModalOpen(true)}
                    className="sidebar-item"
                    style={{ paddingLeft: 38, fontSize: 13, cursor: 'pointer', color: '#38bdf8' }}
                  >
                    <Upload size={13} style={{ opacity: 1 }} />
                    <span className="sidebar-item-text">Import Data</span>
                  </div>
                )}

                {tssDatasets.map((ds) => {
                  const href = `/tss/${ds._id}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={ds._id}
                      href={href}
                      className={`sidebar-item ${active ? 'active' : ''}`}
                      style={{ paddingLeft: 38, fontSize: 13 }}
                    >
                      <FileText size={13} style={{ opacity: active ? 1 : 0.6 }} />
                      <span className="sidebar-item-text">{ds.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {isAdmin && (
          <>
            {!sidebarCollapsed && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />}
            <div className="sidebar-section-title">Admin</div>
            <div
              onClick={() => {
                if (pathname !== '/users') {
                  if (user?.email === 'jayanthramnithin@gmail.com') {
                    router.push('/users');
                  } else {
                    setAdminTargetRoute('/users');
                    setAdminAuthStep(1);
                  }
                }
              }}
              className={`sidebar-item ${pathname === '/users' ? 'active' : ''}`}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            >
              <Users size={15} />
              <span className="sidebar-item-text">Users</span>
            </div>
            <div
              onClick={() => {
                if (pathname !== '/customers') {
                  if (user?.email === 'jayanthramnithin@gmail.com') {
                    router.push('/customers');
                  } else {
                    setAdminTargetRoute('/customers');
                    setAdminAuthStep(1);
                  }
                }
              }}
              className={`sidebar-item ${pathname === '/customers' ? 'active' : ''}`}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginTop: 4 }}
            >
              <Contact size={15} />
              <span className="sidebar-item-text">Customers</span>
            </div>
            <div
              onClick={() => {
                if (pathname !== '/quiz-users') {
                  if (user?.email === 'jayanthramnithin@gmail.com') {
                    router.push('/quiz-users');
                  } else {
                    setAdminTargetRoute('/quiz-users');
                    setAdminAuthStep(1);
                  }
                }
              }}
              className={`sidebar-item ${pathname === '/quiz-users' ? 'active' : ''}`}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginTop: 4 }}
            >
              <Award size={15} />
              <span className="sidebar-item-text">Quiz users</span>
            </div>
            <div
              onClick={() => {
                if (pathname !== '/send-emails') {
                  if (user?.email === 'jayanthramnithin@gmail.com') {
                    router.push('/send-emails');
                  } else {
                    setAdminTargetRoute('/send-emails');
                    setAdminAuthStep(1);
                  }
                }
              }}
              className={`sidebar-item ${pathname === '/send-emails' ? 'active' : ''}`}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginTop: 4 }}
            >
              <Mail size={15} />
              <span className="sidebar-item-text">Send Emails</span>
            </div>
          </>
        )}
      </nav>

      {/* User info */}
      <div className="sidebar-user-container" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', flexDirection: 'column', alignItems: sidebarCollapsed ? 'center' : 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, width: '100%', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
            {user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="sidebar-user-text" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ color: '#64748b', fontSize: 11 }}>{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-signout-btn"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            color: '#94a3b8', fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <LogOut size={14} />
          <span className="sidebar-signout-text">Sign out</span>
        </button>
      </div>
      
      {/* Dynamic Import to avoid SSR issues with Modal */}
      {isImportModalOpen && (
        <TssImportModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {isEventImportModalOpen && (
        <EventImportModal onClose={() => setIsEventImportModalOpen(false)} />
      )}

      {/* TSS Authentication Modal */}
      {tssAuthModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setTssAuthModalOpen(false)}>
          <div className="modal" style={{ background: '#1e293b', padding: 24, borderRadius: 12, width: 340, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ color: '#f8fafc', fontSize: 18, margin: 0 }}>TSS Authentication</h2>
              <button onClick={() => setTssAuthModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleTssAuthSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Please enter the TSS credentials to access this section.</p>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Username</label>
                  <input type="text" value={tssForm.username} onChange={e => setTssForm(f => ({ ...f, username: e.target.value }))} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', outline: 'none' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Password</label>
                  <input type="password" value={tssForm.password} onChange={e => setTssForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', outline: 'none' }} required />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button type="button" onClick={() => setTssAuthModalOpen(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={tssAuthLoading} style={{ padding: '8px 16px', background: '#0ea5e9', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>
                    {tssAuthLoading ? 'Verifying...' : 'Unlock Access'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminAuthStep === 1 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '100%', maxWidth: 360, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Admin Access</h3>
              <button onClick={() => setAdminAuthStep(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdminAuth}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>Username</label>
                <input type="text" className="form-input" style={{ width: '100%' }} value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} autoFocus required />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>Password</label>
                <input type="password" className="form-input" style={{ width: '100%' }} value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAdminAuthStep(0)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adminAuthLoading}>{adminAuthLoading ? 'Verifying...' : 'Continue'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminAuthStep === 2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '100%', maxWidth: 360, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Enter PIN</h3>
              <button onClick={() => setAdminAuthStep(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Please enter the 4-digit PIN to access the Admin panel.</p>
            <form onSubmit={handleAdminPin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>PIN</label>
                <input type="password" maxLength={4} style={{ width: '100%', fontSize: 24, letterSpacing: '0.5em', textAlign: 'center', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} value={adminForm.pin} onChange={e => setAdminForm({...adminForm, pin: e.target.value})} autoFocus required />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAdminAuthStep(0)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Verify PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline simple Modal component
function TssImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file || !name.trim()) return alert('Name and File are required');
    setLoading(true);

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const records = XLSX.utils.sheet_to_json(firstSheet);

          const res = await fetch('/api/tss/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name, records })
          });

          if (!res.ok) throw new Error('Failed to import');
          onClose();
        } catch (err) {
          console.error(err);
          alert('Error parsing or importing Excel file');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Error loading xlsx', err);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#1e293b', padding: 24, borderRadius: 12,
        width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #334155'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: 18 }}>Import TSS Data</h3>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Dataset Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', outline: 'none' }}
            placeholder="e.g. October Imports"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Excel File</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ width: '100%', color: '#94a3b8', fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !file || !name.trim()}
            style={{ padding: '8px 16px', background: '#0ea5e9', border: 'none', color: '#fff', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontWeight: 500 }}
          >
            {loading ? 'Importing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [importLater, setImportLater] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!name.trim()) return alert('Event Name is required');
    if (!importLater && !file) return alert('Excel file is required');
    setLoading(true);

    try {
      if (importLater) {
        // Create empty event dataset
        const res = await fetch('/api/events/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ name, records: [] })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Failed to create event');
        }
        const dataJson = await res.json();
        onClose();
        if (dataJson.datasetId) {
          router.push(`/events/${dataJson.datasetId}`);
        }
      } else {
        // Load and parse Excel file
        const XLSX = await import('xlsx');
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const records = XLSX.utils.sheet_to_json(firstSheet);

            const res = await fetch('/api/events/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ name, records })
            });

            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.message || 'Failed to import');
            }
            const dataJson = await res.json();
            onClose();
            if (dataJson.datasetId) {
              router.push(`/events/${dataJson.datasetId}`);
            }
          } catch (err: any) {
            console.error(err);
            alert(err.message || 'Error parsing or importing Excel file');
          } finally {
            setLoading(false);
          }
        };

        reader.readAsArrayBuffer(file!);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error creating event dataset');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#1e293b', padding: 24, borderRadius: 12,
        width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #334155'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: 18 }}>Import Event Data</h3>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Event Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', outline: 'none' }}
            placeholder="e.g. INTEC 2026"
          />
        </div>

        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="importLater"
            checked={importLater}
            onChange={e => {
              setImportLater(e.target.checked);
              if (e.target.checked) setFile(null);
            }}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="importLater" style={{ fontSize: 13.5, color: '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}>
            Import Excel Later
          </label>
        </div>

        {!importLater && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Excel File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ width: '100%', color: '#94a3b8', fontSize: 13 }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: importLater ? 20 : 0 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !name.trim() || (!importLater && !file)}
            style={{ padding: '8px 16px', background: '#0ea5e9', border: 'none', color: '#fff', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontWeight: 500 }}
          >
            {loading ? 'Creating...' : importLater ? 'Create Event' : 'Import Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
