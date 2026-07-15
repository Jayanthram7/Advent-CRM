'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Search, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, RefreshCw, X, ArrowUpRight,
  Building2, CheckSquare, Clock, Database, Calendar,
  MoreVertical, Tag, User, CheckCircle, FileText, Trash2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

import { LeadDrawer, Lead } from '../leads/page';
import { CallDrawer, Call } from '../calls/page';
import { EventDrawer, EventRecord } from '../events/[id]/page';
import { RecordDrawer as TssRecordDrawer, TssRecord } from '../tss/[id]/page';

interface TaskRecord {
  _id: string;
  originalId: string;
  datasetId?: string;
  datasetName?: string;
  source: 'leads' | 'calls' | 'events' | 'tss';
  name: string;
  company: string;
  email: string;
  phone: string;
  reason?: string;
  licenseNumber?: string;
  status: string;
  labels: string[];
  callbackDate?: string;
  followUpDate?: string;
  installationDate?: string;
  renewalDate?: string;
  createdAt: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

const SOURCE_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  leads: { bg: '#e0f2fe', color: '#0369a1', label: 'Lead' },
  calls: { bg: '#dcfce7', color: '#15803d', label: 'Call' },
  events: { bg: '#f3e8ff', color: '#6b21a8', label: 'Event' },
  tss: { bg: '#ffedd5', color: '#c2410c', label: 'TSS' },
};

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Follow Up': 'badge badge-follow-up',
  'Review': 'badge badge-review',
  'Converted': 'badge badge-converted',
  'Closed': 'badge badge-closed',
};

const LABEL_OPTIONS = ['Open', 'Call Back', 'Follow Up', 'Review', 'Closed'];

