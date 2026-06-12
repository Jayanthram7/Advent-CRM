'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { X, TrendingUp, Users, CheckCircle, Clock, BarChart2, RefreshCw, MessageSquare, Flame, Video } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];

type Section = 'leads' | 'calls' | 'tss' | 'events';

interface AnalyticsData {
  stats: {
    total: number;
    converted?: number;
    open?: number;
    followUp?: number;
    installation?: number;
    closed?: number;
    conversionRate?: string;
    totalFollowUps?: number;
    followsPerLead?: string;
    avgLeadsPerDay?: string;
    avgFollowsPerDay?: string;
    avgInstallationsPerDay?: string;
  };
  trend: { date: string; count: number; converted?: number }[];
  labels: { name: string; count: number }[];
  sources?: { name: string; count: number }[];
  assignments: { name: string; count: number }[];
  topFollowed?: { id: string; name: string; count: number }[];
}

interface Props {
  section: Section;
  datasetId?: string;
  datasetName?: string;
  onClose: () => void;
  onViewRecord?: (name: string) => void;
}

const SECTION_CONFIG: Record<Section, { title: string; apiPath: (id?: string) => string; color: string; gradient: string; primaryLabel: string }> = {
  leads: { title: 'Leads Analytics', apiPath: () => '/leads/analytics', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', primaryLabel: 'Total Leads' },
  calls: { title: 'Calls Analytics', apiPath: () => '/calls/analytics', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', primaryLabel: 'Total Calls' },
  tss: { title: 'TSS Analytics', apiPath: (id) => `/tss/datasets/${id}/analytics`, color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', primaryLabel: 'Total Records' },
  events: { title: 'Event Analytics', apiPath: (id) => `/events/datasets/${id}/analytics`, color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', primaryLabel: 'Total Records' },
};

const RANGE_OPTIONS = [
  { id: '7d', label: '7 Days' },
  { id: '1m', label: '1 Month' },
  { id: '3m', label: '3 Months' },
  { id: '1yr', label: '1 Year' },
  { id: 'custom', label: 'Custom' },
];

function formatChartDate(v: string) {
  try {
    const parts = v.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return format(d, 'MMM d');
    }
    return v;
  } catch { return v; }
}

function StatCard({ icon: Icon, label, value, sub, color, accent }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  accent?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '20px 24px',
      border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent || color, borderRadius: '16px 16px 0 0'
      }} />
      <div style={{ marginTop: 4 }}>
        <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1, margin: 0 }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 5, fontWeight: 500 }}>{sub}</p>}
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4
      }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  );
}

