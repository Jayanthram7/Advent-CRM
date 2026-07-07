'use client';
import { useState, useEffect, useRef, useCallback, Suspense, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, MoreVertical, Tag, Calendar,
  CheckCircle, FileText, Trash2, X, Phone, Mail,
  MapPin, Building2, Hash, Globe, User, Clock, StickyNote, MessageCircle,
  AlertCircle, Upload, Download, Edit, BarChart2
} from 'lucide-react';
import AnalyticsModal from '@/components/AnalyticsModal';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

const LABEL_OPTIONS = ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Lead', 'Cold Lead', 'Review', 'Completed', 'Closed'];

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Interested': 'badge badge-interested',
  'Not Interested': 'badge badge-not-interested',
  'Follow Up': 'badge badge-follow-up',
  'Hot Lead': 'badge badge-hot-call',
  'Cold Lead': 'badge badge-cold-call',
  'Review': 'badge badge-review',
  'Completed': 'badge badge-completed',
  'Closed': 'badge badge-closed',
};

export interface EventRecord {
  _id: string;
  datasetId: string;
  hallNumber: string;
  stallNumber: string;
  companyName: string;
  contactPerson: string;
  position: string;
  email: string;
  mobile1: string;
  mobile2: string;
  address: string;
  country: string;
  state: string;
  pincode: string;
  website?: string;
  labels: string[];
  status?: string;
  isConverted: boolean;
  convertedAt?: string;
  callbackDate?: string;
  followUpDate?: string;
  installationDate?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  noteCount?: number;
  followUpHistory?: {
    date: string;
    note: string;
    updatedBy: string;
    createdAt: string;
  }[];
  createdAt: string;
}

