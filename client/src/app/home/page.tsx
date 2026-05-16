'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { Target, TrendingUp, PhoneCall, Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#1a73e8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const LABEL_CLASSES: Record<string, string> = {
  'Open': 'badge badge-open',
  'Call Back': 'badge badge-call-back',
  'Interested': 'badge badge-interested',
  'Not Interested': 'badge badge-not-interested',
  'Follow Up': 'badge badge-follow-up',
  'Hot Lead': 'badge badge-hot-lead',
  'Cold Lead': 'badge badge-cold-lead',
};

interface DashboardData {
  stats: {
    totalLeads: number;
    convertedLeads: number;
    openLeads: number;
    conversionRate: string;
  };
  charts: {
    leadsPerDay: { date: string; count: number }[];
    leadsPerMonth: { month: string; count: number }[];
    leadsBySource: { source: string; count: number }[];
    conversionData: { month: string; total: number; converted: number; rate: string }[];
    labelDistribution: { label: string; count: number }[];
  };
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 500, marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#1a1f36', lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'lead' | 'tss'>('lead');
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  const fetchTodayRecords = async () => {


    setTodayLoading(true);
    try {
      if (view === 'lead') {
        const res = await api.get('/leads?today=true&limit=100');
        setTodayRecords(res.data.leads || []);
      } else {
        const res = await api.get('/tss/records/today');
        setTodayRecords(res.data.records || []);
      }
    } catch (err) {
      toast.error('Failed to load today records');
      setTodayRecords([]);
    } finally {
      setTodayLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayRecords();
  }, [view]);

  const fetchStats = async () => {


    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <ProtectedLayout>
      <TopBar title="Dashboard" onRefresh={fetchStats} />
      <div style={{ padding: '24px', background: '#f4f6fb', minHeight: 'calc(100vh - 56px)' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
            <p>Loading dashboard...</p>
          </div>
        ) : !data ? (
          <div className="empty-state">
            <p>Failed to load dashboard data. Make sure the backend is running.</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard icon={Target} label="Total Leads" value={data.stats.totalLeads} color="#1a73e8" />
              <StatCard icon={TrendingUp} label="Converted Leads" value={data.stats.convertedLeads} sub={`${data.stats.conversionRate}% rate`} color="#10b981" />
              <StatCard icon={Users} label="Open Leads" value={data.stats.openLeads} color="#f59e0b" />
              <StatCard icon={PhoneCall} label="Conversion Rate" value={`${data.stats.conversionRate}%`} sub="of total leads" color="#8b5cf6" />
            </div>

            {/* Today's Work Table */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>Scheduled for Today</h3>
                <select 
                  className="form-select" 
                  style={{ width: 160, padding: '6px 12px', fontSize: 13, fontWeight: 600, background: '#fff' }}
                  value={view}
                  onChange={(e) => setView(e.target.value as 'lead' | 'tss')}
                >
                  <option value="lead">Lead Data</option>
                  <option value="tss">TSS Data</option>
                </select>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {todayLoading ? (
                  <div className="empty-state"><div className="spinner spinner-dark" style={{ width: 32, height: 32 }} /></div>
                ) : todayRecords.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ background: '#f8fafc', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#94a3b8' }}>
                      <CheckCircle size={24} />
                    </div>
                    <h3 style={{ fontSize: 15, color: '#1e293b', margin: '0 0 6px 0' }}>All Caught Up</h3>
                    <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>There are no {view === 'lead' ? 'leads' : 'TSS records'} scheduled for today.</p>
                  </div>
                ) : view === 'lead' ? (
                  <div style={{ overflowX: 'auto' }}>
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
                        {todayRecords.map(lead => (
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
                                {lead.isConverted ? (
                                  <span className="badge badge-converted">Converted</span>
                                ) : (
                                  (lead.labels || []).map((l: string) => <span key={l} className={LABEL_CLASSES[l] || 'badge'}>{l}</span>)
                                )}
                              </div>
                            </td>
                            <td style={{ color: '#9ca3af', fontSize: 13 }}>{format(new Date(lead.createdAt), 'MMM d')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', width: 280 }}>Customer Name</th>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Mobile Number</th>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Serial Number</th>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Rel. Version</th>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Labels</th>
                          <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Dates</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayRecords.map((r, i) => (
                          <tr
                            key={r._id}
                            style={{ borderBottom: i === todayRecords.length - 1 ? 'none' : '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfd' }}
                          >
                            <td style={{ padding: '12px 24px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.customerName || '-'}>
                                {r.customerName || '-'}
                              </div>
                            </td>
                            <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.mobileNumber || '-'}</td>
                            <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.serialNumber || '-'}</td>
                            <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.releaseVersion || r.data?.Release || r.data?.['Release Version'] || '-'}</td>
                            <td style={{ padding: '12px 24px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {r.status === 'Closed' && <span className="badge badge-converted" style={{ fontSize: 10 }}>Closed</span>}
                                {r.status !== 'Closed' && (r.labels || []).slice(0, 2).map((l: string) => <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 10 }}>{l}</span>)}
                              </div>
                            </td>
                            <td style={{ padding: '12px 24px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {r.renewalDate && <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12}/> {format(new Date(r.renewalDate), 'MMM d')}</span>}
                                {r.followUpDate && !r.renewalDate && <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> {format(new Date(r.followUpDate), 'MMM d')}</span>}
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

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="chart-card">
                <p className="chart-title">Leads Per Day (Last 30 days)</p>
                {data.charts.leadsPerDay.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <p style={{ fontSize: 13 }}>No data yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.leadsPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Bar dataKey="count" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="chart-card">
                <p className="chart-title">Leads Per Month (Last 12 months)</p>
                {data.charts.leadsPerMonth.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <p style={{ fontSize: 13 }}>No data yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.charts.leadsPerMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#1a73e8" strokeWidth={2.5} dot={{ r: 4 }} name="Leads" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Charts row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="chart-card">
                <p className="chart-title">Leads by Source</p>
                {data.charts.leadsBySource.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <p style={{ fontSize: 13 }}>No data yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie data={data.charts.leadsBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                          {data.charts.leadsBySource.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1 }}>
                      {data.charts.leadsBySource.map((d, i) => (
                        <div key={d.source} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{d.source}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1f36' }}>{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="chart-card">
                <p className="chart-title">Conversion Rate Over Time</p>
                {data.charts.conversionData.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 0' }}>
                    <p style={{ fontSize: 13 }}>No data yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.charts.conversionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Legend />
                      <Area type="monotone" dataKey="total" stackId="1" stroke="#1a73e8" fill="#dbeafe" name="Total" />
                      <Area type="monotone" dataKey="converted" stackId="2" stroke="#10b981" fill="#dcfce7" name="Converted" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
