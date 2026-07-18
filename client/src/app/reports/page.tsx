'use client';
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Calendar, RefreshCw, BarChart2, CheckCircle2, Phone, Target, Database, CalendarDays, Mail, Send, X } from 'lucide-react';

interface AgentReport {
  agent: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  leadsAdded: number;
  callsAdded: number;
  tssAdded: number;
  eventsAdded: number;
  leadsFollowUps: number;
  callsFollowUps: number;
  tssFollowUps: number;
  eventsFollowUps: number;
}

interface ClosedSummary {
  leads: number;
  calls: number;
  events: number;
  tss: number;
  total: number;
}

interface SendReportModalProps {
  onClose: () => void;
  date: string;
}

function SendReportModal({ onClose, date }: SendReportModalProps) {
  const [selectedEmails, setSelectedEmails] = useState<string[]>(['adventsystems@gmail.com', 'jayanthramnithin@gmail.com']);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (selectedEmails.length === 0) {
      toast.error('Please select at least one email address');
      return;
    }
    setSending(true);
    try {
      await api.post('/users/reports/send', {
        date,
        emails: selectedEmails
      });
      toast.success('Reports sent successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send reports');
    } finally {
      setSending(false);
    }
  };

  const toggleEmail = (email: string) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ background: '#1e293b', padding: 24, borderRadius: 12, width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 18, margin: 0, fontWeight: 700 }}>Send Performance Report</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Select the email address(es) to receive the activity report for <strong>{new Date(date).toLocaleDateString()}</strong>:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {['adventsystems@gmail.com', 'jayanthramnithin@gmail.com'].map(email => {
            const checked = selectedEmails.includes(email);
            return (
              <label
                key={email}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: checked ? 'rgba(14,165,233,0.08)' : '#0f172a',
                  border: `1px solid ${checked ? '#0ea5e9' : '#334155'}`,
                  borderRadius: 8, cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s'
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEmail(email)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: checked ? '#f8fafc' : '#94a3b8', fontWeight: checked ? 600 : 500 }}>
                  {email}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '8px 18px', background: '#0ea5e9', border: 'none', color: '#fff',
              borderRadius: 8, cursor: sending ? 'wait' : 'pointer', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
            }}
          >
            {sending ? (
              <>Sending...</>
            ) : (
              <>
                <Send size={13} style={{ marginRight: 4 }} />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [closedSummary, setClosedSummary] = useState<ClosedSummary>({ leads: 0, calls: 0, events: 0, tss: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  // Compute column totals
  const totalLeadsAdded = reports.reduce((sum, r) => sum + r.leadsAdded, 0);
  const totalLeadsFollowUps = reports.reduce((sum, r) => sum + r.leadsFollowUps, 0);

  const totalCallsAdded = reports.reduce((sum, r) => sum + r.callsAdded, 0);
  const totalCallsFollowUps = reports.reduce((sum, r) => sum + r.callsFollowUps, 0);

  const totalTssAdded = reports.reduce((sum, r) => sum + r.tssAdded, 0);
  const totalTssFollowUps = reports.reduce((sum, r) => sum + r.tssFollowUps, 0);

  const totalEventsAdded = reports.reduce((sum, r) => sum + r.eventsAdded, 0);
  const totalEventsFollowUps = reports.reduce((sum, r) => sum + r.eventsFollowUps, 0);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/reports?date=${selectedDate}`);
      setReports(res.data?.reports || []);
      setClosedSummary(res.data?.closedSummary || { leads: 0, calls: 0, events: 0, tss: 0, total: 0 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedDate]);

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="Performance Reports">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px' }}>
            <Calendar size={15} style={{ color: '#64748b' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#334155', cursor: 'pointer' }}
            />
          </div>
          {/* Refresh Button */}
          <button
            onClick={fetchReports}
            className="btn-secondary"
            style={{ padding: '6px 10px', minWidth: 'unset', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          
          {/* Send Reports Button */}
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="btn-primary"
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}
            disabled={loading}
          >
            <Mail size={14} />
            Send Report
          </button>
        </div>
      </TopBar>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* Performance Table Section */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 20px', background: 'var(--sidebar-bg)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em' }}>AGENT ACTIVITY SUMMARY (NEW / FOLLOW-UP)</h3>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
              <div className="spinner spinner-dark" />
              <span style={{ fontSize: 13, color: '#64748b' }}>Generating report data...</span>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#64748b' }}>
              <BarChart2 size={36} style={{ color: '#cbd5e1' }} />
              <span style={{ fontSize: 14 }}>No active accounts found</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: 12 }}>
                      Account / Agent
                    </th>
                    <th style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                      Leads <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>(New / F.Up)</span>
                    </th>
                    <th style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                      Calls <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>(New / F.Up)</span>
                    </th>
                    <th style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                      TSS <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>(New / F.Up)</span>
                    </th>
                    <th style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                      Events <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>(New / F.Up)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((row) => (
                    <tr key={row.agent._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{row.agent.name}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{row.agent.email} • {row.agent.role}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                        <strong style={{ color: '#0f172a' }}>{row.leadsAdded}</strong>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.leadsFollowUps}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                        <strong style={{ color: '#0f172a' }}>{row.callsAdded}</strong>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.callsFollowUps}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                        <strong style={{ color: '#0f172a' }}>{row.tssAdded}</strong>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.tssFollowUps}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                        <strong style={{ color: '#0f172a' }}>{row.eventsAdded}</strong>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.eventsFollowUps}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ borderTop: '2px solid #cbd5e1' }}>
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td style={{ padding: '14px 16px', color: '#1e293b', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Total
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                      <strong style={{ color: '#0f172a' }}>{totalLeadsAdded}</strong>
                      <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>{totalLeadsFollowUps}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                      <strong style={{ color: '#0f172a' }}>{totalCallsAdded}</strong>
                      <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>{totalCallsFollowUps}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                      <strong style={{ color: '#0f172a' }}>{totalTssAdded}</strong>
                      <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>{totalTssFollowUps}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 14 }}>
                      <strong style={{ color: '#0f172a' }}>{totalEventsAdded}</strong>
                      <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>{totalEventsFollowUps}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Closed Records Summary Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Closed Records Overview
            </h3>
          </div>

          {loading ? (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner spinner-dark" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {/* Total Card */}
              <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: 20, borderRadius: 12, color: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Closed</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>{closedSummary.total}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: '50%' }}>
                  <CheckCircle2 size={24} />
                </div>
              </div>

              {/* Leads Card */}
              <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads Closed</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{closedSummary.leads}</div>
                </div>
                <div style={{ background: '#eff6ff', padding: 8, borderRadius: '50%', color: '#3b82f6' }}>
                  <Target size={20} />
                </div>
              </div>

              {/* Calls Card */}
              <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calls Closed</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{closedSummary.calls}</div>
                </div>
                <div style={{ background: '#fef3c7', padding: 8, borderRadius: '50%', color: '#d97706' }}>
                  <Phone size={20} />
                </div>
              </div>

              {/* TSS Card */}
              <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TSS Closed</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{closedSummary.tss}</div>
                </div>
                <div style={{ background: '#f5f3ff', padding: 8, borderRadius: '50%', color: '#7c3aed' }}>
                  <Database size={20} />
                </div>
              </div>

              {/* Events Card */}
              <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events Closed</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{closedSummary.events}</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: 8, borderRadius: '50%', color: '#10b981' }}>
                  <CalendarDays size={20} />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Send Report Modal */}
      {isSendModalOpen && (
        <SendReportModal date={selectedDate} onClose={() => setIsSendModalOpen(false)} />
      )}
    </ProtectedLayout>
  );
}
