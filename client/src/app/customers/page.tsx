'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Search, Filter, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, RefreshCw, X, ExternalLink,
  Mail, Phone, Building2, User, Database, PhoneCall, ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';

interface CustomerRecord {
  _id: string;
  originalId: string;
  datasetId?: string;
  datasetName?: string;
  source: 'leads' | 'calls' | 'events' | 'tss';
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  labels: string[];
  createdAt: string;
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

const LABEL_OPTIONS = ['Open', 'Call Back', 'Follow Up', 'Review', 'Converted', 'Closed'];

export default function CustomersPage() {
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [label, setLabel] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  
  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

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
      if (label) params.label = label;

      const res = await api.get('/users/customers', { params });
      setRecords(res.data.customers);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      toast.error('Failed to fetch aggregated customer list');
    } finally {
      setLoading(false);
    }
  }, [page, search, source, status, label, sortBy, sortOrder]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, source, status, label]);

  const handleClearFilters = () => {
    setSearch('');
    setSource('');
    setStatus('');
    setLabel('');
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

  const getSourceURL = (item: CustomerRecord) => {
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

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="Customers (Admin)" onRefresh={fetchRecords} />

      <div style={{ padding: 24 }}>
        {/* Statistics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
              <User size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Total Customers</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{total}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Active Leads/Events</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {records.filter(r => r.source === 'leads' || r.source === 'events').length} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <PhoneCall size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Calls outreach</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {records.filter(r => r.source === 'calls').length} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c2410c' }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>TSS Datasets</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {records.filter(r => r.source === 'tss').length} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>on page</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {/* Search Input */}
            <div className="search-container" style={{ minWidth: 260, flex: 1 }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, company, email, or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Converted">Converted</option>
                <option value="Closed">Closed</option>
              </select>

              {/* Label Filter */}
              <select
                className="form-select"
                style={{ width: 140, padding: '8px 10px', height: 38 }}
                value={label}
                onChange={e => setLabel(e.target.value)}
              >
                <option value="">All Labels</option>
                {LABEL_OPTIONS.map(lbl => (
                  <option key={lbl} value={lbl}>{lbl}</option>
                ))}
              </select>

              {/* Clear Button */}
              {(search || source || status || label) && (
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

        {/* Unified Customers Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 12 }}>
              <div className="spinner spinner-dark" />
              <span style={{ color: '#64748b', fontSize: 13.5 }}>Fetching combined database records...</span>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
              <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>No Customers Found</h3>
              <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Try clearing some filters or searching for another term.</p>
              {(search || source || status || label) && (
                <button className="btn-secondary" style={{ marginTop: 16, background: 'white' }} onClick={handleClearFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
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
                        Company / Product Info <SortIcon col="company" />
                      </th>
                      <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>
                        Email <SortIcon col="email" />
                      </th>
                      <th onClick={() => toggleSort('phone')} style={{ cursor: 'pointer' }}>
                        Phone <SortIcon col="phone" />
                      </th>
                      <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>
                        Status <SortIcon col="status" />
                      </th>
                      <th>Labels</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>
                        Created Date <SortIcon col="createdAt" />
                      </th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(item => (
                      <tr key={item._id} style={{ transition: 'background-color 0.15s' }} className="table-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ 
                              width: 32, 
                              height: 32, 
                              fontSize: 11, 
                              fontWeight: 700, 
                              background: item.source === 'leads' ? '#e0f2fe' : item.source === 'calls' ? '#dcfce7' : item.source === 'events' ? '#f3e8ff' : '#ffedd5',
                              color: item.source === 'leads' ? '#0369a1' : item.source === 'calls' ? '#15803d' : item.source === 'events' ? '#6b21a8' : '#c2410c'
                            }}>
                              {item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</span>
                            </div>
                          </div>
                        </td>
                        <td>{getSourceBadge(item.source)}</td>
                        <td>
                          <span style={{ fontSize: '13.5px', color: '#334155', fontWeight: 500 }}>
                            {item.company}
                          </span>
                        </td>
                        <td>
                          {item.email && item.email !== 'N/A' ? (
                            <a href={`mailto:${item.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1a73e8', textDecoration: 'none', fontSize: 13 }} title={`Email ${item.name}`}>
                              <Mail size={13} />
                              {item.email}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td>
                          {item.phone && item.phone !== 'N/A' ? (
                            <a href={`tel:${item.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1a73e8', textDecoration: 'none', fontSize: 13 }} title={`Call ${item.name}`}>
                              <Phone size={13} />
                              {item.phone}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${item.status.toLowerCase() === 'converted' ? 'badge-converted' : item.status.toLowerCase() === 'closed' ? 'badge-not-interested' : 'badge-open'}`} style={{ fontSize: 11.5 }}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.labels.length > 0 ? (
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
                        <td style={{ color: '#64748b', fontSize: 12.5 }}>
                          {item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <a
                            href={getSourceURL(item)}
                            className="btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              fontSize: 12,
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              color: '#0f172a',
                              textDecoration: 'none',
                              fontWeight: 600,
                              transition: 'all 0.15s'
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                          >
                            Go to Section
                            <ArrowUpRight size={13} />
                          </a>
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
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{total}</span> customers
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
    </ProtectedLayout>
  );
}
