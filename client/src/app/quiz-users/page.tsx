'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Search, Trash2, Mail, Phone, Building2, Award, Calendar
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
}

export default function QuizUsersPage() {
  const [claims, setClaims] = useState<QuizUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
