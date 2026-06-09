'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, MoreVertical, Tag, Calendar,
  CheckCircle, FileText, Trash2, X, Phone, Mail,
  MapPin, Building2, Hash, Globe, User, Clock, StickyNote, MessageCircle,
  AlertCircle, Upload, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

const LABEL_OPTIONS = ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Lead', 'Cold Lead', 'Review'];

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Interested': 'badge badge-interested',
  'Not Interested': 'badge badge-not-interested',
  'Follow Up': 'badge badge-follow-up',
  'Hot Lead': 'badge badge-hot-call',
  'Cold Lead': 'badge badge-cold-call',
  'Review': 'badge badge-review',
};

interface IntecRecord {
  _id: string;
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
  if (!name) return 'IN';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Intec Detail Drawer ──────────────────────────────────────────────────────
function IntecDrawer({ record, defaultTab = 'details', onClose, onRefresh }: { record: IntecRecord; defaultTab?: 'details' | 'notes' | 'log'; onClose: () => void; onRefresh: (updatedRecord?: IntecRecord) => void }) {
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

  const fetchNotes = useCallback(() => {
    api.get(`/intec/${record._id}/notes`).then(r => setNotes(r.data)).catch(() => {});
  }, [record._id]);

  const fetchActivities = useCallback(() => {
    setActivitiesLoading(true);
    api.get(`/intec/${record._id}/activities`)
      .then(r => setActivities(r.data))
      .catch(() => {})
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
      await api.post(`/intec/${record._id}/notes`, { content: newNote });
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
    const message = encodeURIComponent(`Hi ${record.contactPerson}, this is from Advent Systems regarding our discussion at Intec...`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    api.post(`/intec/${record._id}/whatsapp-log`).then(() => {
      fetchActivities();
      onRefresh();
    }).catch(() => {});

    window.open(waUrl, '_blank');
  };

  const handleEmail = async () => {
    if (!record.email) {
      toast.error('No email address available');
      return;
    }
    const subject = encodeURIComponent('Inquiry from Advent Systems - Intec');
    const body = encodeURIComponent(`Hi ${record.contactPerson},\n\nIt was nice meeting you at Intec. This is regarding our discussion...`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${record.email}&su=${subject}&body=${body}`;
    
    api.post(`/intec/${record._id}/email-log`).then(() => {
      fetchActivities();
      onRefresh();
    }).catch(() => {});

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
                  {record.isConverted && <span className="badge badge-converted" style={{ fontSize: 11 }}>Converted</span>}
                  {record.status && !record.isConverted && <span className="badge badge-open" style={{ fontSize: 11 }}>{record.status}</span>}
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
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {(['details', 'notes', 'log'] as const).map(tab => (
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
                            const res = await api.post(`/intec/${record._id}/date`, {
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
                            const res = await api.post(`/intec/${record._id}/date`, {
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

          {activeTab === 'log' && (
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
    </>
  );
}

// ─── Create Intec Modal ──────────────────────────────────────────────────────
function CreateIntecModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      await api.post('/intec', form);
      toast.success('Intec record created successfully!');
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
          <h2 className="modal-title">Create New Intec Record</h2>
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

// ─── Row Actions Menu ────────────────────────────────────────────────────────
function RowMenu({ record, onRefresh, users }: { record: IntecRecord; onRefresh: () => void; users: any[] }) {
  const { isAdmin } = useAuth();
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
      await api.put(`/intec/${record._id}`, { assignedTo: adminUser._id });
      await api.post(`/intec/${record._id}/labels`, { labels: ['Review'] });
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
      await api.post(`/intec/${record._id}/labels`, { labels: selectedLabels });
      toast.success('Labels updated');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update labels'); }
  };

  const saveDate = async (type: 'followUpDate' | 'installationDate') => {
    try {
      await api.post(`/intec/${record._id}/date`, { [type]: date });
      toast.success('Date set');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to set date'); }
  };

  const assignRecord = async (userId: string) => {
    try {
      await api.put(`/intec/${record._id}`, { assignedTo: userId });
      toast.success('Record assigned');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to assign record'); }
  };

  const convertRecord = async () => {
    try {
      await api.post(`/intec/${record._id}/convert`);
      toast.success('Record marked as converted!');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to convert record'); }
  };

  const deleteRecord = async () => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      await api.delete(`/intec/${record._id}`);
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
              {!record.isConverted && (
                <div className="dropdown-item" onClick={convertRecord}><CheckCircle size={14} />Mark as Converted</div>
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
              {LABEL_OPTIONS.map(lbl => (
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
                    await api.post(`/intec/${record._id}/notes`, { content: val });
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

// ─── Main Intec Page Content ─────────────────────────────────────────────────
function IntecPageContent() {
  const { isAdmin, sidebarCollapsed } = useAuth();
  const searchParams = useSearchParams();
  const urlView = searchParams.get('view'); 

  const VIEW_TITLES: Record<string, string> = {
    open: 'Open Intec Records',
    followup: 'Follow Up Intec',
    dateset: 'Date Set Intec',
    installation: 'Installation Intec',
    completed: 'Completed Intec',
  };
  const pageTitle = urlView ? (VIEW_TITLES[urlView] || 'Intec') : 'All Intec Records';

  const [records, setRecords] = useState<IntecRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<IntecRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'notes' | 'log'>('details');
  const [users, setUsers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); setSearch(''); }, [urlView]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (urlView === 'open')         { params.label = 'Open'; }
      if (urlView === 'followup')     { params.label = 'Follow Up'; }
      if (urlView === 'dateset')      { params.dateSet = 'true'; }
      if (urlView === 'installation') { params.installation = 'true'; }
      if (urlView === 'completed')    { params.converted = 'true'; }

      const res = await api.get('/intec', { params });
      setRecords(res.data.intec);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to fetch Intec records');
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, filterLabel, urlView, startDate, endDate]);

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

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(prev => prev.length === records.length ? [] : records.map(l => l._id));

  // Client-side Excel parsing & uploading
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading('Loading XLSX parser...');
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (evt) => {
        try {
          toast.loading('Parsing Excel columns...');
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          if (rows.length === 0) {
            toast.dismiss();
            toast.error('Excel sheet is empty');
            return;
          }

          toast.loading(`Importing ${rows.length} records...`);
          await api.post('/intec/import', { records: rows });
          toast.dismiss();
          toast.success(`Successfully imported Intec records!`);
          fetchRecords();
        } catch (err: any) {
          console.error(err);
          toast.dismiss();
          toast.error(err?.response?.data?.message || 'Error importing Excel records');
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error('Failed to parse file');
    }
    e.target.value = '';
  };

  // Client-side Excel generation & downloading
  const handleExportExcel = async () => {
    try {
      toast.loading('Generating export dataset...');
      const params: Record<string, string> = { limit: '100000', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (urlView === 'open')         { params.label = 'Open'; }
      if (urlView === 'followup')     { params.label = 'Follow Up'; }
      if (urlView === 'dateset')      { params.dateSet = 'true'; }
      if (urlView === 'installation') { params.installation = 'true'; }
      if (urlView === 'completed')    { params.converted = 'true'; }

      const res = await api.get('/intec', { params });
      const exportItems = res.data.intec || [];

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
      XLSX.utils.book_append_sheet(book, sheet, 'Intec Leads');

      XLSX.writeFile(book, `Intec_Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      <TopBar title={pageTitle} onRefresh={fetchRecords}>
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
                ...(filterLabel === 'Review' ? { background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' } : {})
              }}
            >
              <AlertCircle size={14} style={filterLabel === 'Review' ? { color: '#b91c1c' } : {}} />
              Needs Review
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</button>
          
          <input
            type="file"
            id="intec-excel-import"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />
          <label htmlFor="intec-excel-import" className="btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Import Excel
          </label>

          <button className="btn-secondary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export Excel
          </button>

          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} />Create Record</button>
        </div>
      </TopBar>

      <div style={{ display: 'flex', position: 'relative' }}>
        {showFilter && (
          <div className="filter-panel" style={{ left: sidebarCollapsed ? 64 : 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Filters</span>
              <button onClick={() => setShowFilter(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Label</label>
              <select className="form-select" value={filterLabel} onChange={e => { setFilterLabel(e.target.value); setPage(1); }}>
                <option value="">All Labels</option>
                {LABEL_OPTIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setFilterLabel(''); setPage(1); }}>
              Clear Filters
            </button>
          </div>
        )}

        <div style={{ flex: 1, padding: 24, marginLeft: showFilter ? 280 : 0, transition: 'margin-left 0.2s' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input className="search-bar" placeholder="Search Intec records..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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

            <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>{total} records</span>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: 13, color: '#1a73e8', fontWeight: 500 }}>{selectedIds.length} selected</span>
            )}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty-state"><div className="spinner spinner-dark" style={{ width: 32, height: 32 }} /><p>Loading records...</p></div>
            ) : records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Search size={28} color="#9ca3af" /></div>
                <p style={{ fontWeight: 600, color: '#374151' }}>No Intec records found</p>
                <p style={{ fontSize: 13 }}>Create your first record, import an Excel sheet, or adjust filters</p>
                <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} />Create Record</button>
              </div>
            ) : (
              <div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.length === records.length} onChange={toggleAll} /></th>
                      <th onClick={() => toggleSort('companyName')} style={{ cursor: 'pointer' }}>Company / Contact <SortIcon col="companyName" /></th>
                      <th onClick={() => toggleSort('hallNumber')} style={{ cursor: 'pointer' }}>Hall / Stall <SortIcon col="hallNumber" /></th>
                      <th style={{ width: 160 }}>Designation / Email</th>
                      <th>Mobiles</th>
                      <th>Labels</th>
                      <th>Assigned</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>Created <SortIcon col="createdAt" /></th>
                      <th style={{ width: 120 }}>Dates / Notes</th>
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => (
                      <tr key={record._id} onClick={() => setSelectedRecord(record)}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(record._id)} onChange={() => toggleSelect(record._id)} /></td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.companyName || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{record.contactPerson || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>H: {record.hallNumber || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>S: {record.stallNumber || '—'}</div>
                        </td>
                        <td style={{ maxWidth: 160 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.position || ''}>{record.position || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.email || ''}>{record.email || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{record.mobile1 || '—'}</div>
                          {record.mobile2 && <div style={{ fontSize: 12, color: '#6b7280' }}>{record.mobile2}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {record.isConverted ? (
                              <span className="badge badge-converted">Converted</span>
                            ) : (
                              (record.labels || []).map(l => (
                                <span key={l} className={LABEL_CLASSES[l] || 'badge'}>{l}</span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          {record.assignedTo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ 
                                width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700
                              }}>
                                {record.assignedTo.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontSize: 12.5, color: '#374151' }}>{record.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12.5 }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12.5 }}>
                          {format(new Date(record.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {record.installationDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#f0fdf4', border: '1px solid #bbf7d0',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#166534', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                                  {format(new Date(record.installationDate), 'MMM d')}
                                </span>
                              </div>
                            ) : record.followUpDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#fffbeb', border: '1px solid #fde68a',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Clock size={11} style={{ color: '#b45309', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                                  {format(new Date(record.followUpDate), 'MMM d')}
                                </span>
                              </div>
                            ) : record.callbackDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
                                  {format(new Date(record.callbackDate), 'MMM d')}
                                </span>
                              </div>
                            ) : null}

                            {(record.noteCount || 0) > 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedRecord(record); setDrawerTab('notes'); }}
                                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                title={`${record.noteCount} Note(s)`}
                              >
                                <FileText size={12} /> {record.noteCount}
                              </button>
                            )}
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <RowMenu record={record} onRefresh={fetchRecords} users={users} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Page {page} of {pages}</span>
              <div className="pagination">
                <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                  const p = i + 1;
                  return <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateIntecModal onClose={() => setShowCreate(false)} onCreated={fetchRecords} />}
      {selectedRecord && (
        <IntecDrawer
          record={selectedRecord}
          defaultTab={drawerTab}
          onClose={() => { setSelectedRecord(null); setDrawerTab('details'); }}
          onRefresh={(updatedRecord) => {
            fetchRecords();
            if (updatedRecord) setSelectedRecord(updatedRecord);
          }}
        />
      )}
    </ProtectedLayout>
  );
}

export default function IntecPage() {
  return (
    <Suspense fallback={
      <div className="empty-state">
        <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
        <p>Loading...</p>
      </div>
    }>
      <IntecPageContent />
    </Suspense>
  );
}