export default function AnalyticsModal({ section, datasetId, datasetName, onClose, onViewRecord }: Props) {
  const { sidebarCollapsed } = useAuth();
  const cfg = SECTION_CONFIG[section];
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('1m');
  const [chartType, setChartType] = useState<'bar' | 'area'>('area');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = cfg.apiPath(datasetId) + `?range=${range}`;
      if (range === 'custom') url += `&startDate=${customStart}&endDate=${customEnd}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [cfg, datasetId, range, customStart, customEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  const stats = data?.stats;
  const trend = data?.trend || [];
  const labels = data?.labels || [];
  const sources = data?.sources || [];
  const assignments = data?.assignments || [];
  const topFollowed = data?.topFollowed || [];
  const totalLabels = labels.reduce((s, l) => s + l.count, 0);

  return (
    <div className={`analytics-page ${sidebarCollapsed ? 'collapsed' : ''}`} style={{
      animation: 'analyticsIn 0.2s ease',
    }}>
      {/* Top Header Bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: cfg.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart2 size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
              {datasetName ? `${datasetName}` : cfg.title}
            </h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, marginTop: 2 }}>
              Analytics Dashboard · {datasetName ? cfg.title : 'Full Overview'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Range Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 2 }}>
            {RANGE_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setRange(opt.id)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: range === opt.id ? 'white' : 'transparent',
                color: range === opt.id ? '#0f172a' : '#64748b',
                boxShadow: range === opt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>
                {opt.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white' }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: 'white' }} />
            </div>
          )}

          {/* Chart Type Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 2 }}>
            {(['area', 'bar'] as const).map(t => (
              <button key={t} onClick={() => setChartType(t)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: chartType === t ? 'white' : 'transparent',
                color: chartType === t ? '#0f172a' : '#64748b',
                boxShadow: chartType === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t === 'area' ? '📈 Area' : '📊 Bar'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={onClose}
            style={{ background: '#0f172a', border: 'none', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: `3px solid ${cfg.color}30`,
              borderTopColor: cfg.color,
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading analytics...</p>
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b', fontSize: 15 }}>
            Failed to load analytics data. Please try refreshing.
          </div>
        ) : (
          <div style={{ maxWidth: 1600, margin: '0 auto' }}>

            {/* Consolidated 2-Card Metric Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Card 1: Record Status */}
              <div style={{
                background: 'white',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '14px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color={cfg.color} /> Status Overview
                </h3>
                
                {/* Line 1: Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Total {section === 'leads' ? 'Leads' : section === 'calls' ? 'Calls' : section === 'events' ? 'Event Records' : 'TSS Records'}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{stats?.total ?? 0}</span>
                </div>

                {/* Line 2: Open */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Open</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{stats?.open ?? 0}</span>
                </div>

                {/* Line 3: In Follow Up */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>In Follow Up</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{stats?.followUp ?? 0}</span>
                </div>

                {/* Line 4: Installation */}
                {stats?.installation !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Installation</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#06b6d4' }}>{stats.installation}</span>
                  </div>
                )}

                {/* Line 5: Closed / Converted */}
                {stats?.closed !== undefined ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Closed</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{stats.closed}</span>
                  </div>
                ) : stats?.converted !== undefined ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Converted</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                      {stats.converted} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>({stats.conversionRate}% rate)</span>
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Card 2: Performance Averages */}
              <div style={{
                background: 'white',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '14px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} color="#8b5cf6" /> Performance Averages
                </h3>

                {/* Follows Per Lead */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Follows / Lead (Avg)</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6' }}>
                    {stats?.followsPerLead ?? '0.00'}
                    {stats?.totalFollowUps !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>({stats.totalFollowUps} total)</span>
                    )}
                  </span>
                </div>

                {/* Avg Leads Per Day */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
                    Avg {section === 'leads' ? 'Leads' : section === 'calls' ? 'Calls' : 'Records'} / Day
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{stats?.avgLeadsPerDay ?? '0.0'}</span>
                </div>

                {/* Avg Follows Per Day */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Avg Follows / Day</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{stats?.avgFollowsPerDay ?? '0.0'}</span>
                </div>

                {/* Avg Installations Per Day */}
                {section !== 'tss' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Avg Installations / Day</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#06b6d4' }}>{stats?.avgInstallationsPerDay ?? '0.0'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Trend Chart — Full Width */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Records Over Time</h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                    {range === 'custom' ? `${customStart} → ${customEnd}` : RANGE_OPTIONS.find(r => r.id === range)?.label || '1 Month'}
                  </p>
                </div>
              </div>

              {trend.length === 0 ? (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>No data for this time range</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  {chartType === 'area' ? (
                    <AreaChart data={trend} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cfg.color} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradConverted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatChartDate} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
                        labelFormatter={v => formatChartDate(String(v))}
                      />
                      {trend[0]?.converted !== undefined && <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />}
                      <Area type="monotone" dataKey="count" stroke={cfg.color} strokeWidth={2.5} fillOpacity={1} fill="url(#gradCount)" name="Records" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      {trend[0]?.converted !== undefined && (
                        <Area type="monotone" dataKey="converted" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradConverted)" name="Converted" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      )}
                    </AreaChart>
                  ) : (
                    <BarChart data={trend} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatChartDate} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }} labelFormatter={v => formatChartDate(String(v))} />
                      {trend[0]?.converted !== undefined && <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />}
                      <Bar dataKey="count" fill={cfg.color} radius={[4, 4, 0, 0]} name="Records" />
                      {trend[0]?.converted !== undefined && (
                        <Bar dataKey="converted" fill="#10b981" radius={[4, 4, 0, 0]} name="Converted" />
                      )}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom Row — Responsive Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20
            }}>
              {/* Label Distribution */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Label Distribution</h3>
                {labels.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>No label data</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {labels.map((d, i) => {
                      const pct = totalLabels > 0 ? ((d.count / totalLabels) * 100).toFixed(1) : 0;
                      return (
                        <div key={d.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{d.name}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                              {d.count} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Source/Country Breakdown */}
              {sources.length > 0 && (
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
                    {section === 'events' ? 'By Country' : 'Lead Source'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: '0 0 180px' }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={sources} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} strokeWidth={0}>
                            {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1 }}>
                      {sources.slice(0, 6).map((d, i) => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || 'Unknown'}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top 5 Most Followed */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Top 5 Most Followed</h3>
                {topFollowed.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                    No follow-ups found
                  </div>
                ) : (
                  <div>
                    {topFollowed.map((d, i) => {
                      const maxCount = topFollowed[0]?.count || 1;
                      const pct = maxCount > 0 ? ((d.count / maxCount) * 100).toFixed(0) : 0;
                      return (
                        <div key={d.id || i} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: '#3b82f620',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#3b82f6', flexShrink: 0
                              }}>
                                #{i + 1}
                              </div>
                              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>
                                {d.name}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flexShrink: 0, marginLeft: 8 }}>
                              {d.count} {d.count === 1 ? 'follow' : 'follows'}
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agent Workload */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Agent Workload</h3>
                {assignments.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                    No assignments found
                  </div>
                ) : (
                  <div>
                    {assignments.map((d, i) => {
                      const maxCount = assignments[0]?.count || 1;
                      const pct = ((d.count / maxCount) * 100).toFixed(0);
                      return (
                        <div key={d.name} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: COLORS[i % COLORS.length] + '20',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: COLORS[i % COLORS.length], flexShrink: 0
                              }}>
                                {d.name.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{d.count}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes analyticsIn { from { opacity: 0; transform: scale(0.98) } to { opacity: 1; transform: scale(1) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