interface Note {
  _id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

interface Activity {
  _id: string;
  type: string;
  content: string;
  performedBy: { name: string };
  createdAt: string;
}

function getInitials(name: string) {
  if (!name) return 'EV';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Event Detail Drawer ──────────────────────────────────────────────────────
export function EventDrawer({ record, defaultTab = 'details', onClose, onRefresh }: { record: EventRecord; defaultTab?: 'details' | 'notes' | 'log'; onClose: () => void; onRefresh: (updatedRecord?: EventRecord) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [showEdit, setShowEdit] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newNote, setNewNote] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'log'>(defaultTab);

  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);
  const [newFollowUpDate, setNewFollowUpDate] = useState(
    record.followUpDate ? new Date(record.followUpDate).toISOString().split('T')[0] : ''
  );
  const [followUpNote, setFollowUpNote] = useState('');
  const [updatingFollowUpLoading, setUpdatingFollowUpLoading] = useState(false);

  const [isUpdatingCallback, setIsUpdatingCallback] = useState(false);
  const [newCallbackDate, setNewCallbackDate] = useState(
    record.callbackDate ? new Date(record.callbackDate).toISOString().split('T')[0] : ''
  );
  const [callbackNote, setCallbackNote] = useState('');
  const [updatingCallbackLoading, setUpdatingCallbackLoading] = useState(false);

  useEffect(() => {
    setNewCallbackDate(record.callbackDate ? new Date(record.callbackDate).toISOString().split('T')[0] : '');
    setCallbackNote('');
    setIsUpdatingCallback(false);
    setNewFollowUpDate(record.followUpDate ? new Date(record.followUpDate).toISOString().split('T')[0] : '');
    setFollowUpNote('');
    setIsUpdatingFollowUp(false);
  }, [record]);

  useEffect(() => {
    if (activeTab === 'log' && user && user.role !== 'Admin') {
      setActiveTab('details');
    }
  }, [activeTab, user]);

  const fetchNotes = useCallback(() => {
    api.get(`/events/records/${record._id}/notes`).then(r => setNotes(r.data)).catch(() => { });
  }, [record._id]);

  const fetchActivities = useCallback(() => {
    setActivitiesLoading(true);
    api.get(`/events/records/${record._id}/activities`)
      .then(r => setActivities(r.data))
      .catch(() => { })
      .finally(() => setActivitiesLoading(false));
  }, [record._id]);

  useEffect(() => {
    fetchNotes();
    fetchActivities();
  }, [fetchNotes, fetchActivities]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setNotesLoading(true);
    try {
      await api.post(`/events/records/${record._id}/notes`, { content: newNote });
      fetchNotes();
      fetchActivities();
      setNewNote('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleWhatsApp = async () => {
    const mobile = record.mobile1 || record.mobile2;
    if (!mobile) {
      toast.error('No mobile number available');
      return;
    }
    const cleanPhone = mobile.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi ${record.contactPerson}, this is from Advent Systems regarding our discussion...`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    api.post(`/events/records/${record._id}/whatsapp-log`).then(() => {
      fetchActivities();
      onRefresh();
    }).catch(() => { });

    window.open(waUrl, '_blank');
  };

  const handleEmail = async () => {
    if (!record.email) {
      toast.error('No email address available');
      return;
    }
    const subject = encodeURIComponent('Inquiry from Advent Systems');
    const body = encodeURIComponent(`Hi ${record.contactPerson},\n\nIt was nice meeting you. This is regarding our discussion...`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${record.email}&su=${subject}&body=${body}`;

    api.post(`/events/records/${record._id}/email-log`).then(() => {
      fetchActivities();
      onRefresh();
    }).catch(() => { });

    window.open(gmailUrl, '_blank');
  };

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) => (
    value ? (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f2f7' }}>
        <div style={{ color: '#9ca3af', marginTop: 2, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: '#1a1f36', fontWeight: 500 }}>{value}</div>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 150, backdropFilter: 'blur(2px)', animation: 'fadeIn 0.2s ease' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        zIndex: 160, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f0f2f7' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, color: 'white', flexShrink: 0
              }}>
                {getInitials(record.contactPerson)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1f36' }}>
                  {record.contactPerson || 'Unknown Contact'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {(record.labels || []).map(l => (
                    <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 11 }}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(record.mobile1 || record.mobile2) && (
                <button
                  onClick={handleWhatsApp}
                  title="Contact via WhatsApp"
                  style={{
                    background: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
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
                  <MessageCircle size={16} fill="white" />
                  WhatsApp
                </button>
              )}
              {record.email && (
                <button
                  onClick={handleEmail}
                  title="Contact via Email"
                  style={{
                    background: '#EBF5FF',
                    color: '#0070F3',
                    border: '1px solid #D1E9FF',
                    borderRadius: 8,
                    padding: '8px 12px',
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
                  <Mail size={16} />
                  Email
                </button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 6 }}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: -1 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['details', 'notes', 'log'] as const).filter(t => t !== 'log' || isAdmin).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '10px 18px', fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: activeTab === tab ? '#1a73e8' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
                  transition: 'all 0.15s', textTransform: 'capitalize'
                }}>
                  {tab === 'notes' ? `Notes (${notes.length})` : tab === 'log' ? 'Edit Log' : 'Details'}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowEdit(true)}
                title="Edit Details"
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

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {activeTab === 'details' && (
            <div style={{ paddingTop: 8 }}>
              {/* Callback Alert */}
              {record.callbackDate && (
                <div style={{
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe',
                  borderRadius: 10, padding: '16px', margin: '16px 0',
                  display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Calendar size={16} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Callback Date</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>
                          {format(new Date(record.callbackDate), 'EEEE, MMMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsUpdatingCallback(!isUpdatingCallback)}
                      style={{
                        background: '#1d4ed8', color: 'white', border: 'none',
                        borderRadius: 6, padding: '4px 10px', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s'
                      }}
                    >
                      {isUpdatingCallback ? 'Cancel' : 'Update'}
                    </button>
                  </div>

                  {isUpdatingCallback && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 8, padding: 12, border: '1px dashed #bfdbfe',
                      display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>New Callback Date</label>
                        <input
                          type="date"
                          value={newCallbackDate}
                          onChange={e => setNewCallbackDate(e.target.value)}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', background: 'white' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>Customer Notes</label>
                        <textarea
                          placeholder="Note down callback requirements..."
                          value={callbackNote}
                          onChange={e => setCallbackNote(e.target.value)}
                          rows={2}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', background: 'white' }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!newCallbackDate) {
                            toast.error('Date is required');
                            return;
                          }
                          setUpdatingCallbackLoading(true);
                          try {
                            const res = await api.post(`/events/records/${record._id}/date`, {
                              callbackDate: newCallbackDate,
                              note: callbackNote
                            });
                            toast.success('Callback date updated successfully');
                            setIsUpdatingCallback(false);
                            setCallbackNote('');
                            onRefresh(res.data);
                          } catch {
                            toast.error('Failed to update callback date');
                          } finally {
                            setUpdatingCallbackLoading(false);
                          }
                        }}
                        disabled={updatingCallbackLoading}
                        style={{
                          background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 6,
                          padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {updatingCallbackLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Callback Date'}
                      </button>
                    </div>
                  )}

                  {record.followUpHistory && record.followUpHistory.length > 0 && (
                    <div style={{ marginTop: 6, borderTop: '1px solid rgba(29, 78, 216, 0.15)', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>History</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {record.followUpHistory.map((history, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(29, 78, 216, 0.1)', borderRadius: 6, padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, fontWeight: 500, color: '#1d4ed8' }}>
                              <span>{format(new Date(history.date), 'MMM d, yyyy')}</span>
                              <span>{history.updatedBy}</span>
                            </div>
                            {history.note && <p style={{ margin: 0, fontSize: 12, color: '#1a1f36', lineHeight: 1.4 }}>{history.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Followup Alert */}
              {record.followUpDate && (
                <div style={{
                  background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a',
                  borderRadius: 10, padding: '16px', marginBottom: 16,
                  display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock size={16} style={{ color: '#b45309', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Follow-up Date</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>
                          {format(new Date(record.followUpDate), 'EEEE, MMMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsUpdatingFollowUp(!isUpdatingFollowUp)}
                      style={{
                        background: '#b45309', color: 'white', border: 'none',
                        borderRadius: 6, padding: '4px 10px', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s'
                      }}
                    >
                      {isUpdatingFollowUp ? 'Cancel' : 'Update'}
                    </button>
                  </div>

                  {isUpdatingFollowUp && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 8, padding: 12, border: '1px dashed #fde68a',
                      display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>New Follow-up Date</label>
                        <input
                          type="date"
                          value={newFollowUpDate}
                          onChange={e => setNewFollowUpDate(e.target.value)}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', background: 'white' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>Customer Notes</label>
                        <textarea
                          placeholder="What did the contact say?"
                          value={followUpNote}
                          onChange={e => setFollowUpNote(e.target.value)}
                          rows={2}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', background: 'white' }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!newFollowUpDate) {
                            toast.error('Date is required');
                            return;
                          }
                          setUpdatingFollowUpLoading(true);
                          try {
                            const res = await api.post(`/events/records/${record._id}/date`, {
                              followUpDate: newFollowUpDate,
                              note: followUpNote
                            });
                            toast.success('Follow-up updated successfully');
                            setIsUpdatingFollowUp(false);
                            setFollowUpNote('');
                            onRefresh(res.data);
                          } catch {
                            toast.error('Failed to update follow-up');
                          } finally {
                            setUpdatingFollowUpLoading(false);
                          }
                        }}
                        disabled={updatingFollowUpLoading}
                        style={{
                          background: '#b45309', color: 'white', border: 'none', borderRadius: 6,
                          padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {updatingFollowUpLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Follow-up'}
                      </button>
                    </div>
                  )}

                  {record.followUpHistory && record.followUpHistory.length > 0 && (
                    <div style={{ marginTop: 6, borderTop: '1px solid rgba(180, 83, 9, 0.15)', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>History</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {record.followUpHistory.map((history, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(180, 83, 9, 0.1)', borderRadius: 6, padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, fontWeight: 500, color: '#b45309' }}>
                              <span>{format(new Date(history.date), 'MMM d, yyyy')}</span>
                              <span>{history.updatedBy}</span>
                            </div>
                            {history.note && (
                              <p style={{ margin: 0, fontSize: 12, color: '#1a1f36', lineHeight: 1.4 }}>{history.note}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {record.installationDate && (
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', border: '1px solid #86efac',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <Calendar size={16} style={{ color: '#166534', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Installation Date</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>
                      {format(new Date(record.installationDate), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Grid */}
              <div style={{ paddingTop: record.callbackDate || record.followUpDate || record.installationDate ? 0 : 16 }}>
                <InfoRow icon={<Hash size={15} />} label="Hall Number" value={record.hallNumber} />
                <InfoRow icon={<Hash size={15} />} label="Stall Number" value={record.stallNumber} />
                <InfoRow icon={<Building2 size={15} />} label="Company Name" value={record.companyName} />
                <InfoRow icon={<User size={15} />} label="Contact Person" value={record.contactPerson} />
                <InfoRow icon={<Globe size={15} />} label="Position" value={record.position} />
                <InfoRow icon={<Mail size={15} />} label="Email" value={record.email} />
                <InfoRow icon={<Phone size={15} />} label="Mobile 1" value={record.mobile1} />
                <InfoRow icon={<Phone size={15} />} label="Mobile 2" value={record.mobile2} />
                <InfoRow icon={<MapPin size={15} />} label="Address" value={record.address} />
                <InfoRow icon={<MapPin size={15} />} label="Country" value={record.country} />
                <InfoRow icon={<MapPin size={15} />} label="State" value={record.state} />
                <InfoRow icon={<MapPin size={15} />} label="Pincode" value={record.pincode} />
                <InfoRow icon={<Globe size={15} />} label="Website" value={record.website} />
                <InfoRow icon={<User size={15} />} label="Status" value={record.status} />
                <InfoRow
                  icon={<Clock size={15} />}
                  label="Created"
                  value={format(new Date(record.createdAt), 'MMMM d, yyyy • h:mm a')}
                />
                {record.convertedAt && (
                  <InfoRow
                    icon={<CheckCircle size={15} />}
                    label="Converted On"
                    value={format(new Date(record.convertedAt), 'MMMM d, yyyy • h:mm a')}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={{ paddingTop: 16 }}>
              {/* Add Note */}
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Write a note about this contact..."
                  rows={3}
                  style={{
                    width: '100%', border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '10px 12px', fontSize: 13.5, resize: 'none', outline: 'none',
                    fontFamily: 'inherit', transition: 'border-color 0.15s'
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                />
                <button
                  className="btn-primary"
                  onClick={addNote}
                  disabled={notesLoading || !newNote.trim()}
                  style={{ marginTop: 8, width: '100%', justifyContent: 'center', opacity: !newNote.trim() ? 0.6 : 1 }}
                >
                  {notesLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><StickyNote size={14} /> Add Note</>}
                </button>
              </div>

              {/* Notes list */}
              {notes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                  <StickyNote size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ fontSize: 13 }}>No notes yet. Add the first one above.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notes.map(n => (
                    <div key={n._id} style={{
                      background: '#f8f9fc', border: '1px solid #e5e7eb',
                      borderRadius: 10, padding: '12px 14px'
                    }}>
                      <p style={{ fontSize: 13.5, color: '#1a1f36', lineHeight: 1.5, marginBottom: 8 }}>{n.content}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#9ca3af' }}>
                        <User size={11} />
                        <span>{n.authorName}</span>
                        <span>·</span>
                        <span>{format(new Date(n.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'log' && isAdmin && (
            <div style={{ paddingTop: 20 }}>
              {activitiesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}><div className="spinner spinner-dark" style={{ width: 24, height: 24, margin: '0 auto' }} /></div>
              ) : activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <p style={{ fontSize: 13 }}>No activity recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, background: '#f0f2f7', zIndex: 0 }} />

                  {activities.map((act) => (
                    <div key={act._id} style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: act.type === 'Creation' ? '#10b981' : act.type === 'Conversion' ? '#8b5cf6' : act.type === 'WhatsApp' ? '#25D366' : act.type === 'Email' ? '#0070F3' : act.type === 'DateUpdate' ? '#f59e0b' : '#e2e8f0',
                        border: '4px solid white', boxShadow: '0 0 0 1px #f0f2f7', flexShrink: 0, marginTop: 4
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36' }}>{act.type}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{format(new Date(act.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>{act.content}</p>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={10} /> {act.performedBy?.name || 'System'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showEdit && (
        <EditEventRecordModal
          record={record}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            onRefresh(updated);
          }}
        />
      )}
    </>
  );
}

// ─── Edit Event Record Modal ──────────────────────────────────────────────────
function EditEventRecordModal({ record, onClose, onUpdated }: { record: EventRecord; onClose: () => void; onUpdated: (updatedRecord: EventRecord) => void }) {
  const [form, setForm] = useState({
    hallNumber: record.hallNumber || '',
    stallNumber: record.stallNumber || '',
    companyName: record.companyName || '',
    contactPerson: record.contactPerson || '',
    position: record.position || '',
    email: record.email || '',
    mobile1: record.mobile1 || '',
    mobile2: record.mobile2 || '',
    address: record.address || '',
    country: record.country || '',
    state: record.state || '',
    pincode: record.pincode || '',
    website: record.website || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactPerson) {
      toast.error('Company Name and Contact Person are required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.put(`/events/records/${record._id}`, form);
      toast.success('Record updated successfully!');
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
    <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Record Details</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Hall Number</label>
                <input className="form-input" value={form.hallNumber} onChange={e => set('hallNumber', e.target.value)} placeholder="Hall 1" />
              </div>
              <div className="form-group">
                <label className="form-label">Stall Number</label>
                <input className="form-input" value={form.stallNumber} onChange={e => set('stallNumber', e.target.value)} placeholder="105" />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Acme Corp" required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input className="form-input" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="form-group">
                <label className="form-label">Position</label>
                <input className="form-input" value={form.position} onChange={e => set('position', e.target.value)} placeholder="Manager" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile 1</label>
                <input className="form-input" value={form.mobile1} onChange={e => set('mobile1', e.target.value)} placeholder="+91 99999 99999" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile 2</label>
                <input className="form-input" value={form.mobile2} onChange={e => set('mobile2', e.target.value)} placeholder="+91 88888 88888" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Rd" />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="India" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Tamil Nadu" />
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="641001" />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" />
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

// ─── Create Event Record Modal ────────────────────────────────────────────────
function CreateEventRecordModal({ datasetId, onClose, onCreated }: { datasetId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    hallNumber: '', stallNumber: '', companyName: '', contactPerson: '',
    position: '', email: '', mobile1: '', mobile2: '',
    address: '', country: '', state: '', pincode: '', website: '', labels: ['Open']
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactPerson) {
      toast.error('Company Name and Contact Person are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/events/records', { ...form, datasetId });
      toast.success('Record created successfully!');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Event Record</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Hall Number</label>
                <input className="form-input" value={form.hallNumber} onChange={e => set('hallNumber', e.target.value)} placeholder="Hall 1" />
              </div>
              <div className="form-group">
                <label className="form-label">Stall Number</label>
                <input className="form-input" value={form.stallNumber} onChange={e => set('stallNumber', e.target.value)} placeholder="105" />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Acme Corp" required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input className="form-input" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="form-group">
                <label className="form-label">Position</label>
                <input className="form-input" value={form.position} onChange={e => set('position', e.target.value)} placeholder="Manager" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile 1</label>
                <input className="form-input" value={form.mobile1} onChange={e => set('mobile1', e.target.value)} placeholder="+91 99999 99999" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile 2</label>
                <input className="form-input" value={form.mobile2} onChange={e => set('mobile2', e.target.value)} placeholder="+91 88888 88888" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Rd" />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="India" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Tamil Nadu" />
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="641001" />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : <><Plus size={15} />Create Record</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Import Event Records Modal ──────────────────────────────────────────────
function ImportEventRecordsModal({ datasetId, onClose, onImported }: { datasetId: string; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return alert('Excel file is required');
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

          const res = await fetch(`/api/events/datasets/${datasetId}/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ records })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to import');
          }
          toast.success('Records imported successfully!');
          onImported();
          onClose();
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Error parsing or importing Excel file');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error loading xlsx parser');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">Import Event Excel</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>Select Excel File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ width: '100%', color: '#4b5563', fontSize: 13.5 }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleImport}
            disabled={loading || !file}
          >
            {loading ? 'Importing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row Actions Menu ────────────────────────────────────────────────────────
function RowMenu({ record, onRefresh, users }: { record: EventRecord; onRefresh: () => void; users: any[] }) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'labels' | 'date_followup' | 'date_install' | 'assign' | null>(null);

  const [selectedLabels, setSelectedLabels] = useState<string[]>(record.labels || []);
  const [date, setDate] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const askReview = async () => {
    const adminUser = users.find(u => u.role === 'Admin');
    if (!adminUser) {
      toast.error('No admin user found to assign review');
      return;
    }
    try {
      await api.put(`/events/records/${record._id}`, { assignedTo: adminUser._id });
      await api.post(`/events/records/${record._id}/labels`, { labels: ['Review'] });
      toast.success('Record assigned to Admin for review');
      onRefresh();
      setOpen(false);
    } catch {
      toast.error('Failed to ask review');
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSubmenu(null); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const saveLabels = async () => {
    try {
      await api.post(`/events/records/${record._id}/labels`, { labels: selectedLabels });
      toast.success('Labels updated');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update labels'); }
  };

  const saveDate = async (type: 'followUpDate' | 'installationDate') => {
    try {
      await api.post(`/events/records/${record._id}/date`, { [type]: date });
      toast.success('Date set');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to set date'); }
  };

  const assignRecord = async (userId: string) => {
    try {
      await api.put(`/events/records/${record._id}`, { assignedTo: userId });
      toast.success('Record assigned');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to assign record'); }
  };

  const convertRecord = async () => {
    try {
      await api.post(`/events/records/${record._id}/convert`);
      toast.success('Record marked as converted!');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to convert record'); }
  };

  const deleteRecord = async () => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      await api.delete(`/events/records/${record._id}`);
      toast.success('Record deleted');
      onRefresh();
    } catch { toast.error('Failed to delete record'); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); setSubmenu(null); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#9ca3af' }}
        onMouseOver={e => (e.currentTarget.style.background = '#f4f6fb')}
        onMouseOut={e => (e.currentTarget.style.background = 'none')}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ right: 0, top: '100%', minWidth: 200, zIndex: 10 }}>
          {!submenu && (
            <>
              <div className="dropdown-item" onClick={() => setSubmenu('labels')}><Tag size={14} />Add Label</div>
              <div className="dropdown-item" onClick={() => setSubmenu('date_followup')}><Clock size={14} />Set Date for Follow up</div>
              <div className="dropdown-item" onClick={() => setSubmenu('date_install')}><Calendar size={14} />Set Date for Installation</div>
              {isAdmin ? (
                <div className="dropdown-item" onClick={() => setSubmenu('assign')}><User size={14} />Assign To</div>
              ) : (
                <div className="dropdown-item" onClick={askReview}><User size={14} />Ask Review</div>
              )}
              {!record.isConverted && isAdmin && (
                <div className="dropdown-item" onClick={convertRecord}><CheckCircle size={14} />Mark as Completed</div>
              )}
              <div className="dropdown-item" onClick={() => { setOpen(false); setNoteOpen(true); }}><FileText size={14} />Add Note</div>
              {isAdmin && (
                <>
                  <div style={{ height: 1, background: '#f0f2f7', margin: '4px 0' }} />
                  <div className="dropdown-item danger" onClick={deleteRecord}><Trash2 size={14} />Delete Record</div>
                </>
              )}
            </>
          )}

          {submenu === 'labels' && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SELECT LABELS</p>
              {LABEL_OPTIONS.filter(lbl => isAdmin || (lbl !== 'Completed' && lbl !== 'Closed')).map(lbl => (
                <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={selectedLabels.includes(lbl)}
                    onChange={() => setSelectedLabels([lbl])} />
                  {lbl}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn-primary" onClick={saveLabels} style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>Apply</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'date_followup' && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SET FOLLOW UP DATE</p>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={() => saveDate('followUpDate')} style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'date_install' && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SET INSTALLATION DATE</p>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={() => saveDate('installationDate')} style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'assign' && (
            <div style={{ padding: 10, minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>ASSIGN TO AGENT</p>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {users.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', padding: '10px 0' }}>No users found</p>
                ) : users.map(u => (
                  <div
                    key={u._id}
                    className="dropdown-item"
                    onClick={() => assignRecord(u._id)}
                    style={{
                      fontSize: 13,
                      padding: '8px 10px',
                      background: record.assignedTo?._id === u._id ? '#f0f7ff' : 'transparent',
                      color: record.assignedTo?._id === u._id ? '#1a73e8' : 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700
                      }}>
                        {u.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div>{u.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{u.role}</div>
                      </div>
                      {record.assignedTo?._id === u._id && <CheckCircle size={12} />}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f2f7' }}>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ width: '100%', justifyContent: 'center', padding: '7px' }}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}

      {noteOpen && (
        <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, zIndex: 300 }} onClick={e => e.stopPropagation()}>
          <div className="note-panel" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Quick Note</span>
              <button onClick={() => setNoteOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
            </div>
            <textarea
              placeholder="Type note and hit Save..."
              rows={2}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13, resize: 'none', outline: 'none', marginBottom: 8 }}
              onKeyDown={async e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const val = e.currentTarget.value;
                  if (!val.trim()) return;
                  try {
                    await api.post(`/events/records/${record._id}/notes`, { content: val });
                    toast.success('Note added');
                    setNoteOpen(false);
                    onRefresh();
                  } catch { toast.error('Failed to add note'); }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Event Page Content ──────────────────────────────────────────────────
function EventPageContent({ id }: { id: string }) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlView = searchParams.get('view');

  const [datasetName, setDatasetName] = useState('Event Records');
  const [records, setRecords] = useState<EventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams ? (searchParams.get('search') || '') : '');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<EventRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'notes' | 'log'>('details');
  const [users, setUsers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewFilter, setViewFilter] = useState(urlView || '');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (isAdmin && id) {
      api.get(`/events/datasets/${id}/records`, { params: { limit: '1', label: 'Review' } })
        .then(res => setReviewCount(res.data.total))
        .catch(err => console.error(err));
    }
  }, [isAdmin, id, records]);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => { });
    api.get(`/events/datasets/${id}`)
      .then(res => setDatasetName(res.data.name))
      .catch(() => setDatasetName('Event Records'));
  }, [id]);

  useEffect(() => {
    setViewFilter(urlView || '');
    setPage(1);
    const q = searchParams ? (searchParams.get('search') || '') : '';
    setSearch(q);
  }, [urlView, searchParams]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const activeView = viewFilter || urlView;
      if (activeView === 'open') { params.label = 'Open'; }
      if (activeView === 'followup') { params.label = 'Follow Up'; }
      if (activeView === 'dateset') { params.dateSet = 'true'; }
      if (activeView === 'installation') { params.installation = 'true'; }
      if (activeView === 'completed') { params.converted = 'true'; }

      const res = await api.get(`/events/datasets/${id}/records`, { params });
      setRecords(res.data.records);
      setTotal(res.data.total);
      setPages(res.data.pages);

      setSelectedRecord(prev => {
        if (!prev) return null;
        const updated = res.data.records.find((r: EventRecord) => r._id === prev._id);
        return updated || prev;
      });
    } catch {
      toast.error('Failed to fetch event records');
    } finally {
      setLoading(false);
    }
  }, [id, page, search, sortBy, sortOrder, filterLabel, urlView, viewFilter, startDate, endDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3 }}>
      {sortBy === col && sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </span>
  );

  const toggleSelect = (recId: string) => setSelectedIds(prev => prev.includes(recId) ? prev.filter(i => i !== recId) : [...prev, recId]);
  const toggleAll = () => setSelectedIds(prev => prev.length === records.length ? [] : records.map(l => l._id));

  // Client-side Excel generation & downloading
  const handleExportExcel = async () => {
    try {
      toast.loading('Generating export dataset...');
      const params: Record<string, string> = { limit: '100000', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const activeView = viewFilter || urlView;
      if (activeView === 'open') { params.label = 'Open'; }
      if (activeView === 'followup') { params.label = 'Follow Up'; }
      if (activeView === 'dateset') { params.dateSet = 'true'; }
      if (activeView === 'installation') { params.installation = 'true'; }
      if (activeView === 'completed') { params.converted = 'true'; }

      const res = await api.get(`/events/datasets/${id}/records`, { params });
      const exportItems = res.data.records || [];

      if (exportItems.length === 0) {
        toast.dismiss();
        toast.error('No records found to export');
        return;
      }

      const XLSX = await import('xlsx');
      const formatted = exportItems.map((r: any) => ({
        'Hall Number': r.hallNumber || '',
        'Stall Number': r.stallNumber || '',
        'Company Name': r.companyName || '',
        'Contact Person': r.contactPerson || '',
        'Position': r.position || '',
        'Email': r.email || '',
        'Mobile 1': r.mobile1 || '',
        'Mobile 2': r.mobile2 || '',
        'Address': r.address || '',
        'Country': r.country || '',
        'State': r.state || '',
        'Pincode': r.pincode || '',
        'Website': r.website || '',
        'Labels': (r.labels || []).join(', '),
        'Status': r.status || '',
        'Callback Date': r.callbackDate ? format(new Date(r.callbackDate), 'yyyy-MM-dd') : '',
        'Follow Up Date': r.followUpDate ? format(new Date(r.followUpDate), 'yyyy-MM-dd') : '',
        'Installation Date': r.installationDate ? format(new Date(r.installationDate), 'yyyy-MM-dd') : '',
        'Assigned To': r.assignedTo?.name || 'Unassigned',
        'Created At': format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
      }));

      const sheet = XLSX.utils.json_to_sheet(formatted);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Event Leads');

      XLSX.writeFile(book, `Event_Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss();
      toast.success('Excel file exported successfully!');
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <ProtectedLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
        <TopBar title={datasetName} onRefresh={fetchRecords}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAdmin && (
              <button
                className={filterLabel === 'Review' ? 'btn-danger' : 'btn-secondary'}
                onClick={() => {
                  setFilterLabel(prev => prev === 'Review' ? '' : 'Review');
                  setPage(1);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  position: 'relative',
                  ...(filterLabel === 'Review' ? { background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' } : {})
                }}
              >
                <AlertCircle size={14} style={filterLabel === 'Review' ? { color: '#b91c1c' } : {}} />
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
            <button className="btn-secondary" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</button>

            {user?.role !== 'Agent' && (
              <>
                <button className="btn-secondary" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Upload size={14} /> Import Excel
                </button>
                <button className="btn-secondary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Export Excel
                </button>
              </>
            )}
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Lead
            </button>
            {user?.role !== 'Agent' && (
              <button
                className="btn-secondary"
                onClick={() => setShowAnalytics(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #fefce8, #fef9c3)', color: '#b45309', border: '1px solid #fde68a', fontWeight: 600 }}
              >
                <BarChart2 size={14} /> Analytics
              </button>
            )}
            {isAdmin && (
              <button
                onClick={async () => {
                  if (confirm(`CRITICAL WARNING: Are you sure you want to delete the entire event "${datasetName}"? This will delete the event, all ${total} records, notes, and activity timeline. This action CANNOT BE UNDONE.`)) {
                    try {
                      await api.delete(`/events/datasets/${id}`);
                      toast.success('Event dataset deleted successfully');
                      router.push('/events');
                    } catch (err) {
                      console.error('Failed to delete dataset:', err);
                      toast.error('Failed to delete event dataset');
                    }
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  background: 'white',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                title="Delete Event"
              >
                <Trash2 size={14} />
                Delete Event
              </button>
            )}
          </div>
        </TopBar>
        {showAnalytics && (
          <AnalyticsModal 
            section="events" 
            datasetId={id} 
            datasetName={datasetName} 
            onClose={() => setShowAnalytics(false)} 
            onViewRecord={(name) => {
              setSearch(name);
              setPage(1);
              setShowAnalytics(false);
            }}
          />
        )}

        {/* Filters Panel */}
        {showFilter && (
          <div style={{ padding: '16px 32px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', animation: 'slideDown 0.2s ease' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Filter by Label</label>
              <select value={filterLabel} onChange={e => { setFilterLabel(e.target.value); setPage(1); }} style={{ padding: '8px 10px', fontSize: 13.5, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white', minWidth: 150 }}>
                <option value="">All Labels</option>
                {LABEL_OPTIONS.map(lbl => <option key={lbl} value={lbl}>{lbl}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Created Start Date</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Created End Date</label>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white' }} />
            </div>
            {(filterLabel || startDate || endDate) && (
              <button
                onClick={() => { setFilterLabel(''); setStartDate(''); setEndDate(''); setPage(1); }}
                style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', height: 38 }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        <div style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>{datasetName} Records</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Showing {total} records</p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* View Filters */}
            <div style={{ display: 'flex', background: 'white', borderRadius: 8, padding: 4, border: '1px solid #e2e8f0' }}>
              {[
                { id: '', label: 'All' },
                { id: 'open', label: 'Open' },
                { id: 'followup', label: 'Follow Up' },
                { id: 'dateset', label: 'Date Set' },
                { id: 'installation', label: 'Installation' },
                { id: 'completed', label: 'Completed' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setViewFilter(f.id); setPage(1); }}
                  style={{
                    padding: '6px 12px', fontSize: 13, fontWeight: (viewFilter || urlView || '') === f.id ? 600 : 500,
                    color: (viewFilter || urlView || '') === f.id ? '#0284c7' : '#64748b',
                    background: (viewFilter || urlView || '') === f.id ? '#e0f2fe' : 'transparent',
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
                type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ padding: '9px 12px 9px 34px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, width: 220, outline: 'none', background: 'white' }}
              />
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div style={{ flex: 1, padding: '0 32px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', width: 40 }}>
                      <input type="checkbox" checked={records.length > 0 && selectedIds.length === records.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                    </th>
                    <th onClick={() => toggleSort('hallNumber')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Hall/Stall <SortIcon col="hallNumber" /></th>
                    <th onClick={() => toggleSort('companyName')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', width: '22%' }}>Company / Contact <SortIcon col="companyName" /></th>
                    <th onClick={() => toggleSort('mobile1')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Mobile <SortIcon col="mobile1" /></th>
                    <th onClick={() => toggleSort('email')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Email <SortIcon col="email" /></th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Labels</th>
                    <th onClick={() => toggleSort('assignedTo')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Assigned <SortIcon col="assignedTo" /></th>
                    <th onClick={() => toggleSort('createdAt')} style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Created <SortIcon col="createdAt" /></th>
                    <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dates</th>
                    <th style={{ padding: '12px 16px', width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading records...</td></tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 60, textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <FileText size={20} style={{ color: '#94a3b8' }} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>No records found</div>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Add a lead manually or make sure your import file was correct.</p>
                      </td>
                    </tr>
                  ) : (
                    records.map((r, i) => (
                      <tr
                        key={r._id} onClick={() => { setSelectedRecord(r); setDrawerTab('details'); }}
                        style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfd', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fcfcfd'}
                      >
                        <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.includes(r._id)} onChange={() => toggleSelect(r._id)} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '12px 12px', fontSize: 13, color: '#475569' }}>
                          {r.hallNumber && r.stallNumber
                            ? `Hall ${r.hallNumber} / Stall ${r.stallNumber}`
                            : r.hallNumber
                              ? `Hall ${r.hallNumber}`
                              : r.stallNumber
                                ? `Stall ${r.stallNumber}`
                                : '—'}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.companyName || '-'}>
                              {r.companyName || '-'}
                            </div>
                            {r.contactPerson && (
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }} title={r.contactPerson}>
                                {r.contactPerson}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px', color: '#475569', fontSize: 13 }}>{r.mobile1 || r.mobile2 || '-'}</td>
                        <td style={{ padding: '12px 12px', color: '#475569', fontSize: 13, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.email}>{r.email || '-'}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(r.labels || []).slice(0, 2).map(l => <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 10 }}>{l}</span>)}
                            {(r.labels?.length || 0) > 2 && <span className="badge" style={{ fontSize: 10 }}>+{(r.labels?.length || 0) - 2}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {r.assignedTo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                                {r.assignedTo.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <span style={{ fontSize: 13, color: '#374151' }}>{r.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 13 }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px', color: '#64748b', fontSize: 12.5 }}>
                          {r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : '—'}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {r.callbackDate && <span title={`Callback: ${format(new Date(r.callbackDate), 'MMM d')}`} style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {format(new Date(r.callbackDate), 'MMM d')}</span>}
                            {r.followUpDate && !r.callbackDate && <span title={`Follow Up: ${format(new Date(r.followUpDate), 'MMM d')}`} style={{ background: '#fffbeb', color: '#b45309', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {format(new Date(r.followUpDate), 'MMM d')}</span>}
                            {(r.noteCount || 0) > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedRecord(r); setDrawerTab('notes'); }}
                                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                title={`${r.noteCount} Note(s)`}
                              >
                                <FileText size={12} /> {r.noteCount}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
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
                <div style={{ fontSize: 13, color: '#64748b' }}>Page <span style={{ fontWeight: 600, color: '#0f172a' }}>{page}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{pages}</span></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={14} /> Prev</button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: page === pages ? 'not-allowed' : 'pointer' }}>Next <ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateEventRecordModal
          datasetId={id}
          onClose={() => setShowCreate(false)}
          onCreated={fetchRecords}
        />
      )}

      {selectedRecord && (
        <EventDrawer
          record={selectedRecord}
          defaultTab={drawerTab}
          onClose={() => setSelectedRecord(null)}
          onRefresh={(updated) => {
            fetchRecords();
            if (updated) setSelectedRecord(updated);
          }}
        />
      )}

      {showImport && (
        <ImportEventRecordsModal
          datasetId={id}
          onClose={() => setShowImport(false)}
          onImported={fetchRecords}
        />
      )}
    </ProtectedLayout>
  );
}

export default function EventDatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <ProtectedLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%' }}>
          <div className="spinner spinner-dark" />
        </div>
      </ProtectedLayout>
    }>
      <EventPageContent id={id} />
    </Suspense>
  );
}
