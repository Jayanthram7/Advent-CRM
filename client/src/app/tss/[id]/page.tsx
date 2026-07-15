'use client';
import { useState, useEffect, useRef, use } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, X, FileText, Search, Database, MoreVertical, Tag, Clock, Calendar, CheckCircle, BarChart3, Filter, Trash2, RefreshCw, Users, AlertCircle, Edit, Send, MessageCircle, Mail } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import AnalyticsModalComponent from '@/components/AnalyticsModal';
import { useSearchParams } from 'next/navigation';

const LABEL_OPTIONS = ['Open', 'Call Back', 'Follow Up', 'Review', 'Closed'];
const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Follow Up': 'badge badge-follow-up',
  'Review': 'badge badge-review',
  'Closed': 'badge badge-closed',
};

export interface TssRecord {
  _id: string;
  datasetId: string;
  customerName: string;
  serialNumber: string;
  flavour: string;
  mobileNumber: string;
  releaseVersion?: string;
  labels: string[];
  status: string;
  callbackDate?: string;
  followUpDate?: string;
  renewalDate?: string;
  data: Record<string, any>;
  notes?: { _id: string; content: string; authorName: string; createdAt: string }[];
  createdAt: string;
  assignedTo?: string | {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

// ─── Row Menu ──────────────────────────────────────────────────────────────────
function RowMenu({ record, onRefresh, users }: { record: TssRecord; onRefresh: () => void; users: any[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'labels' | 'date_followup' | 'date_renewal' | 'note' | 'assign' | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(record.labels || []);
  const [date, setDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSubmenu(null); setNoteOpen(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const saveLabels = async () => {
    try {
      await api.put(`/tss/records/${record._id}/labels`, { labels: selectedLabels });
      toast.success('Labels updated');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update labels'); }
  };

  const saveDate = async (type: 'followUpDate' | 'renewalDate') => {
    try {
      await api.put(`/tss/records/${record._id}/dates`, { [type]: date });
      toast.success('Date set');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to set date'); }
  };

  const closeRecord = async () => {
    try {
      await api.put(`/tss/records/${record._id}/labels`, { status: 'Closed' });
      toast.success('Record marked as closed!');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to close record'); }
  };

  const saveNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post(`/tss/records/${record._id}/notes`, { content: newNote });
      toast.success('Note added');
      setNewNote('');
      setNoteOpen(false);
      onRefresh();
    } catch { toast.error('Failed to add note'); }
  };

  const deleteRecord = async () => {
    if (!confirm('Delete this TSS record? This cannot be undone.')) return;
    try {
      await api.delete(`/tss/records/${record._id}`);
      toast.success('Record deleted');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to delete record'); }
  };

  const handleAssign = async (userId: string | null) => {
    try {
      await api.put(`/tss/records/${record._id}`, { assignedTo: userId });
      toast.success(userId ? 'Assigned successfully' : 'Unassigned successfully');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to assign record'); }
  };

  const [sendingReminder, setSendingReminder] = useState(false);

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      const res = await api.post(`/tss/records/${record._id}/send-reminder`);
      toast.success(res.data.message || 'Reminder email sent successfully!');
      onRefresh();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reminder email');
    } finally {
      setSendingReminder(false);
    }
  };

  const currentAssignedId = record.assignedTo && typeof record.assignedTo === 'object' ? (record.assignedTo as any)._id : record.assignedTo;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); setSubmenu(null); setNoteOpen(false); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#9ca3af' }}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ right: 0, top: '100%', minWidth: 200, zIndex: 50 }}>
          {!submenu && !noteOpen && (
            <>
              <div className="dropdown-item" onClick={e => { e.stopPropagation(); setSubmenu('labels'); }}><Tag size={14} />Add Label</div>
              <div className="dropdown-item" onClick={e => { e.stopPropagation(); setSubmenu('date_followup'); }}><Clock size={14} />Set Follow Up</div>
              <div className="dropdown-item" onClick={e => { e.stopPropagation(); setSubmenu('date_renewal'); }}><Calendar size={14} />Set Renewal</div>
              {record.status !== 'Closed' && user?.role === 'Admin' && (
                <div className="dropdown-item" onClick={e => { e.stopPropagation(); closeRecord(); }}><CheckCircle size={14} />Mark as Completed</div>
              )}
              <div 
                className="dropdown-item" 
                onClick={e => { e.stopPropagation(); if (!sendingReminder) sendReminder(); }}
                style={{ opacity: sendingReminder ? 0.6 : 1, cursor: sendingReminder ? 'not-allowed' : 'pointer' }}
              >
                <Send size={14} />
                {sendingReminder ? 'Sending...' : 'Send Reminder Mail'}
              </div>
              <div className="dropdown-item" onClick={e => { e.stopPropagation(); setNoteOpen(true); }}><FileText size={14} />Add Note</div>
              {user?.role !== 'Agent' && (
                <>
                  <div className="dropdown-item" onClick={e => { e.stopPropagation(); setSubmenu('assign'); }}><Users size={14} />Assign Agent</div>
                  <div style={{ height: 1, background: '#f0f2f7', margin: '4px 0' }} />
                  <div className="dropdown-item danger" onClick={e => { e.stopPropagation(); deleteRecord(); }}><Trash2 size={14} />Delete Record</div>
                </>
              )}
            </>
          )}

          {submenu === 'labels' && (
            <div style={{ padding: 10 }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SELECT LABEL</p>
              {LABEL_OPTIONS.filter(lbl => user?.role === 'Admin' || lbl !== 'Closed').map(lbl => (
                <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={selectedLabels.length === 0 ? lbl === 'Open' : selectedLabels[0] === lbl}
                    onChange={() => setSelectedLabels([lbl])} />
                  {lbl}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn-primary" onClick={saveLabels} style={{ flex: 1, padding: '7px' }}>Apply</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {(submenu === 'date_followup' || submenu === 'date_renewal') && (
            <div style={{ padding: 10 }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                SET {submenu === 'date_followup' ? 'FOLLOW UP' : 'RENEWAL'} DATE
              </p>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={() => saveDate(submenu === 'date_followup' ? 'followUpDate' : 'renewalDate')} style={{ flex: 1, padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {noteOpen && (
            <div style={{ padding: 10 }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>ADD NOTE</p>
              <textarea
                className="form-input" value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Write a note..." rows={3} style={{ marginBottom: 10, resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={saveNote} style={{ flex: 1, padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setNoteOpen(false)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'assign' && (
            <div style={{ padding: 10 }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>ASSIGN AGENT</p>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13, color: '#ef4444', fontWeight: 500 }}>
                  <input
                    type="radio"
                    checked={!currentAssignedId}
                    onChange={() => handleAssign(null)}
                  />
                  Unassigned / Clear
                </label>
                {users.map((u: any) => (
                  <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={currentAssignedId === u._id}
                      onChange={() => handleAssign(u._id)}
                    />
                    <span>{u.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({u.role})</span></span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ flex: 1, padding: '7px' }}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Record Detail Drawer ───────────────────────────────────────────────────────
export function RecordDrawer({ record, defaultTab = 'details', onClose, onRefresh }: { record: TssRecord; defaultTab?: 'details' | 'notes'; onClose: () => void; onRefresh?: (updatedRecord?: TssRecord) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const getEmailFromRecord = (rec: TssRecord) => {
    if (!rec.data) return null;
    const emailKey = Object.keys(rec.data).find(k => k.toLowerCase().includes('email'));
    return emailKey ? String(rec.data[emailKey]) : null;
  };

  const handleWhatsApp = async () => {
    if (!record.mobileNumber) {
      toast.error('No mobile number available');
      return;
    }
    const cleanPhone = record.mobileNumber.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi ${record.customerName || ''}, this is from Advent Systems regarding your Tally support...`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    try {
      const response = await api.post('/whatsapp/send-template', {
        phoneNumber: cleanPhone,
        recipientName: record.customerName || ''
      });
      
      if (response.data && response.data.success) {
        toast.success('WhatsApp template sent automatically via Meta Cloud API!');
      } else {
        // Fallback to manual wa.me link
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      // Fallback on request failure
      window.open(waUrl, '_blank');
    }
  };

  const handleEmail = () => {
    const email = getEmailFromRecord(record);
    if (!email) {
      toast.error('No email address available');
      return;
    }
    const subject = encodeURIComponent('Support from Advent Systems');
    const body = encodeURIComponent(`Hi ${record.customerName || ''},\n\nThis is regarding your Tally service...`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };
  const [showEdit, setShowEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>(defaultTab);

  const InfoRow = ({ label, value }: { label: string; value?: string | number | boolean }) => (
    value !== undefined && value !== null && value !== '' ? (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f2f7' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: '#1a1f36', fontWeight: 500 }}>{String(value)}</div>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 150, backdropFilter: 'blur(2px)', animation: 'fadeIn 0.2s ease' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', zIndex: 160, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f0f2f7' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                <Database size={24} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1f36' }}>
                  {record.customerName || 'Unknown Customer'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {(record.labels || []).map(l => (
                    <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 11 }}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {record.mobileNumber && (
                <button 
                  onClick={handleWhatsApp}
                  title="Contact via WhatsApp"
                  style={{ 
                    background: '#25D366', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 8, 
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <MessageCircle size={14} fill="white" />
                  WhatsApp
                </button>
              )}
              {getEmailFromRecord(record) && (
                <button 
                  onClick={handleEmail}
                  title="Contact via Email"
                  style={{ 
                    background: '#EBF5FF', 
                    color: '#0070F3', 
                    border: '1px solid #D1E9FF', 
                    borderRadius: 8, 
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#D1E9FF'}
                  onMouseOut={e => e.currentTarget.style.background = '#EBF5FF'}
                >
                  <Mail size={14} />
                  Email
                </button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 6 }}><X size={20} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: -1 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['details', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '10px 18px', fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
                  border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab ? '#1a73e8' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent', transition: 'all 0.15s', textTransform: 'capitalize'
                }}>
                  {tab === 'notes' ? `Notes (${record.notes?.length || 0})` : 'Details'}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowEdit(true)}
                title="Edit TSS Details"
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: 6
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#dbeafe';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = '#eff6ff';
                }}
              >
                <Edit size={14} />
                Edit Entry
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {activeTab === 'details' && (
            <div>
              {record.followUpDate && (
                <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={16} style={{ color: '#b45309', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Follow-up Date</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>{format(new Date(record.followUpDate), 'EEEE, MMMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              {record.renewalDate && (
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={16} style={{ color: '#166534', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Renewal Date</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>{format(new Date(record.renewalDate), 'EEEE, MMMM d, yyyy')}</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16, marginTop: 8 }}>Core Information</div>
              <InfoRow label="Customer Name" value={record.customerName} />
              <InfoRow label="Serial Number" value={record.serialNumber} />
              <InfoRow label="Release Version" value={record.releaseVersion || record.data?.Release || record.data?.['Release Version']} />
              <InfoRow label="Flavour" value={record.flavour} />
              <InfoRow label="Mobile Number" value={record.mobileNumber} />
              
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16, marginTop: 32 }}>Additional Data</div>
              {Object.entries(record.data || {}).map(([key, val]) => (
                <InfoRow key={key} label={key} value={val} />
              ))}
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={{ paddingTop: 8 }}>
              {(record.notes || []).length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8' }}>No notes added yet.</p> : (
                record.notes?.map(n => (
                  <div key={n._id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px', marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: '#334155', margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{n.authorName} · {format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {showEdit && (
        <EditTssRecordModal
          record={record}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            if (onRefresh) onRefresh(updated);
          }}
        />
      )}
    </>
  );
}

// ─── Edit TSS Record Modal ──────────────────────────────────────────────────
function EditTssRecordModal({ record, onClose, onUpdated }: { record: TssRecord; onClose: () => void; onUpdated: (updatedRecord: TssRecord) => void }) {
  const [form, setForm] = useState({
    customerName: record.customerName || '',
    serialNumber: record.serialNumber || '',
    flavour: record.flavour || '',
    mobileNumber: record.mobileNumber || '',
    releaseVersion: record.releaseVersion || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName) {
      toast.error('Customer name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.put(`/tss/records/${record._id}`, form);
      toast.success('TSS record updated successfully!');
      onUpdated(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update record');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit TSS Record</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input className="form-input" value={form.customerName} onChange={e => set('customerName', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input className="form-input" value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Flavour</label>
                <input className="form-input" value={form.flavour} onChange={e => set('flavour', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="form-input" value={form.mobileNumber} onChange={e => set('mobileNumber', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Release Version</label>
                <input className="form-input" value={form.releaseVersion} onChange={e => set('releaseVersion', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> : <><Edit size={15} />Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TssDatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialSearch = searchParams ? (searchParams.get('search') || '') : '';
  
  const [records, setRecords] = useState<TssRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState(initialSearch);
  const [viewFilter, setViewFilter] = useState(''); // open, followup, closed, dateset
  const [tickedIds, setTickedIds] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    api.get('/users')
      .then(res => setUsers(res.data))
      .catch(err => console.error('Error fetching users:', err));
  }, []);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`ticked_records_${id}`);
      if (saved) {
        try {
          setTickedIds(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [id]);

  const handleToggleTick = (recordId: string) => {
    setTickedIds(prev => {
      const next = { ...prev, [recordId]: !prev[recordId] };
      localStorage.setItem(`ticked_records_${id}`, JSON.stringify(next));
      return next;
    });
  };
  
  const [selectedRecord, setSelectedRecord] = useState<TssRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'notes'>('details');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reviewCount, setReviewCount] = useState(0);
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    if (isAdmin && id) {
      api.get(`/tss/datasets/${id}/records`, { params: { limit: '1', view: 'review' } })
        .then(res => setReviewCount(res.data.total))
        .catch(err => console.error(err));
    }
  }, [isAdmin, id, records]);

  const fetchRecords = async (p = page, q = search, v = viewFilter) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: p, limit: 50, search: q, view: v };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const res = await api.get(`/tss/datasets/${id}/records`, { params });
      setRecords(res.data.records);
      setTotalPages(res.data.pages);
      setTotalRecords(res.data.total);
      
      if (selectedRecord) {
        const updated = res.data.records.find((r: TssRecord) => r._id === selectedRecord._id);
        if (updated) setSelectedRecord(updated);
      }
    } catch (err) {
      toast.error('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(page, search, viewFilter); }, [id, page, viewFilter, startDate, endDate]);

  useEffect(() => {
    if (searchParams) {
      const q = searchParams.get('search') || '';
      setSearch(q);
      setPage(1);
      fetchRecords(1, q, viewFilter);
    }
  }, [id, searchParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
    fetchRecords(1, e.target.value, viewFilter);
  };

  return (
    <ProtectedLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
        <TopBar title="TSS Dataset">
          {user?.role === 'Admin' && (
            <button
              className={viewFilter === 'review' ? 'btn-danger' : 'btn-secondary'}
              onClick={() => {
                setViewFilter(prev => prev === 'review' ? '' : 'review');
                setPage(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
                ...(viewFilter === 'review' ? {
                  background: '#fee2e2',
                  color: '#b91c1c',
                  borderColor: '#fca5a5'
                } : {})
              }}
            >
              <AlertCircle size={14} style={viewFilter === 'review' ? { color: '#b91c1c' } : {}} />
              Needs Review
              {reviewCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '18px',
                  height: '18px',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  zIndex: 10
                }}>
                  {reviewCount}
                </span>
              )}
            </button>
          )}
        </TopBar>
        
        <div style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Dataset Records</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Showing {totalRecords} records</p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* View Filters */}
            <div style={{ display: 'flex', background: 'white', borderRadius: 8, padding: 4, border: '1px solid #e2e8f0' }}>
              {[{ id: '', label: 'All' }, { id: 'today', label: 'Today' }, { id: 'open', label: 'Open' }, { id: 'followup', label: 'Follow Up' }, { id: 'dateset', label: 'Date Set' }, { id: 'closed', label: 'Closed' }].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setViewFilter(f.id); setPage(1); }}
                  style={{
                    padding: '6px 12px', fontSize: 13, fontWeight: viewFilter === f.id ? 600 : 500,
                    color: viewFilter === f.id ? '#0284c7' : '#64748b',
                    background: viewFilter === f.id ? '#e0f2fe' : 'transparent',
                    border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

             <div style={{ position: 'relative' }}>
               <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <input
                 type="text" placeholder="Search..." value={search} onChange={handleSearch}
                 style={{ padding: '9px 12px 9px 34px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, width: 220, outline: 'none', background: 'white' }}
               />
             </div>

             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={e => { setStartDate(e.target.value); setPage(1); }} 
                 style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white', color: '#374151', height: 38 }}
               />
               <span style={{ fontSize: 12, color: '#9ca3af' }}>to</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={e => { setEndDate(e.target.value); setPage(1); }} 
                 style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white', color: '#374151', height: 38 }}
               />
               {(startDate || endDate) && (
                 <button 
                   onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} 
                   style={{ background: '#fee2e2', border: 'none', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, height: 38 }}
                 >
                   Clear
                 </button>
               )}
             </div>

            <button
              onClick={() => {
                setTickedIds({});
                localStorage.removeItem(`ticked_records_${id}`);
                fetchRecords(page, search, viewFilter);
                toast.success('All records unticked');
              }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px' }}
            >
              <RefreshCw size={15} /> Refresh & Untick
            </button>

            {user?.role !== 'Agent' && (
              <button
                onClick={() => setShowAnalytics(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                <BarChart3 size={15} /> Analytics
              </button>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div style={{ flex: 1, padding: '0 32px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '12px 12px', width: 40 }}></th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', width: 280 }}>Customer Name</th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile Number</th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Serial Number</th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rel. Version</th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Labels</th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dates</th>
                    <th style={{ padding: '12px 12px', width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading records...</td></tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 60, textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <FileText size={20} style={{ color: '#94a3b8' }} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>No records found</div>
                      </td>
                    </tr>
                  ) : (
                    records.map((r, i) => (
                      <tr
                        key={r._id} onClick={() => { setSelectedRecord(r); setDrawerTab('details'); }}
                        style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfd', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fcfcfd'}
                      >
                        <td style={{ padding: '12px 12px', width: 40 }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={!!tickedIds[r._id]} 
                            onChange={() => handleToggleTick(r._id)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
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
                            {(r.labels || []).slice(0, 2).map(l => <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 10 }}>{l}</span>)}
                            {(r.labels?.length || 0) > 2 && <span className="badge" style={{ fontSize: 10 }}>+{(r.labels?.length || 0) - 2}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {r.renewalDate && <span title={`Renewal: ${format(new Date(r.renewalDate), 'MMM d')}`} style={{ background: '#dcfce7', color: '#166534', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12}/> {format(new Date(r.renewalDate), 'MMM d')}</span>}
                            {r.followUpDate && !r.renewalDate && <span title={`Follow Up: ${format(new Date(r.followUpDate), 'MMM d')}`} style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> {format(new Date(r.followUpDate), 'MMM d')}</span>}
                            {(r.notes?.length || 0) > 0 && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setSelectedRecord(r); setDrawerTab('notes'); }}
                                 style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                 title={`${r.notes?.length} Note(s)`}
                               >
                                 <FileText size={12} /> {r.notes?.length}
                               </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px' }} onClick={e => e.stopPropagation()}>
                          <RowMenu record={r} onRefresh={() => fetchRecords()} users={users} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && records.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>Page <span style={{ fontWeight: 600, color: '#0f172a' }}>{page}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalPages}</span></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={14} /> Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next <ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedRecord && <RecordDrawer record={selectedRecord} defaultTab={drawerTab} onClose={() => setSelectedRecord(null)} onRefresh={() => fetchRecords()} />}
      {showAnalytics && (
        <AnalyticsModalComponent 
          section="tss" 
          datasetId={id} 
          onClose={() => setShowAnalytics(false)} 
          onViewRecord={(name) => {
            setSearch(name);
            setPage(1);
            setShowAnalytics(false);
          }}
        />
      )}
    </ProtectedLayout>
  );
}
