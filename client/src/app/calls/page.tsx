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
  AlertCircle, Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

const LABEL_OPTIONS = ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Call', 'Cold Call', 'Review'];
const SOURCE_OPTIONS = ['Website', 'Cold Call', 'Referral', 'Social Media', 'Email Campaign', 'Walk-in', 'Other'];

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Interested': 'badge badge-interested',
  'Not Interested': 'badge badge-not-interested',
  'Follow Up': 'badge badge-follow-up',
  'Hot Call': 'badge badge-hot-call',
  'Cold Call': 'badge badge-cold-call',
  'Review': 'badge badge-review',
};

export interface Call {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  company: string;
  licenseNumber: string;
  leadSource: string;
  address?: string;
  city?: string;
  country?: string;
  reason?: string;
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


function getInitials(first: string, last: string) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

// ─── Call Detail Drawer ───────────────────────────────────────────────────────
export function CallDrawer({ call, defaultTab = 'details', onClose, onRefresh }: { call: Call; defaultTab?: 'details' | 'notes' | 'log'; onClose: () => void; onRefresh: (updatedCall?: Call) => void }) {
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
    call.followUpDate ? new Date(call.followUpDate).toISOString().split('T')[0] : ''
  );
  const [followUpNote, setFollowUpNote] = useState('');
  const [updatingFollowUpLoading, setUpdatingFollowUpLoading] = useState(false);

  const [isUpdatingCallback, setIsUpdatingCallback] = useState(false);
  const [newCallbackDate, setNewCallbackDate] = useState(
    call.callbackDate ? new Date(call.callbackDate).toISOString().split('T')[0] : ''
  );
  const [callbackNote, setCallbackNote] = useState('');
  const [updatingCallbackLoading, setUpdatingCallbackLoading] = useState(false);

  useEffect(() => {
    setNewCallbackDate(call.callbackDate ? new Date(call.callbackDate).toISOString().split('T')[0] : '');
    setCallbackNote('');
    setIsUpdatingCallback(false);
    setNewFollowUpDate(call.followUpDate ? new Date(call.followUpDate).toISOString().split('T')[0] : '');
    setFollowUpNote('');
    setIsUpdatingFollowUp(false);
  }, [call]);


  const fetchNotes = useCallback(() => {
    api.get(`/calls/${call._id}/notes`).then(r => setNotes(r.data)).catch(() => {});
  }, [call._id]);

