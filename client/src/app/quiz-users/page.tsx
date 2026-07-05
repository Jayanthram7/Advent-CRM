'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Search, Trash2, Mail, Phone, Building2, Award, Calendar, UserPlus, X, Plus, Check
} from 'lucide-react';
import { format } from 'date-fns';

interface QuizUser {
  _id: string;
  name: string;
  phone: string;
  email: string;
  organization: string;
  score: number;
  totalQuestions: number;
  createdAt: string;
  isConverted?: boolean;
}

const SOURCE_OPTIONS = ['Website', 'Cold Call', 'Referral', 'Social Media', 'Email Campaign', 'Walk-in', 'Other'];

// ─── Create Lead Modal ───────────────────────────────────────────────────────
function CreateLeadModal({ 
  onClose, 
  onCreated, 
  initialData 
}: { 
  onClose: () => void; 
  onCreated: () => void; 
  initialData?: any 
}) {
  const [form, setForm] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    secondaryPhone: '',
    company: initialData?.company || '',
    licenseNumber: '',
    leadSource: 'Other',
    address: '',
    reason: initialData?.reason || '',
    labels: ['Open']
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      toast.error('First and last name are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/leads', form);
      toast.success('Lead created successfully!');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Lead</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="form-input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="John" required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input className="form-input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Doe" required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Secondary Phone</label>
                <input className="form-input" value={form.secondaryPhone} onChange={e => set('secondaryPhone', e.target.value)} placeholder="+1 555 000 0001" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Inc." />
              </div>
              <div className="form-group">
                <label className="form-label">License Number</label>
                <input className="form-input" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="LIC-12345" />
              </div>
              <div className="form-group">
                <label className="form-label">Lead Source</label>
                <select 
                  className="form-input" 
                  value={form.leadSource} 
                  onChange={e => set('leadSource', e.target.value)}
                  style={{ height: '42px', padding: '9px 12px' }}
                >
                  {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, Country" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Reason</label>
                <textarea
                  className="form-input"
                  value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                  placeholder="Reason for enquiry..."
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : <><Plus size={15} />Create Lead</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function QuizUsersPage() {
  const [claims, setClaims] = useState<QuizUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Lead creation modal state
  const [leadModal, setLeadModal] = useState<{ open: boolean; initialData?: any }>({ open: false });

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) {
        params.search = search.trim();
      }
      const res = await api.get('/claims', { params });
      setClaims(res.data);
    } catch (err) {
      toast.error('Failed to fetch quiz users');
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Debounced search fetch
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchClaims();
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [search, fetchClaims]);

  const deleteClaim = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the quiz record for ${name}?`)) return;
    try {
      await api.delete(`/claims/${id}`);
      toast.success('Record deleted successfully');
      fetchClaims();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const handleConvertClick = (claim: QuizUser) => {
    const nameParts = claim.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '—';

    setLeadModal({
      open: true,
      initialData: {
        firstName,
        lastName,
        email: claim.email,
        phone: claim.phone,
        company: claim.organization || '',
        reason: `Converted from Quiz App submission. Scored ${claim.score}/${claim.totalQuestions}.`
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'Q';
  };

  const getScoreBadge = (score: number, total: number) => {
    const percentage = total > 0 ? (score / total) * 100 : 0;
    let bg = '#f3f4f6'; // Gray
    let color = '#374151';

    if (percentage === 100) {
      bg = '#dcfce7'; // Light green
      color = '#15803d'; // Dark green
    } else if (percentage >= 80) {
      bg = '#e0f2fe'; // Light blue
      color = '#0369a1'; // Dark blue
    } else if (percentage >= 50) {
      bg = '#fef3c7'; // Light amber
      color = '#d97706'; // Dark amber
    } else {
      bg = '#fee2e2'; // Light red
      color = '#b91c1c'; // Dark red
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: bg,
        color: color
      }}>
        {score} / {total} ({percentage.toFixed(0)}%)
      </span>
    );
  };

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="Quiz Users" onRefresh={fetchClaims} />

      <div style={{ padding: 24 }}>
        {/* Search Bar */}
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by name, email, phone, organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button 
              className="btn-secondary"
              onClick={() => setSearch('')}
              style={{
                background: 'white',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                color: '#ef4444',
                borderColor: '#fca5a5',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Claims Table Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 12 }}>
              <div className="spinner spinner-dark" />
              <span style={{ color: '#64748b', fontSize: 13.5 }}>Loading quiz users...</span>
            </div>
          ) : claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
              <Award size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>No Quiz Users Found</h3>
              <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>
                {search ? 'Try clearing search filters.' : 'Quiz submissions will appear here once users finish the quiz app.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Score / Progress</th>
                    <th>Organization</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Submission Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim._id} style={{ transition: 'background-color 0.15s' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ 
                            width: 32, 
                            height: 32, 
                            fontSize: 11, 
                            fontWeight: 700, 
                            background: '#e0f2fe',
                            color: '#0369a1'
                          }}>
                            {getInitials(claim.name)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{claim.name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {getScoreBadge(claim.score, claim.totalQuestions)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13.5, fontWeight: 500 }}>
                          <Building2 size={14} style={{ color: '#94a3b8' }} />
                          {claim.organization || '—'}
                        </div>
                      </td>
                      <td>
                        <a href={`mailto:${claim.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1a73e8', textDecoration: 'none', fontSize: 13 }} title={`Email ${claim.name}`}>
                          <Mail size={13} />
                          {claim.email}
                        </a>
                      </td>
                      <td>
                        <a href={`tel:${claim.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1a73e8', textDecoration: 'none', fontSize: 13 }} title={`Call ${claim.name}`}>
                          <Phone size={13} />
                          {claim.phone}
                        </a>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          {format(new Date(claim.createdAt), 'MMM dd, yyyy hh:mm a')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            onClick={() => handleConvertClick(claim)}
                            style={{
                              padding: '6px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              background: claim.isConverted ? '#22c55e' : '#1a73e8',
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              transition: 'background-color 0.2s'
                            }}
                            title={claim.isConverted ? "Already Converted (Click to add again)" : "Convert to CRM Lead"}
                          >
                            {claim.isConverted ? <Check size={14} /> : <UserPlus size={14} />}
                          </button>
                          <button
                            onClick={() => deleteClaim(claim._id, claim.name)}
                            className="btn-danger"
                            style={{
                              padding: '6px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Delete submission record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Render Lead Creation Modal */}
      {leadModal.open && (
        <CreateLeadModal 
          initialData={leadModal.initialData}
          onClose={() => setLeadModal({ open: false })}
          onCreated={() => {
            fetchClaims();
          }}
        />
      )}
    </ProtectedLayout>
  );
}
