'use client';
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import { format } from 'date-fns';
import { Clock, Calendar, CheckCircle, Database, Target, Mail, Phone, Building } from 'lucide-react';
import toast from 'react-hot-toast';

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-callback',
  'Interested': 'badge badge-interested',
  'Not Interested': 'badge badge-not-interested',
  'Follow Up': 'badge badge-followup',
  'Hot Lead': 'badge badge-hot',
  'Cold Lead': 'badge badge-cold',
  'Completed': 'badge badge-completed',
  'Closed': 'badge badge-closed',
};

export default function TodayPage() {
  const [view, setView] = useState<'lead' | 'tss'>('lead');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      if (view === 'lead') {
        const res = await api.get('/leads?today=true&limit=100');
        setRecords(res.data.leads || []);
      } else {
        const res = await api.get('/tss/records/today');
        setRecords(res.data.records || []);
      }
    } catch (err) {
      toast.error('Failed to load records for today');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [view]);

  return (
    <ProtectedLayout>
      <TopBar title="Today's Work" onRefresh={fetchRecords} />

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Scheduled for Today
          </h2>
          
          <select 
            className="form-select" 
            style={{ width: 200, fontWeight: 600, background: '#fff' }}
            value={view}
            onChange={(e) => setView(e.target.value as 'lead' | 'tss')}
          >
            <option value="lead">Lead Data</option>
            <option value="tss">TSS Data</option>
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div style={{ background: '#f8fafc', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#94a3b8' }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: 16, color: '#1e293b', margin: '0 0 8px 0' }}>All Caught Up</h3>
              <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>There are no {view === 'lead' ? 'leads' : 'TSS records'} scheduled for today.</p>
            </div>
          ) : (
            view === 'lead' ? (
              <div style={{ padding: '0 24px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Lead Name</th>
                      <th>Company</th>
                      <th>Reason</th>
                      <th>Phone</th>
                      <th>License #</th>
                      <th>Source</th>
                      <th>Labels</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(lead => (
                      <tr key={lead._id}>
                        <td>
                          {lead.installationDate ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                              <Calendar size={11} style={{ color: '#166534', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>{format(new Date(lead.installationDate), 'MMM d')}</span>
                            </div>
                          ) : lead.followUpDate ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                              <Clock size={11} style={{ color: '#b45309', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>{format(new Date(lead.followUpDate), 'MMM d')}</span>
                            </div>
                          ) : lead.callbackDate ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                              <Calendar size={11} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>{format(new Date(lead.callbackDate), 'MMM d')}</span>
                            </div>
                          ) : null}
                        </td>
                        <td><div style={{ fontWeight: 500 }}>{lead.firstName} {lead.lastName}</div></td>
                        <td>{lead.company || '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: 13 }}>{lead.reason || '—'}</td>
                        <td>{lead.phone || '—'}</td>
                        <td>{lead.licenseNumber || '—'}</td>
                        <td>{lead.leadSource}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(lead.labels || []).map((l: string) => <span key={l} className={LABEL_CLASSES[l] || 'badge'}>{l}</span>)}
                          </div>
                        </td>
                        <td style={{ color: '#9ca3af', fontSize: 13 }}>{format(new Date(lead.createdAt), 'MMM d')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ flex: 1, padding: '0 24px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', width: 280 }}>Customer Name</th>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile Number</th>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Serial Number</th>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rel. Version</th>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Labels</th>
                        <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr
                          key={r._id}
                          style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfd', transition: 'background 0.15s' }}
                          onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fcfcfd'}
                        >
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.customerName || '-'}>
                              {r.customerName || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px', color: '#475569', fontSize: 13 }}>{r.mobileNumber || '-'}</td>
                          <td style={{ padding: '12px 12px', color: '#475569', fontSize: 13 }}>{r.serialNumber || '-'}</td>
                          <td style={{ padding: '12px 12px', color: '#475569', fontSize: 13 }}>{r.releaseVersion || r.data?.Release || r.data?.['Release Version'] || '-'}</td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(r.labels || []).slice(0, 2).map((l: string) => <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 10 }}>{l}</span>)}
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {r.renewalDate && <span title={`Renewal: ${format(new Date(r.renewalDate), 'MMM d')}`} style={{ background: '#dcfce7', color: '#166534', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12}/> {format(new Date(r.renewalDate), 'MMM d')}</span>}
                              {r.followUpDate && !r.renewalDate && <span title={`Follow Up: ${format(new Date(r.followUpDate), 'MMM d')}`} style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> {format(new Date(r.followUpDate), 'MMM d')}</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