// ─── Task Row Menu ─────────────────────────────────────────────────────────────
function TaskRowMenu({ record, onRefresh, users }: { record: TaskRecord; onRefresh: () => void; users: any[] }) {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'labels' | 'date_followup' | 'date_install' | 'note' | 'assign' | null>(null);
  
  const [selectedLabels, setSelectedLabels] = useState<string[]>(record.labels || []);
  const [date, setDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSubmenu(null); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (submenu === 'date_followup') {
      setDate(record.followUpDate ? record.followUpDate.split('T')[0] : '');
    } else if (submenu === 'date_install') {
      const existingDate = record.source === 'tss' ? record.renewalDate : record.installationDate;
      setDate(existingDate ? existingDate.split('T')[0] : '');
    }
  }, [submenu, record]);

  const getBaseUrl = (source: string, id: string) => {
    if (source === 'tss') return `/tss/records/${id}`;
    if (source === 'events') return `/events/records/${id}`;
    return `/${source}/${id}`;
  };

  const saveLabels = async () => {
    try {
      const url = getBaseUrl(record.source, record.originalId);
      if (record.source === 'tss') {
        await api.put(`${url}/labels`, { labels: selectedLabels });
      } else {
        await api.post(`${url}/labels`, { labels: selectedLabels });
      }
      toast.success('Labels updated');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update labels'); }
  };

  const saveDate = async (type: 'followUpDate' | 'installationDate' | 'renewalDate') => {
    try {
      const url = getBaseUrl(record.source, record.originalId);
      if (record.source === 'tss') {
        await api.put(`${url}/dates`, { [type === 'installationDate' ? 'renewalDate' : type]: date });
      } else {
        await api.post(`${url}/date`, { [type]: date });
      }
      toast.success('Date set');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to set date'); }
  };

  const assignTask = async (userId: string | null) => {
    try {
      const url = getBaseUrl(record.source, record.originalId);
      await api.put(url, { assignedTo: userId });
      toast.success(userId ? 'Task assigned' : 'Task unassigned');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to assign task'); }
  };

  const convertOrClose = async () => {
    try {
      const url = getBaseUrl(record.source, record.originalId);
      if (record.source === 'tss') {
        await api.put(`${url}/labels`, { status: 'Closed' });
        toast.success('Record marked as closed!');
      } else {
        await api.post(`${url}/convert`);
        toast.success('Record marked as converted!');
      }
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to update status'); }
  };

  const askReview = async () => {
    const adminUser = users.find(u => u.role === 'Admin');
    if (!adminUser) {
      toast.error('No admin user found to assign review');
      return;
    }
    try {
      const url = getBaseUrl(record.source, record.originalId);
      await api.put(url, { assignedTo: adminUser._id });
      if (record.source === 'tss') {
        await api.put(`${url}/labels`, { labels: ['Review'] });
      } else {
        await api.post(`${url}/labels`, { labels: ['Review'] });
      }
      toast.success('Assigned to Admin for review');
      onRefresh();
      setOpen(false);
    } catch {
      toast.error('Failed to request review');
    }
  };

  const saveNote = async () => {
    if (!newNote.trim()) return;
    try {
      const url = getBaseUrl(record.source, record.originalId);
      await api.post(`${url}/notes`, { content: newNote });
      toast.success('Note added');
      setNewNote('');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to add note'); }
  };

  const deleteTask = async () => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      const url = getBaseUrl(record.source, record.originalId);
      await api.delete(url);
      toast.success('Record deleted');
      onRefresh();
      setOpen(false);
    } catch { toast.error('Failed to delete record'); }
  };

  const currentAssignedId = record.assignedTo && typeof record.assignedTo === 'object' ? (record.assignedTo as any)._id : record.assignedTo;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); setSubmenu(null); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#9ca3af' }}
        onMouseOver={e => (e.currentTarget.style.background = '#f4f6fb')}
        onMouseOut={e => (e.currentTarget.style.background = 'none')}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ right: 0, top: '100%', minWidth: 200, zIndex: 100, textAlign: 'left' }}>
          {!submenu && (
            <>
              <div className="dropdown-item" onClick={() => setSubmenu('labels')}><Tag size={14} />Add Label</div>
              <div className="dropdown-item" onClick={() => setSubmenu('date_followup')}><Clock size={14} />Set Follow Up</div>
              <div className="dropdown-item" onClick={() => setSubmenu('date_install')}><Calendar size={14} />{record.source === 'tss' ? 'Set Renewal' : 'Set Installation'}</div>
              {isAdminOrManager && (
                <div className="dropdown-item" onClick={() => setSubmenu('assign')}><User size={14} />Assign To</div>
              )}
              {record.status !== 'Converted' && record.status !== 'Closed' && (
                user?.role === 'Admin' ? (
                  <div className="dropdown-item" onClick={convertOrClose}>
                    <CheckCircle size={14} />
                    Mark as Completed
                  </div>
                ) : (
                  <div className="dropdown-item" onClick={askReview}>
                    <User size={14} />
                    Ask Review
                  </div>
                )
              )}
              <div className="dropdown-item" onClick={() => setSubmenu('note')}><FileText size={14} />Add Note</div>
              {isAdminOrManager && (
                <>
                  <div style={{ height: 1, background: '#f0f2f7', margin: '4px 0' }} />
                  <div className="dropdown-item danger" onClick={deleteTask}><Trash2 size={14} />Delete Record</div>
                </>
              )}
            </>
          )}

          {submenu === 'labels' && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SELECT LABEL</p>
              {LABEL_OPTIONS.filter(lbl => user?.role === 'Admin' || lbl !== 'Closed').map(lbl => (
                <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={selectedLabels.length === 0 ? lbl === 'Open' : selectedLabels[0] === lbl}
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
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                {record.source === 'tss' ? 'SET RENEWAL DATE' : 'SET INSTALLATION DATE'}
              </p>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={() => saveDate(record.source === 'tss' ? 'renewalDate' : 'installationDate')} style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'note' && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>ADD NOTE</p>
              <textarea
                className="form-input" value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Write a note..." rows={3} style={{ marginBottom: 10, resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" onClick={saveNote} style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>Save</button>
                <button className="btn-secondary" onClick={() => setSubmenu(null)} style={{ padding: '7px 10px' }}>Back</button>
              </div>
            </div>
          )}

          {submenu === 'assign' && (
            <div style={{ padding: 10, minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>ASSIGN TO AGENT</p>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div 
                  className="dropdown-item" 
                  onClick={() => assignTask(null)}
                  style={{ 
                    fontSize: 13, 
                    padding: '8px 10px',
                    color: '#ef4444',
                    fontWeight: 500
                  }}
                >
                  Unassigned / Clear
                </div>
                {users.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', padding: '10px 0' }}>No users found</p>
                ) : users.map(u => (
                  <div 
                    key={u._id} 
                    className="dropdown-item" 
                    onClick={() => assignTask(u._id)}
                    style={{ 
                      fontSize: 13, 
                      padding: '8px 10px',
                      background: currentAssignedId === u._id ? '#f0f7ff' : 'transparent',
                      color: currentAssignedId === u._id ? '#1a73e8' : 'inherit'
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
                      {currentAssignedId === u._id && <CheckCircle size={12} style={{ color: '#1a73e8' }} />}
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
    </div>
  );
}

function TasksPageContent() {
  const { user, setSidebarCollapsed } = useAuth();
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
  const searchParams = useSearchParams();
  const urlLabel = searchParams.get('label');
  const urlUserId = searchParams.get('userId');

  useEffect(() => {
    const savedState = localStorage.getItem('sidebar_collapsed') === 'true';
    setSidebarCollapsed(true, false);

    return () => {
      const currentPreference = localStorage.getItem('sidebar_collapsed') === 'true';
      setSidebarCollapsed(currentPreference);
    };
  }, [setSidebarCollapsed]);

  const [records, setRecords] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Users for dropdown (Admin/Manager only)
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(urlUserId || '');

  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState(urlLabel === 'Review' ? '' : 'Pending');
  const [filterLabel, setFilterLabel] = useState(urlLabel || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // States for detailed drawer expansion
  const [selectedRecord, setSelectedRecord] = useState<Lead | Call | EventRecord | TssRecord | null>(null);
  const [activeDrawerSource, setActiveDrawerSource] = useState<'leads' | 'calls' | 'events' | 'tss' | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'notes' | 'log'>('details');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (isAdminOrManager) {
      const params: Record<string, string> = {
        limit: '1',
        label: 'Review'
      };
      if (selectedAgentId && user?.role !== 'Admin') {
        params.userId = selectedAgentId;
      }
      api.get('/users/tasks', { params })
        .then(res => setReviewCount(res.data.total))
        .catch(err => console.error(err));
    }
  }, [isAdminOrManager, selectedAgentId, records, user]);

  const handleRowClick = async (item: TaskRecord) => {
    setDrawerLoading(true);
    try {
      let url = '';
      if (item.source === 'leads') url = `/leads/${item.originalId}`;
      else if (item.source === 'calls') url = `/calls/${item.originalId}`;
      else if (item.source === 'events') url = `/events/records/${item.originalId}`;
      else if (item.source === 'tss') url = `/tss/records/${item.originalId}`;

      const res = await api.get(url);
      setSelectedRecord(res.data);
      setActiveDrawerSource(item.source);
      setDrawerTab('details');
    } catch (err) {
      toast.error('Failed to load detailed record information');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Fetch agents / users list
  useEffect(() => {
    api.get('/users')
      .then(res => {
        setAgents(res.data);
        if (res.data && res.data.length > 0) {
          if (!urlUserId) {
            const defaultUser = res.data.find((u: any) => u._id === user?.id) || res.data[0];
            setSelectedAgentId(defaultUser._id);
          }
        }
      })
      .catch(err => {
        console.error('Error fetching users:', err);
      });
  }, [user]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: '25',
        sortBy,
        sortOrder
      };
      if (search.trim()) params.search = search.trim();
      if (source) params.source = source;
      if (status) params.status = status;
      if (filterLabel) params.label = filterLabel;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      // Determine user filter
      if (isAdminOrManager) {
        if (selectedAgentId && !(user?.role === 'Admin' && filterLabel === 'Review')) {
          params.userId = selectedAgentId;
        }
      } else {
        params.userId = user?.id || '';
      }

      const res = await api.get('/users/tasks', { params });
      setRecords(res.data.tasks);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      toast.error('Failed to fetch tasks list');
    } finally {
      setLoading(false);
    }
  }, [page, search, source, status, filterLabel, startDate, endDate, selectedAgentId, sortBy, sortOrder, isAdminOrManager, user]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, source, status, selectedAgentId, filterLabel, startDate, endDate]);

  // Sync state with URL search param changes
  useEffect(() => {
    if (urlLabel) {
      setFilterLabel(urlLabel);
      if (urlLabel === 'Review') {
        setStatus('');
      }
    }
  }, [urlLabel]);

  useEffect(() => {
    if (urlUserId) {
      setSelectedAgentId(urlUserId);
    }
  }, [urlUserId]);

  const handleClearFilters = () => {
    setSearch('');
    setSource('');
    setStatus('Pending');
    setFilterLabel('');
    setStartDate('');
    setEndDate('');
    if (isAdminOrManager) {
      const defaultUser = agents.find(u => u._id === user?.id) || agents[0];
      setSelectedAgentId(defaultUser ? defaultUser._id : '');
    }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3, display: 'inline-flex', alignItems: 'center' }}>
      {sortBy === col && sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </span>
  );

  const getSourceBadge = (src: string) => {
    const b = SOURCE_BADGES[src] || { bg: '#f1f5f9', color: '#475569', label: src.toUpperCase() };
    return (
      <span style={{
        backgroundColor: b.bg,
        color: b.color,
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11.5px',
        fontWeight: 600,
        textTransform: 'capitalize'
      }}>
        {b.label}
      </span>
    );
  };

  const getSourceURL = (item: TaskRecord) => {
    switch (item.source) {
      case 'leads':
        return `/leads`;
      case 'calls':
        return `/calls`;
      case 'events':
        return item.datasetId ? `/events/${item.datasetId}` : '/events';
      case 'tss':
        return item.datasetId ? `/tss/${item.datasetId}` : '/tss';
      default:
        return '#';
    }
  };

  const formatDateField = (dateStr?: string) => {
    if (!dateStr) return <span style={{ color: '#94a3b8' }}>—</span>;
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return <span style={{ color: '#94a3b8' }}>—</span>;
    }
  };

  return (
    <ProtectedLayout>
      <TopBar title="Assigned Tasks" onRefresh={fetchRecords}>
        {isAdminOrManager && (
          <button
            className={filterLabel === 'Review' ? 'btn-danger' : 'btn-secondary'}
            onClick={() => {
              setFilterLabel(prev => prev === 'Review' ? '' : 'Review');
              setPage(1);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              ...(filterLabel === 'Review' ? {
                background: '#fee2e2',
                color: '#b91c1c',
                borderColor: '#fca5a5'
              } : {})
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
      </TopBar>

      <div style={{ padding: 24 }}>
        {/* Statistics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
              <CheckSquare size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Total Tasks</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>{total}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
              <Building2 size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Leads & Events</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>
                {records.filter(r => r.source === 'leads' || r.source === 'events').length} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Clock size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Calls Tasks</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>
                {records.filter(r => r.source === 'calls').length} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c2410c' }}>
              <Database size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>TSS Tasks</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>
                {records.filter(r => r.source === 'tss').length} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                className="search-bar"
                placeholder="Search tasks by name, company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 36 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Agent Dropdown for Admin/Manager */}
              {isAdminOrManager && (
                <select
                  className="form-select"
                  style={{ width: 180, padding: '8px 10px', height: 38 }}
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                >
                  {agents.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              )}

              {/* Source Filter */}
              <select
                className="form-select"
                style={{ width: 140, padding: '8px 10px', height: 38 }}
                value={source}
                onChange={e => setSource(e.target.value)}
              >
                <option value="">All Sources</option>
                <option value="leads">Leads</option>
                <option value="calls">Calls</option>
                <option value="events">Events</option>
                <option value="tss">TSS</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-select"
                style={{ width: 140, padding: '8px 10px', height: 38 }}
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Pending">Pending (Open)</option>
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Converted">Converted</option>
                <option value="Closed">Closed</option>
              </select>

              {/* Custom Date Range Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white', color: '#374151', height: 38 }}
                />
                <span style={{ fontSize: 12, color: '#9ca3af' }}>to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white', color: '#374151', height: 38 }}
                />
              </div>

              {/* Clear Button */}
              {(search || source || status !== 'Pending' || selectedAgentId || filterLabel || startDate || endDate) && (
                <button
                  onClick={handleClearFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#ef4444',
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={12} /> Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Unified Tasks Table */}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 12 }}>
              <div className="spinner spinner-dark" />
              <span style={{ color: '#64748b', fontSize: 13.5 }}>Fetching assigned tasks...</span>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
              <CheckSquare size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>No Tasks Found</h3>
              <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>
                {selectedAgentId ? 'This agent does not have any tasks matching these filters.' : 'You have no assigned tasks matching these filters.'}
              </p>
              {(search || source || status !== 'Pending' || selectedAgentId) && (
                <button className="btn-secondary" style={{ marginTop: 16, background: 'white' }} onClick={handleClearFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                        Customer Name <SortIcon col="name" />
                      </th>
                      <th onClick={() => toggleSort('source')} style={{ cursor: 'pointer' }}>
                        Section <SortIcon col="source" />
                      </th>
                      <th onClick={() => toggleSort('company')} style={{ cursor: 'pointer' }}>
                        Company <SortIcon col="company" />
                      </th>
                      <th onClick={() => toggleSort('reason')} style={{ cursor: 'pointer' }}>
                        Reason <SortIcon col="reason" />
                      </th>
                      <th>Phone</th>
                      <th onClick={() => toggleSort('licenseNumber')} style={{ cursor: 'pointer' }}>
                        License # <SortIcon col="licenseNumber" />
                      </th>
                      <th>Labels</th>
                      <th>Assigned</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>
                        Created <SortIcon col="createdAt" />
                      </th>
                      <th style={{ width: 120 }}>Dates / Notes</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(item => (
                      <tr key={item._id} onClick={() => handleRowClick(item)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.name}</div>
                        </td>
                        <td>{getSourceBadge(item.source)}</td>
                        <td>{item.company || '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: 13 }}>{item.reason || '—'}</td>
                        <td>{item.phone || '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: 13 }}>{item.licenseNumber || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.labels && item.labels.length > 0 ? (
                              item.labels.map(l => (
                                <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: '10.5px' }}>
                                  {l}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {item.assignedTo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ 
                                width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700
                              }}>
                                {item.assignedTo.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontSize: 12.5, color: '#374151' }}>{item.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12.5 }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12.5 }}>
                          {item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.installationDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#f0fdf4', border: '1px solid #bbf7d0',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#166534', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                                  {format(new Date(item.installationDate), 'MMM d')}
                                </span>
                              </div>
                            ) : item.followUpDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#fffbeb', border: '1px solid #fde68a',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Clock size={11} style={{ color: '#b45309', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                                  {format(new Date(item.followUpDate), 'MMM d')}
                                </span>
                              </div>
                            ) : item.callbackDate ? (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap'
                              }}>
                                <Calendar size={11} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
                                  {format(new Date(item.callbackDate), 'MMM d')}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <TaskRowMenu record={item} onRefresh={fetchRecords} users={agents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                  Showing <span style={{ color: '#0f172a', fontWeight: 600 }}>{Math.min(total, (page - 1) * 25 + 1)}</span> to{' '}
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{Math.min(total, page * 25)}</span> of{' '}
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{total}</span> tasks
                </span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ background: 'white', display: 'flex', alignItems: 'center', gap: 4, opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                    onClick={() => page > 1 && setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#334155', padding: '0 8px' }}>
                    Page {page} of {pages}
                  </span>
                  <button
                    className="btn-secondary"
                    style={{ background: 'white', display: 'flex', alignItems: 'center', gap: 4, opacity: page === pages ? 0.5 : 1, cursor: page === pages ? 'not-allowed' : 'pointer' }}
                    onClick={() => page < pages && setPage(page + 1)}
                    disabled={page === pages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {drawerLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner spinner-dark" />
        </div>
      )}
      {activeDrawerSource === 'leads' && selectedRecord && (
        <LeadDrawer
          lead={selectedRecord as Lead}
          defaultTab={drawerTab}
          onClose={() => {
            setSelectedRecord(null);
            setActiveDrawerSource(null);
          }}
          onRefresh={(updated) => {
            fetchRecords();
            if (updated) setSelectedRecord(updated);
          }}
        />
      )}
      {activeDrawerSource === 'calls' && selectedRecord && (
        <CallDrawer
          call={selectedRecord as Call}
          defaultTab={drawerTab}
          onClose={() => {
            setSelectedRecord(null);
            setActiveDrawerSource(null);
          }}
          onRefresh={(updated) => {
            fetchRecords();
            if (updated) setSelectedRecord(updated);
          }}
        />
      )}
      {activeDrawerSource === 'events' && selectedRecord && (
        <EventDrawer
          record={selectedRecord as EventRecord}
          defaultTab={drawerTab}
          onClose={() => {
            setSelectedRecord(null);
            setActiveDrawerSource(null);
          }}
          onRefresh={(updated) => {
            fetchRecords();
            if (updated) setSelectedRecord(updated);
          }}
        />
      )}
      {activeDrawerSource === 'tss' && selectedRecord && (
        <TssRecordDrawer
          record={selectedRecord as TssRecord}
          defaultTab={drawerTab === 'log' ? 'details' : drawerTab}
          onClose={() => {
            setSelectedRecord(null);
            setActiveDrawerSource(null);
          }}
          onRefresh={(updated) => {
            fetchRecords();
            if (updated) setSelectedRecord(updated);
          }}
        />
      )}
    </ProtectedLayout>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TasksPageContent />
    </Suspense>
  );
}
