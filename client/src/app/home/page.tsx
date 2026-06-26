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
  'Completed': 'badge badge-completed',
  'Closed': 'badge badge-closed',
};

const METRIC_LABELS: Record<string, string> = {
  all_leads: 'All Leads',
  converted_leads: 'Converted Leads',
  all_calls: 'All Calls',
  open_calls: 'Open Calls',
  follow_up_calls: 'Follow Up Calls',
  none: 'None',
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

  const [chartRange, setChartRange] = useState<string>('1m');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const [metric1, setMetric1] = useState<string>('all_leads');
  const [metric2, setMetric2] = useState<string>('none');
  const [chartType, setChartType] = useState<'line' | 'bar'>('bar');

  const formatChartDate = (v: string, fmt: string) => {
    try {
      const parts = v.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return format(d, fmt);
      }
      return v;
    } catch (e) {
      return v;
    }
  };

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

  const fetchChartData = async (range: string, start?: string, end?: string) => {
    if (range === 'custom' && (!start || !end)) return;
    setChartLoading(true);
    try {
      let url = `/dashboard/analytics?range=${range}`;
      if (range === 'custom') {
        url += `&startDate=${start}&endDate=${end}`;
      }
      const res = await api.get(url);
      setChartData(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load chart data');
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(chartRange, customStart, customEnd);
  }, [chartRange, customStart, customEnd]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats');
      setData(res.data);
      fetchChartData(chartRange, customStart, customEnd);
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

            {/* Analytics Chart (Full Width) */}
            <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                {/* Metrics dropdowns on the left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>Analytics</h3>
                  <select
                    className="form-select"
                    style={{ width: 140, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={metric1}
                    onChange={(e) => setMetric1(e.target.value)}
                  >
                    <option value="all_leads">All Leads</option>
                    <option value="converted_leads">Converted Leads</option>
                    <option value="all_calls">All Calls</option>
                    <option value="open_calls">Open Calls</option>
                    <option value="follow_up_calls">Follow Up Calls</option>
                  </select>

                  <select
                    className="form-select"
                    style={{ width: 155, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={metric2}
                    onChange={(e) => setMetric2(e.target.value)}
                  >
                    <option value="none">None (Single Metric)</option>
                    <option value="all_leads">All Leads</option>
                    <option value="converted_leads">Converted Leads</option>
                    <option value="all_calls">All Calls</option>
                    <option value="open_calls">Open Calls</option>
                    <option value="follow_up_calls">Follow Up Calls</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Graph Type Selector (Line vs Bar) */}
                  <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                    <button
                      onClick={() => setChartType('bar')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: chartType === 'bar' ? '#fff' : 'transparent',
                        color: chartType === 'bar' ? '#1e293b' : '#64748b',
                        boxShadow: chartType === 'bar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Bar
                    </button>
                    <button
                      onClick={() => setChartType('line')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: chartType === 'line' ? '#fff' : 'transparent',
                        color: chartType === 'line' ? '#1e293b' : '#64748b',
                        boxShadow: chartType === 'line' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Line
                    </button>
                  </div>

                  {/* Range select buttons */}
                  <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                    {['7d', '1w', '2w', '1m', '1yr', 'custom'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setChartRange(opt)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: chartRange === opt ? '#fff' : 'transparent',
                          color: chartRange === opt ? '#1e293b' : '#64748b',
                          boxShadow: chartRange === opt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        {opt === '7d' ? '7D' : opt === '1w' ? '1W' : opt === '2w' ? '2W' : opt === '1m' ? '1M' : opt === '1yr' ? '1Yr' : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {/* Custom date range picker inputs */}
                  {chartRange === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="date"
                        className="form-control"
                        style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', width: 130 }}
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                      <input
                        type="date"
                        className="form-control"
                        style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', width: 130 }}
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {chartLoading ? (
                <div className="empty-state" style={{ height: 240 }}>
                  <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
                </div>
              ) : chartData.length === 0 ? (
                <div className="empty-state" style={{ height: 240 }}>
                  <p style={{ fontSize: 13, color: '#64748b' }}>No data available for this range</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  {chartType === 'bar' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        tickFormatter={v => formatChartDate(v, 'MMM d')} 
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} 
                        labelFormatter={v => formatChartDate(v, 'EEEE, MMMM d, yyyy')}
                      />
                      {metric2 !== 'none' && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />}
                      <Bar dataKey={metric1} fill="#1a73e8" radius={[4, 4, 0, 0]} name={METRIC_LABELS[metric1]} />
                      {metric2 !== 'none' && (
                        <Bar dataKey={metric2} fill="#10b981" radius={[4, 4, 0, 0]} name={METRIC_LABELS[metric2]} />
                      )}
                    </BarChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMetric1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMetric2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        tickFormatter={v => formatChartDate(v, 'MMM d')} 
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} 
                        labelFormatter={v => formatChartDate(v, 'MMMM d, yyyy')}
                      />
                      {metric2 !== 'none' && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />}
                      <Area type="monotone" dataKey={metric1} stroke="#1a73e8" strokeWidth={2} fillOpacity={1} fill="url(#colorMetric1)" name={METRIC_LABELS[metric1]} />
                      {metric2 !== 'none' && (
                        <Area type="monotone" dataKey={metric2} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMetric2)" name={METRIC_LABELS[metric2]} />
                      )}
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Scheduled for Today Table */}
              <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: 280, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p className="chart-title" style={{ margin: 0 }}>Scheduled for Today</p>
                  <select 
                    className="form-select" 
                    style={{ width: 110, padding: '2px 8px', fontSize: 12, fontWeight: 600, background: '#fff', height: 28 }}
                    value={view}
                    onChange={(e) => setView(e.target.value as 'lead' | 'tss')}
                  >
                    <option value="lead">Leads</option>
                    <option value="tss">TSS Records</option>
                  </select>
                </div>
                
                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
                  {todayLoading ? (
                    <div className="empty-state"><div className="spinner spinner-dark" style={{ width: 32, height: 32 }} /></div>
                  ) : todayRecords.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 180 }}>
                      <div style={{ background: '#f8fafc', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#94a3b8' }}>
                        <CheckCircle size={20} />
                      </div>
                      <h3 style={{ fontSize: 14, color: '#1e293b', margin: '0 0 4px 0' }}>All Caught Up</h3>
                      <p style={{ color: '#64748b', margin: 0, fontSize: 12 }}>There are no {view === 'lead' ? 'leads' : 'TSS records'} scheduled for today.</p>
                    </div>
                  ) : view === 'lead' ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ minWidth: 600 }}>
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
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', width: 200 }}>Customer Name</th>
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
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.customerName || '-'}>
                                  {r.customerName || '-'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.mobileNumber || '-'}</td>
                              <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.serialNumber || '-'}</td>
                              <td style={{ padding: '12px 24px', color: '#475569', fontSize: 13 }}>{r.releaseVersion || r.data?.Release || r.data?.['Release Version'] || '-'}</td>
                              <td style={{ padding: '12px 24px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {(r.labels || []).slice(0, 2).map((l: string) => <span key={l} className={LABEL_CLASSES[l] || 'badge'} style={{ fontSize: 10 }}>{l}</span>)}
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

              {/* Leads Per Month (Last 12 months) */}
              <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: 280, padding: 16 }}>
                <p className="chart-title" style={{ marginBottom: 12 }}>Leads Per Month (Last 12 months)</p>
                <div style={{ flex: 1 }}>
                  {data.charts.leadsPerMonth.length === 0 ? (
                    <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ fontSize: 13, color: '#64748b' }}>No data yet</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.charts.leadsPerMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