  const fetchActivities = useCallback(() => {
    setActivitiesLoading(true);
    api.get(`/calls/${call._id}/activities`)
      .then(r => setActivities(r.data))
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, [call._id]);

  useEffect(() => {
    fetchNotes();
    fetchActivities();
  }, [fetchNotes, fetchActivities]);


  const addNote = async () => {
    if (!newNote.trim()) return;
    setNotesLoading(true);
    try {
      await api.post(`/calls/${call._id}/notes`, { content: newNote });
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
    if (!call.phone) {
      toast.error('No phone number available');
      return;
    }
    
    // Clean phone number (remove +, spaces, etc.)
    const cleanPhone = call.phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi ${call.firstName}, this is from Advent Systems regarding your inquiry...`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    // Log activity in background
    api.post(`/calls/${call._id}/whatsapp-log`).then(() => {
      fetchActivities();
      onRefresh();
    }).catch(() => {});

    window.open(waUrl, '_blank');
  };

  const handleEmail = async () => {
    if (!call.email) {
      toast.error('No email address available');
      return;
    }
    
    const subject = encodeURIComponent('Inquiry from Advent Systems');
    const body = encodeURIComponent(`Hi ${call.firstName},\n\nThis is regarding your inquiry with Advent Systems...`);
    
    // Direct Gmail compose link
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${call.email}&su=${subject}&body=${body}`;
    
    // Log activity in background
    api.post(`/calls/${call._id}/email-log`).then(() => {
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
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 150, backdropFilter: 'blur(2px)', animation: 'fadeIn 0.2s ease' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        zIndex: 160, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Drawer Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f0f2f7' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a73e8, #6c63ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, color: 'white', flexShrink: 0
              }}>
                {getInitials(call.firstName, call.lastName)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1f36' }}>
                  {call.firstName} {call.lastName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {call.isConverted && <span className="badge badge-converted" style={{ fontSize: 11 }}>Converted</span>}
                  {call.status && !call.isConverted && <span className="badge badge-open" style={{ fontSize: 11 }}>{call.status}</span>}
                  {(call.labels || []).map(l => (
                    <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 11 }}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {call.phone && (
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
              {call.email && (
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
            {isAdmin && (
              <button
                onClick={() => setShowEdit(true)}
                title="Edit Call Details"
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

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>

          {activeTab === 'details' && (
            <div style={{ paddingTop: 8 }}>
              {/* Callback date callout */}
              {call.callbackDate && (
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
                          {format(new Date(call.callbackDate), 'EEEE, MMMM d, yyyy')}
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
                      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={e => e.currentTarget.style.opacity = '1'}
                    >
                      {isUpdatingCallback ? 'Cancel' : 'Update'}
                    </button>
                  </div>

                  {isUpdatingCallback && (
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.6)', 
                      borderRadius: 8, 
                      padding: 12, 
                      border: '1px dashed #bfdbfe',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      marginTop: 4
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>New Callback Date</label>
                        <input
                          type="date"
                          value={newCallbackDate}
                          onChange={e => setNewCallbackDate(e.target.value)}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                            outline: 'none',
                            background: 'white'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>Customer Notes</label>
                        <textarea
                          placeholder="What did the customer say?"
                          value={callbackNote}
                          onChange={e => setCallbackNote(e.target.value)}
                          rows={2}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            background: 'white'
                          }}
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
                            const res = await api.post(`/calls/${call._id}/date`, {
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
                          background: '#1d4ed8',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        {updatingCallbackLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Callback Date'}
                      </button>
                    </div>
                  )}

                  {call.followUpHistory && call.followUpHistory.length > 0 && (
                    <div style={{ marginTop: 6, borderTop: '1px solid rgba(29, 78, 216, 0.15)', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>History</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {call.followUpHistory.map((history, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(29, 78, 216, 0.1)', borderRadius: 6, padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, fontWeight: 500, color: '#1d4ed8' }}>
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
              {call.followUpDate && (
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
                          {format(new Date(call.followUpDate), 'EEEE, MMMM d, yyyy')}
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
                      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={e => e.currentTarget.style.opacity = '1'}
                    >
                      {isUpdatingFollowUp ? 'Cancel' : 'Update'}
                    </button>
                  </div>

                  {isUpdatingFollowUp && (
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.6)', 
                      borderRadius: 8, 
                      padding: 12, 
                      border: '1px dashed #fde68a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      marginTop: 4
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>New Follow-up Date</label>
                        <input
                          type="date"
                          value={newFollowUpDate}
                          onChange={e => setNewFollowUpDate(e.target.value)}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                            outline: 'none',
                            background: 'white'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>Customer Notes</label>
                        <textarea
                          placeholder="What did the customer say?"
                          value={followUpNote}
                          onChange={e => setFollowUpNote(e.target.value)}
                          rows={2}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            background: 'white'
                          }}
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
                            const res = await api.post(`/calls/${call._id}/date`, {
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
                          background: '#b45309',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        {updatingFollowUpLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Follow-up'}
                      </button>
                    </div>
                  )}

                  {call.followUpHistory && call.followUpHistory.length > 0 && (
                    <div style={{ marginTop: 6, borderTop: '1px solid rgba(180, 83, 9, 0.15)', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>History</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {call.followUpHistory.map((history, idx) => (
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
              {call.installationDate && (
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', border: '1px solid #86efac',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <Calendar size={16} style={{ color: '#166534', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Installation Date</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', marginTop: 1 }}>
                      {format(new Date(call.installationDate), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ paddingTop: call.callbackDate || call.followUpDate || call.installationDate ? 0 : 16 }}>
                <InfoRow icon={<Mail size={15} />} label="Email" value={call.email} />
                <InfoRow icon={<FileText size={15} />} label="Reason" value={call.reason} />
                <InfoRow icon={<Phone size={15} />} label="Phone" value={call.phone} />
                <InfoRow icon={<Phone size={15} />} label="Secondary Phone" value={call.secondaryPhone} />
                <InfoRow icon={<Building2 size={15} />} label="Company" value={call.company} />
                <InfoRow icon={<Hash size={15} />} label="License Number" value={call.licenseNumber} />
                <InfoRow icon={<Globe size={15} />} label="Call Source" value={call.leadSource} />
                <InfoRow icon={<MapPin size={15} />} label="Address" value={call.address} />
                <InfoRow icon={<MapPin size={15} />} label="City" value={call.city} />
                <InfoRow icon={<MapPin size={15} />} label="Country" value={call.country} />
                <InfoRow icon={<User size={15} />} label="Status" value={call.status} />
                <InfoRow
                  icon={<Clock size={15} />}
                  label="Created"
                  value={format(new Date(call.createdAt), 'MMMM d, yyyy • h:mm a')}
                />
                {call.convertedAt && (
                  <InfoRow
                    icon={<CheckCircle size={15} />}
                    label="Converted On"
                    value={format(new Date(call.convertedAt), 'MMMM d, yyyy • h:mm a')}
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
                  placeholder="Write a note about this call..."
                  rows={3}
                  style={{
                    width: '100%', border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '10px 12px', fontSize: 13.5, resize: 'none', outline: 'none',
                    fontFamily: 'inherit', transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#1a73e8'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
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
                  {/* Timeline vertical line */}
                  <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, background: '#f0f2f7', zIndex: 0 }} />
                  
                  {activities.map((act, i) => (
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
        <EditCallModal
          call={call}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            onRefresh(updated);
          }}
        />
      )}
    </>
  );
}

// ─── Edit Call Modal ─────────────────────────────────────────────────────────
function EditCallModal({ call, onClose, onUpdated }: { call: Call; onClose: () => void; onUpdated: (updatedCall: Call) => void }) {
  const [form, setForm] = useState({
    firstName: call.firstName || '',
    lastName: call.lastName || '',
    email: call.email || '',
    phone: call.phone || '',
    secondaryPhone: call.secondaryPhone || '',
    company: call.company || '',
    licenseNumber: call.licenseNumber || '',
    leadSource: call.leadSource || 'Other',
    address: call.address || '',
    reason: call.reason || ''
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
      const res = await api.put(`/calls/${call._id}`, form);
      toast.success('Call updated successfully!');
      onUpdated(res.data);
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to update call');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Call Details</h2>
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
                <select className="form-select" value={form.leadSource} onChange={e => set('leadSource', e.target.value)}>
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
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> : <><Edit size={15} />Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Call Modal ───────────────────────────────────────────────────────
function CreateCallModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    secondaryPhone: '', company: '', licenseNumber: '',
    leadSource: 'Other', address: '', reason: '', labels: ['Open']
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
      await api.post('/calls', form);
      toast.success('Call created successfully!');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to create call');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Call</h2>
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
                <label className="form-label">Call Source</label>
                <select className="form-select" value={form.leadSource} onChange={e => set('leadSource', e.target.value)}>
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
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : <><Plus size={15} />Create Call</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Note Panel ──────────────────────────────────────────────────────────────
function NotePanel({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/calls/${callId}/notes`).then(r => setNotes(r.data)).catch(() => {});
  }, [callId]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setLoading(true);
    try {
      await api.post(`/calls/${callId}/notes`, { content: newNote });
      const r = await api.get(`/calls/${callId}/notes`);
      setNotes(r.data);
      setNewNote('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="note-panel" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Notes</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <textarea
          value={newNote} onChange={e => setNewNote(e.target.value)}
          placeholder="Type a note..." rows={2}
          style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13, resize: 'none', outline: 'none' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
        />
        <button className="btn-primary" onClick={addNote} disabled={loading} style={{ alignSelf: 'flex-end', padding: '6px 12px' }}>
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Add'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
        {notes.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af' }}>No notes yet</p> : notes.map(n => (
          <div key={n._id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
            <p style={{ fontSize: 12.5, color: '#374151', marginBottom: 4 }}>{n.content}</p>
            <p style={{ fontSize: 11, color: '#9ca3af' }}>{n.authorName} · {format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Row Actions Menu ─────────────────────────────────────────────────────────
function RowMenu({ call, onRefresh, users }: { call: Call; onRefresh: () => void; users: any[] }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'labels' | 'date_followup' | 'date_install' | 'note' | 'assign' | null>(null);

  const [selectedLabels, setSelectedLabels] = useState<string[]>(call.labels || []);
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
      await api.put(`/calls/${call._id}`, { assignedTo: adminUser._id });
      await api.post(`/calls/${call._id}/labels`, { labels: ['Review'] });
      toast.success('Call assigned to Admin for review');
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
      await api.post(`/calls/${call._id}/labels`, { labels: selectedLabels });
      toast.success('Labels updated');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update labels'); }
  };

  const saveDate = async (type: 'followUpDate' | 'installationDate') => {
    try {
      await api.post(`/calls/${call._id}/date`, { [type]: date });
      toast.success('Date set');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to set date'); }
  };

  const assignCall = async (userId: string) => {
    try {
      await api.put(`/calls/${call._id}`, { assignedTo: userId });
      toast.success('Call assigned');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to assign call'); }
  };


  const convertCall = async () => {
    try {
      await api.post(`/calls/${call._id}/convert`);
      toast.success('Call marked as converted!');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to convert call'); }
  };

  const deleteCall = async () => {
    if (!confirm('Delete this call? This cannot be undone.')) return;
    try {
      await api.delete(`/calls/${call._id}`);
      toast.success('Call deleted');
      onRefresh();
    } catch { toast.error('Failed to delete call'); }
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
        <div className="dropdown-menu" style={{ right: 0, top: '100%', minWidth: 200 }}>
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
              {!call.isConverted && isAdmin && (
                <div className="dropdown-item" onClick={convertCall}><CheckCircle size={14} />Mark as Converted</div>
              )}
              <div className="dropdown-item" onClick={() => { setSubmenu('note'); setOpen(false); setNoteOpen(true); }}><FileText size={14} />Add Note</div>
              {isAdmin && (
                <>
                  <div style={{ height: 1, background: '#f0f2f7', margin: '4px 0' }} />
                  <div className="dropdown-item danger" onClick={deleteCall}><Trash2 size={14} />Delete Call</div>
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
                    onClick={() => assignCall(u._id)}
                    style={{ 
                      fontSize: 13, 
                      padding: '8px 10px',
                      background: call.assignedTo?._id === u._id ? '#f0f7ff' : 'transparent',
                      color: call.assignedTo?._id === u._id ? '#1a73e8' : 'inherit'
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
                      {call.assignedTo?._id === u._id && <CheckCircle size={12} />}
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
        <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, zIndex: 300 }}>
          <NotePanel callId={call._id} onClose={() => setNoteOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ─── Main Calls Page ──────────────────────────────────────────────────────────
function CallsPageContent() {
  const { isAdmin, sidebarCollapsed } = useAuth();
  const searchParams = useSearchParams();
  const urlView = searchParams.get('view'); // open | followup | dateset | installation | completed
  const [viewFilter, setViewFilter] = useState(urlView || '');

  const VIEW_TITLES: Record<string, string> = {
    open: 'Open Calls',
    followup: 'Follow Up Calls',
    dateset: 'Date Set Calls',
    installation: 'Installation Calls',
    completed: 'Closed Calls',
  };
  const activeView = viewFilter || urlView || '';
  const pageTitle = activeView ? (VIEW_TITLES[activeView] || 'Calls') : 'All Calls';

  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterSource, setFilterSource] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'notes' | 'log'>('details');
  const [users, setUsers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);


  // Reset page when view changes
  useEffect(() => {
    setViewFilter(urlView || '');
    setPage(1);
    setSearch('');
  }, [urlView]);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterSource) params.source = filterSource;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Apply view-based filters
      const activeView = viewFilter || urlView;
      if (activeView === 'open')         { params.label = 'Open'; }
      if (activeView === 'followup')     { params.label = 'Follow Up'; }
      if (activeView === 'dateset')      { params.dateSet = 'true'; }
      if (activeView === 'installation') { params.installation = 'true'; }
      if (activeView === 'completed')    { params.converted = 'true'; }

      const res = await api.get('/calls', { params });
      setCalls(res.data.calls);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to fetch calls');
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, filterSource, filterLabel, urlView, viewFilter, startDate, endDate]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

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
  const toggleAll = () => setSelectedIds(prev => prev.length === calls.length ? [] : calls.map(l => l._id));

  return (
    <ProtectedLayout>
      <TopBar title={pageTitle} onRefresh={fetchCalls}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button
              className={filterLabel === 'Review' ? 'btn-danger' : 'btn-secondary'}
              onClick={() => {
                if (filterLabel === 'Review') {
                  setFilterLabel('');
                } else {
                  setFilterLabel('Review');
                }
                setPage(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                ...(filterLabel === 'Review' ? {
                  background: '#fee2e2',
                  color: '#b91c1c',
                  borderColor: '#fca5a5'
                } : {})
              }}
            >
              <AlertCircle size={14} style={filterLabel === 'Review' ? { color: '#b91c1c' } : {}} />
              Needs Review
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} />Create Call</button>
        </div>
      </TopBar>

      <div style={{ display: 'flex', position: 'relative' }}>
        {/* Filter Panel */}
        {showFilter && (
          <div className="filter-panel" style={{ left: sidebarCollapsed ? 64 : 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Filters</span>
              <button onClick={() => setShowFilter(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Call Source</label>
              <select className="form-select" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}>
                <option value="">All Sources</option>
                {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Label</label>
              <select className="form-select" value={filterLabel} onChange={e => { setFilterLabel(e.target.value); setPage(1); }}>
                <option value="">All Labels</option>
                {LABEL_OPTIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setFilterSource(''); setFilterLabel(''); setPage(1); }}>
              Clear Filters
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: 24, marginLeft: showFilter ? 280 : 0, transition: 'margin-left 0.2s' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input className="search-bar" placeholder="Search calls..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>

            {/* View Filters */}
            <div style={{ display: 'flex', background: 'white', borderRadius: 8, padding: 4, border: '1px solid #e2e8f0', height: 38, alignItems: 'center' }}>
              {[
                { id: '', label: 'All' },
                { id: 'open', label: 'Open' },
                { id: 'followup', label: 'Follow Up' },
                { id: 'dateset', label: 'Date Set' },
                { id: 'installation', label: 'Installation' },
                { id: 'completed', label: 'Closed' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setViewFilter(f.id); setPage(1); }}
                  style={{
                    padding: '6px 12px', fontSize: 13, fontWeight: (viewFilter || urlView || '') === f.id ? 600 : 500,
                    color: (viewFilter || urlView || '') === f.id ? '#0284c7' : '#64748b',
                    background: (viewFilter || urlView || '') === f.id ? '#e0f2fe' : 'transparent',
                    border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              ))}
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

            <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>{total} calls</span>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: 13, color: '#1a73e8', fontWeight: 500 }}>{selectedIds.length} selected</span>
            )}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty-state"><div className="spinner spinner-dark" style={{ width: 32, height: 32 }} /><p>Loading calls...</p></div>
            ) : calls.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Search size={28} color="#9ca3af" /></div>
                <p style={{ fontWeight: 600, color: '#374151' }}>No calls found</p>
                <p style={{ fontSize: 13 }}>Create your first call or adjust your filters</p>
                <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} />Create Call</button>
              </div>
            ) : (
              <div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.length === calls.length} onChange={toggleAll} /></th>
                      <th onClick={() => toggleSort('firstName')} style={{ cursor: 'pointer' }}>Call Name <SortIcon col="firstName" /></th>
                      <th onClick={() => toggleSort('company')} style={{ cursor: 'pointer' }}>Company <SortIcon col="company" /></th>
                      <th>Reason</th>
                      <th>Phone</th>
                      <th>License #</th>
                      <th>Labels</th>
                      <th>Assigned</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>Created <SortIcon col="createdAt" /></th>
                      <th style={{ width: 120 }}>Dates / Notes</th>
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map(call => (
                      <tr key={call._id} onClick={() => setSelectedCall(call)}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(call._id)} onChange={() => toggleSelect(call._id)} /></td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{call.firstName} {call.lastName}</div>
                        </td>
                        <td>{call.company || '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: 13 }}>{call.reason || '—'}</td>
                        <td>{call.phone || '—'}</td>
                        <td>{call.licenseNumber || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {call.isConverted ? (
                              <span className="badge badge-converted">Converted</span>
                            ) : (
                              (call.labels || []).map(l => (
                                <span key={l} className={LABEL_CLASSES[l] || 'badge'}>{l}</span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          {call.assignedTo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ 
                                width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700
                              }}>
                                {call.assignedTo.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontSize: 12.5, color: '#374151' }}>{call.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12.5 }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12.5 }}>

                          {format(new Date(call.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {call.installationDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#f0fdf4', border: '1px solid #bbf7d0',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#166534', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                                  {format(new Date(call.installationDate), 'MMM d')}
                                </span>
                              </div>
                            ) : call.followUpDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#fffbeb', border: '1px solid #fde68a',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Clock size={11} style={{ color: '#b45309', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                                  {format(new Date(call.followUpDate), 'MMM d')}
                                </span>
                              </div>
                            ) : call.callbackDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
                                  {format(new Date(call.callbackDate), 'MMM d')}
                                </span>
                              </div>
                            ) : null}

                            {(call.noteCount || 0) > 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedCall(call); setDrawerTab('notes'); }}
                                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                title={`${call.noteCount} Note(s)`}
                              >
                                <FileText size={12} /> {call.noteCount}
                              </button>
                            )}
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <RowMenu call={call} onRefresh={fetchCalls} users={users} />
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

      {showCreate && <CreateCallModal onClose={() => setShowCreate(false)} onCreated={fetchCalls} />}
      {selectedCall && (
        <CallDrawer
          call={selectedCall}
          defaultTab={drawerTab}
          onClose={() => { setSelectedCall(null); setDrawerTab('details'); }}
          onRefresh={(updatedCall) => {
            fetchCalls();
            if (updatedCall) setSelectedCall(updatedCall);
          }}
        />
      )}

    </ProtectedLayout>
  );
}

export default function CallsPage() {
  return (
    <Suspense fallback={
      <div className="empty-state">
        <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
        <p>Loading...</p>
      </div>
    }>
      <CallsPageContent />
    </Suspense>
  );
}
