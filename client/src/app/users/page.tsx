'use client';
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, X, Edit2, UserCheck, UserX, Trash2, KeyRound, Database, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent';
  status: 'Active' | 'Inactive';
  createdAt: string;
}

const ROLE_CLASSES: Record<string, string> = {
  Admin: 'role-badge role-admin',
  Manager: 'role-badge role-manager',
  Agent: 'role-badge role-agent',
};

function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ username: '', password: '', businessStartTime: '', businessEndTime: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/users/settings/credentials')
      .then(res => { 
        setForm({ 
          username: res.data.username, 
          password: res.data.password,
          businessStartTime: res.data.businessStartTime || '09:30',
          businessEndTime: res.data.businessEndTime || '17:30'
        }); 
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/users/settings/credentials', form);
      toast.success('Admin credentials updated');
      onClose();
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#fef2f2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <KeyRound size={18} />
            </div>
            <h2 className="modal-title">Admin Page Credentials</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        {fetching ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Loading settings...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Set the username and password required to access this admin panel from the sidebar.</p>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Business Start Time</label>
                  <input className="form-input" type="time" value={form.businessStartTime} onChange={e => setForm(f => ({ ...f, businessStartTime: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Business End Time</label>
                  <input className="form-input" type="time" value={form.businessEndTime} onChange={e => setForm(f => ({ ...f, businessEndTime: e.target.value }))} required />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Update Credentials'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'Agent'
  });
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && (!form.name || !form.email || !form.password)) {
      toast.error('All fields are required'); return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        const update: Record<string, string> = { role: form.role };
        if (form.name) update.name = form.name;
        if (form.password) update.password = form.password;
        await api.put(`/users/${user._id}`, update);
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name {!isEdit && '*'}</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required={!isEdit} />
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Password {isEdit ? '(leave blank to keep)' : '*'}</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required={!isEdit} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'Admin' | 'Manager' | 'Agent' }))}>
                <option>Admin</option>
                <option>Manager</option>
                <option>Agent</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} />Saving...</> : isEdit ? 'Save Changes' : <><Plus size={14} />Add User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TssCredentialsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/tss/settings/credentials')
      .then(r => { setForm({ username: r.data.username || '', password: r.data.password || '' }); setFetching(false); })
      .catch(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/tss/settings/credentials', form);
      toast.success('TSS credentials updated!');
      onClose();
    } catch { toast.error('Failed to update credentials'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">TSS Access Credentials</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        {fetching ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px 0' }}><div className="spinner spinner-dark" style={{ width: 24, height: 24, margin: '0 auto' }} /></div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">TSS Username</label>
                <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">TSS Password</label>
                <input className="form-input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} />Saving...</> : 'Save Credentials'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; user?: User }>({ open: false });
  const [tssModalOpen, setTssModalOpen] = useState(false);
  const [adminSettingsModalOpen, setAdminSettingsModalOpen] = useState(false);
  const [dailyOtp, setDailyOtp] = useState<string | null>(null);
  const [otpRefreshing, setOtpRefreshing] = useState(false);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));



  const fetchDailyOtp = async () => {
    try {
      const res = await api.get('/auth/daily-otp');
      setDailyOtp(res.data.otp);
    } catch (err) {
      console.error('Failed to fetch daily OTP');
    }
  };

  const handleRefreshOtp = async () => {
    if (!confirm('Are you sure you want to change the daily OTP? All users currently logging in will need the new code.')) return;
    setOtpRefreshing(true);
    try {
      const res = await api.post('/auth/refresh-otp');
      setDailyOtp(res.data.otp);
      toast.success('OTP Refreshed Successfully');
    } catch (err) {
      toast.error('Failed to refresh OTP');
    } finally {
      setOtpRefreshing(false);
    }
  };


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginLogs = async (date = filterDate) => {
    setLogsLoading(true);
    try {
      const res = await api.get('/users/login-logs', { params: { date } });
      setLoginLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch login logs');
    } finally {
      setLogsLoading(false);
    }
  };



  useEffect(() => { 
    fetchUsers();
    fetchDailyOtp();
    fetchLoginLogs();
  }, []);



  const toggleStatus = async (user: User) => {
    try {
      await api.put(`/users/${user._id}`, { status: user.status === 'Active' ? 'Inactive' : 'Active' });
      toast.success(`User ${user.status === 'Active' ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update status'); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch { toast.error('Failed to delete user'); }
  };

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="Users" onRefresh={fetchUsers}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ background: 'white' }} onClick={() => setAdminSettingsModalOpen(true)}><KeyRound size={14} /> Admin Access</button>
          <button className="btn-secondary" style={{ background: 'white' }} onClick={() => setTssModalOpen(true)}><Database size={14} /> TSS Credentials</button>
          <button className="btn-primary" onClick={() => setModal({ open: true })}><Plus size={14} />Add User</button>
        </div>
      </TopBar>

      <div style={{ padding: 24 }}>
        {/* Daily OTP Card */}
        {dailyOtp && (
          <div style={{ 
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', margin: '0 0 4px 0' }}>Daily Login OTP</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>This code is required for all non-admin users to log in today.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                fontSize: 32, 
                fontWeight: 800, 
                letterSpacing: '4px',
                background: 'rgba(255,255,255,0.05)',
                padding: '8px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'monospace'
              }}>
                {dailyOtp}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={handleRefreshOtp}
                  disabled={otpRefreshing}
                  title="Generate New OTP"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    padding: '10px',
                    color: 'white',
                    cursor: otpRefreshing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <RefreshCw size={18} className={otpRefreshing ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(dailyOtp);
                    toast.success('OTP copied to clipboard');
                  }}
                  style={{
                    background: '#1a73e8',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 16px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Copy Code
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>

          {loading ? (
            <div className="empty-state"><div className="spinner spinner-dark" style={{ width: 32, height: 32 }} /></div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>No users yet.</p>
              <button className="btn-primary" onClick={() => setModal({ open: true })}><Plus size={14} />Add First User</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#6b7280' }}>{user.email}</td>
                    <td><span className={ROLE_CLASSES[user.role]}>{user.role}</span></td>
                    <td>
                      <span className={`badge ${user.status === 'Active' ? 'badge-interested' : 'badge-not-interested'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ color: '#9ca3af', fontSize: 12.5 }}>{format(new Date(user.createdAt), 'MMM d, yyyy')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button title="Edit" onClick={() => setModal({ open: true, user })}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151' }}>
                          <Edit2 size={14} />
                        </button>
                        <button title={user.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(user)}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: user.status === 'Active' ? '#f59e0b' : '#10b981' }}>
                          {user.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button title="Delete" onClick={() => deleteUser(user._id)}
                          style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Login Logs Table */}
        <div style={{ marginTop: 40, marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Login History</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>View authentication logs by date</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input 
                type="date" 
                className="form-input" 
                value={filterDate} 
                onChange={e => {
                  setFilterDate(e.target.value);
                  fetchLoginLogs(e.target.value);
                }} 
                style={{ width: 160, padding: '7px 10px' }}
              />
              <button className="btn-secondary" onClick={() => fetchLoginLogs()} disabled={logsLoading}>
                {logsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>IP Address</th>

                  <th>Browser / Device</th>
                  <th>Login Time</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No login logs found</td></tr>
                ) : (
                  loginLogs.map((log: any) => (
                    <tr key={log._id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.userName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{log.userEmail}</div>
                      </td>
                      <td>
                        <span className={`badge ${log.user?.role === 'Admin' ? 'badge-hot-lead' : 'badge-open'}`} style={{ fontSize: 11 }}>
                          {log.user?.role || 'User'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${log.status === 'Success' ? 'badge-converted' : log.status === 'Blocked (Time)' ? 'badge-not-interested' : 'badge-call-back'}`} style={{ fontSize: 11 }}>
                          {log.status || 'Success'}
                        </span>
                      </td>

                      <td style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>{log.ip || '—'}</td>
                      <td style={{ fontSize: 11, color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.userAgent}>
                        {log.userAgent || '—'}
                      </td>
                      <td style={{ fontSize: 13, color: '#475569' }}>
                        {format(new Date(log.createdAt), 'MMM d, yyyy • h:mm a')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      {modal.open && (
        <UserModal user={modal.user} onClose={() => setModal({ open: false })} onSaved={fetchUsers} />
      )}
      {tssModalOpen && <TssCredentialsModal onClose={() => setTssModalOpen(false)} />}
      {adminSettingsModalOpen && <AdminSettingsModal onClose={() => setAdminSettingsModalOpen(false)} />}
    </ProtectedLayout>
  );
}
