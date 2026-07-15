'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ProtectedLayout from '@/components/ProtectedLayout';
import api from '@/lib/api';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800']
});
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area
} from 'recharts';
import {
  Target, TrendingUp, PhoneCall, Users, Calendar, Clock, CheckCircle,
  Search, Mail, Bell, ArrowUpRight, Video, Plus, ChevronLeft, ChevronRight, Shield, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ModelStats {
  total: number;
  open: number;
  followUp: number;
  installation: number;
  converted: number;
  conversionRate: string;
}

interface DashboardData {
  stats: {
    totalLeads: number;
    convertedLeads: number;
    openLeads: number;
    conversionRate: string;
  };
  overviews: {
    tss: ModelStats;
    leads: ModelStats;
    calls: ModelStats;
    events: ModelStats;
  };
  charts: {
    leadsPerDay: { date: string; count: number }[];
    leadsPerMonth: { month: string; count: number }[];
    leadsBySource: { source: string; count: number }[];
    conversionData: { month: string; total: number; converted: number; rate: string }[];
    labelDistribution: { label: string; count: number }[];
  };
}

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [agentAccounts, setAgentAccounts] = useState<any[]>([]);
  // TSS Overview Modes
  const [tssMode, setTssMode] = useState<'T' | 'M'>('M');
  const [tssDatasets, setTssDatasets] = useState<any[]>([]);
  const [activeTssDatasetIndex, setActiveTssDatasetIndex] = useState(0);
  const [tssDatasetStats, setTssDatasetStats] = useState<ModelStats | null>(null);

  // Events Overview Modes
  const [eventsMode, setEventsMode] = useState<'T' | 'E'>('E');
  const [eventDatasets, setEventDatasets] = useState<any[]>([]);
  const [activeEventDatasetIndex, setActiveEventDatasetIndex] = useState(0);
  const [eventDatasetStats, setEventDatasetStats] = useState<ModelStats | null>(null);

  const fetchTssDatasetStats = async (datasetId: string) => {
    try {
      const res = await api.get(`/tss/datasets/${datasetId}/analytics`);
      const d = res.data.stats || {};
      const total = d.total || 0;
      const converted = d.closed || 0;
      const open = d.open || 0;
      const followUp = d.followUp || 0;
      const installation = Math.max(0, total - open - followUp - converted);
      const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';
      setTssDatasetStats({
        total,
        open,
        followUp,
        installation,
        converted,
        conversionRate
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEventDatasetStats = async (datasetId: string) => {
    try {
      const res = await api.get(`/events/datasets/${datasetId}/analytics`);
      const d = res.data.stats || {};
      const total = d.total || 0;
      const converted = d.converted || 0;
      const open = d.open || 0;
      const followUp = d.followUp || 0;
      const installation = d.installation || 0;
      const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';
      setEventDatasetStats({
        total,
        open,
        followUp,
        installation,
        converted,
        conversionRate
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch TSS dataset-specific stats when active index changes
  useEffect(() => {
    if (tssDatasets.length > 0 && tssDatasets[activeTssDatasetIndex]) {
      fetchTssDatasetStats(tssDatasets[activeTssDatasetIndex]._id);
    }
  }, [tssDatasets, activeTssDatasetIndex]);

  // Fetch Event dataset-specific stats when active index changes
  useEffect(() => {
    if (eventDatasets.length > 0 && eventDatasets[activeEventDatasetIndex]) {
      fetchEventDatasetStats(eventDatasets[activeEventDatasetIndex]._id);
    }
  }, [eventDatasets, activeEventDatasetIndex]);

  const handlePrevTss = () => {
    setActiveTssDatasetIndex(prev => Math.max(0, prev - 1));
  };
  const handleNextTss = () => {
    setActiveTssDatasetIndex(prev => Math.min(tssDatasets.length - 1, prev + 1));
  };

  const handlePrevEvent = () => {
    setActiveEventDatasetIndex(prev => Math.max(0, prev - 1));
  };
  const handleNextEvent = () => {
    setActiveEventDatasetIndex(prev => Math.min(eventDatasets.length - 1, prev + 1));
  };

  // States for daily analytics chart
  const [chartRange, setChartRange] = useState<string>('month');
  const [chartMetric, setChartMetric] = useState<string>('leads');
  const [showSecondaryCalls, setShowSecondaryCalls] = useState(true);
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
      console.error('Failed to load chart data', err);
      toast.error('Failed to load chart data');
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(chartRange, customStart, customEnd);
  }, [chartRange, customStart, customEnd]);

  // Stopwatch session timer state (starts around 01:24:08 like the mockup)
  const [sessionSeconds, setSessionSeconds] = useState(5048);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hrs}:${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSessionTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
  };

  const fetchTodayRecords = async () => {
    setTodayLoading(true);
    try {
      // Load both leads and tss records to select the best reminders
      const [leadsRes, tssRes] = await Promise.all([
        api.get('/leads?today=true&limit=10'),
        api.get('/tss/records/today')
      ]);
      const combined = [
        ...(leadsRes.data.leads || []).map((l: any) => ({ ...l, type: 'Lead' })),
        ...(tssRes.data.records || []).map((r: any) => ({ ...r, type: 'TSS' }))
      ];
      setTodayRecords(combined);
    } catch (err) {
      console.error('Failed to load today records', err);
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const res = await api.get('/calendar');
      setCalendarEvents(res.data || []);
    } catch (err) {
      console.error('Failed to load calendar events', err);
    }
  };

  const fetchAgentAccounts = async () => {
    try {
      const res = await api.get('/dashboard/agent-tasks');
      setAgentAccounts(res.data || []);
    } catch (err) {
      console.error('Failed to load agent accounts', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTodayRecords();
    fetchUsers();
    fetchCalendarEvents();
    fetchAgentAccounts();

    // Fetch TSS and Event datasets lists
    api.get('/tss/datasets')
      .then(res => {
        setTssDatasets(res.data || []);
      })
      .catch(err => console.error('Error fetching TSS datasets:', err));

    api.get('/events/datasets')
      .then(res => {
        setEventDatasets(res.data || []);
      })
      .catch(err => console.error('Error fetching Event datasets:', err));
  }, []);

  // Determine upcoming calendar events for the "Reminders" card
  const upcomingCalendarEvents = calendarEvents
    .filter((e: any) => {
      if (!e.date) return false;
      const eventDate = new Date(e.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today && !e.isCompleted;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const heroEvent = upcomingCalendarEvents.length > 0 ? upcomingCalendarEvents[0] : null;

  // Chart data representation matching mockup structure
  const barData = [
    { name: 'S', value: 20, fillType: 'striped' },
    { name: 'M', value: 65, fillType: 'solid_dark' },
    { name: 'T', value: 74, fillType: 'solid_light' },
    { name: 'W', value: 85, fillType: 'solid_dark' },
    { name: 'T', value: 35, fillType: 'striped' },
    { name: 'F', value: 45, fillType: 'striped' },
    { name: 'S', value: 30, fillType: 'striped' }
  ];

  // Pie chart progress data (circular gauge)
  const conversionVal = data ? parseFloat(data.stats.conversionRate) : 41;
  const progressData = [
    { name: 'Progress', value: conversionVal },
    { name: 'Remaining', value: 100 - conversionVal }
  ];

  // Default mock projects if none are loaded
  const defaultProjects = [
    { name: 'Develop API Endpoints', date: 'Due date: Nov 26, 2026', color: '#4f46e5' },
    { name: 'Onboarding Flow', date: 'Due date: Nov 28, 2026', color: '#0ea5e9' },
    { name: 'Build Dashboard', date: 'Due date: Nov 30, 2026', color: '#10b981' },
    { name: 'Optimize Page Load', date: 'Due date: Dec 5, 2026', color: '#f59e0b' },
    { name: 'Cross-Browser Testing', date: 'Due date: Dec 6, 2026', color: '#ef4444' }
  ];

  const overviews = data?.overviews || {
    tss: { total: 0, open: 0, followUp: 0, installation: 0, converted: 0, conversionRate: '0.0' },
    leads: { total: 0, open: 0, followUp: 0, installation: 0, converted: 0, conversionRate: '0.0' },
    calls: { total: 0, open: 0, followUp: 0, installation: 0, converted: 0, conversionRate: '0.0' },
    events: { total: 0, open: 0, followUp: 0, installation: 0, converted: 0, conversionRate: '0.0' }
  };

  const renderStatusCard = (title: string, overview: ModelStats, label: string, isPrimary = false) => {
    const isTssCard = title === 'TSS';
    const isEventsCard = title === 'Events';

    let displayOverview = overview;
    if (isTssCard && tssMode === 'M' && tssDatasetStats) {
      displayOverview = tssDatasetStats;
    } else if (isEventsCard && eventsMode === 'E' && eventDatasetStats) {
      displayOverview = eventDatasetStats;
    }

    const bgStyle = isPrimary
      ? { background: 'linear-gradient(135deg, #1a1f36 0%, #2d3561 100%)', color: 'white', border: 'none', boxShadow: '0 10px 20px rgba(26,31,54,0.15)' }
      : { background: 'white', border: '1px solid #e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' };

    const textColor = isPrimary ? 'white' : '#1a1f36';
    const subTextColor = isPrimary ? 'rgba(255, 255, 255, 0.8)' : '#64748b';
    const openColor = isPrimary ? '#60a5fa' : '#3b82f6';
    const followUpColor = isPrimary ? '#fbbf24' : '#d97706';
    const installColor = isPrimary ? '#2dd4bf' : '#0d9488';
    const convertColor = isPrimary ? '#34d399' : '#10b981';

    return (
      <div style={{
        ...bgStyle,
        borderRadius: 20,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        textAlign: 'left'
      }}>
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isPrimary ? '1px solid rgba(255,255,255,0.15)' : '1px solid #f1f5f9', paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Users size={16} style={{ color: isPrimary ? 'white' : '#1a1f36', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title} Status Overview
            </span>
          </div>

          {/* T / M or T / E Selector */}
          {(isTssCard || isEventsCard) && (
            <div style={{ display: 'flex', gap: 4, background: isPrimary ? 'rgba(255,255,255,0.15)' : '#f1f5f9', padding: 2, borderRadius: 6, flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTssCard) setTssMode('T');
                  else setEventsMode('T');
                }}
                style={{
                  background: (isTssCard ? tssMode === 'T' : eventsMode === 'T') ? (isPrimary ? '#ffffff' : '#1a1f36') : 'transparent',
                  color: (isTssCard ? tssMode === 'T' : eventsMode === 'T') ? (isPrimary ? '#1a1f36' : '#ffffff') : subTextColor,
                  border: 'none',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                T
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTssCard) setTssMode('M');
                  else setEventsMode('E');
                }}
                style={{
                  background: (isTssCard ? tssMode === 'M' : eventsMode === 'E') ? (isPrimary ? '#ffffff' : '#1a1f36') : 'transparent',
                  color: (isTssCard ? tssMode === 'M' : eventsMode === 'E') ? (isPrimary ? '#1a1f36' : '#ffffff') : subTextColor,
                  border: 'none',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isTssCard ? 'M' : 'E'}
              </button>
            </div>
          )}
        </div>

        {/* Arrow pagination (visible in M or E modes) */}
        {isTssCard && tssMode === 'M' && tssDatasets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isPrimary ? 'rgba(255,255,255,0.1)' : '#f8fafc', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrevTss(); }}
              disabled={activeTssDatasetIndex === 0}
              style={{ background: 'none', border: 'none', color: isPrimary ? 'white' : '#64748b', cursor: 'pointer', opacity: activeTssDatasetIndex === 0 ? 0.3 : 1, display: 'flex' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 600, color: subTextColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {(tssDatasets[activeTssDatasetIndex]?.name || 'TSS')} ({activeTssDatasetIndex + 1}/{tssDatasets.length})
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleNextTss(); }}
              disabled={activeTssDatasetIndex === tssDatasets.length - 1}
              style={{ background: 'none', border: 'none', color: isPrimary ? 'white' : '#64748b', cursor: 'pointer', opacity: activeTssDatasetIndex === tssDatasets.length - 1 ? 0.3 : 1, display: 'flex' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {isEventsCard && eventsMode === 'E' && eventDatasets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isPrimary ? 'rgba(255,255,255,0.1)' : '#f8fafc', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrevEvent(); }}
              disabled={activeEventDatasetIndex === 0}
              style={{ background: 'none', border: 'none', color: isPrimary ? 'white' : '#64748b', cursor: 'pointer', opacity: activeEventDatasetIndex === 0 ? 0.3 : 1, display: 'flex' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 600, color: subTextColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {(eventDatasets[activeEventDatasetIndex]?.name || 'Events')} ({activeEventDatasetIndex + 1}/{eventDatasets.length})
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleNextEvent(); }}
              disabled={activeEventDatasetIndex === eventDatasets.length - 1}
              style={{ background: 'none', border: 'none', color: isPrimary ? 'white' : '#64748b', cursor: 'pointer', opacity: activeEventDatasetIndex === eventDatasets.length - 1 ? 0.3 : 1, display: 'flex' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isPrimary ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f8fafc', paddingBottom: 2 }}>
            <span style={{ color: subTextColor, fontWeight: 500 }}>Total {label}</span>
            <span style={{ fontWeight: 700, color: textColor }}>{displayOverview.total}</span>
          </div>
          {/* Open */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isPrimary ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f8fafc', paddingBottom: 2 }}>
            <span style={{ color: subTextColor, fontWeight: 500 }}>Open</span>
            <span style={{ fontWeight: 700, color: openColor }}>{displayOverview.open}</span>
          </div>
          {/* Follow Up */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isPrimary ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f8fafc', paddingBottom: 2 }}>
            <span style={{ color: subTextColor, fontWeight: 500 }}>In Follow Up</span>
            <span style={{ fontWeight: 700, color: followUpColor }}>{displayOverview.followUp}</span>
          </div>
          {/* Installation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isPrimary ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f8fafc', paddingBottom: 2 }}>
            <span style={{ color: subTextColor, fontWeight: 500 }}>Installation</span>
            <span style={{ fontWeight: 700, color: installColor }}>{displayOverview.installation}</span>
          </div>
          {/* Converted */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
            <span style={{ color: subTextColor, fontWeight: 500 }}>Converted</span>
            <span style={{ fontWeight: 700, color: convertColor }}>
              {displayOverview.converted} <span style={{ fontSize: 11, fontWeight: 500, color: isPrimary ? 'rgba(255, 255, 255, 0.7)' : '#94a3b8' }}>({displayOverview.conversionRate}% rate)</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ProtectedLayout>
      {/* SVG striped pattern for the bar chart cells */}
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <pattern id="striped" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>

      <div className={plusJakartaSans.className} style={{ padding: '8px 24px 24px', background: '#f8fafc', minHeight: 'calc(100vh - 56px)' }}>

        {/* Dashboard Title Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 0, marginBottom: 16 }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: 0 }}>Dashboard</h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: -6, marginBottom: 0 }}>Advent CRM powered by Advent Systems</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a
              href="/send-emails"
              style={{
                background: '#1a1f36',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 30,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none'
              }}
            >
              <Mail size={16} />
              <span>Send Emails</span>
            </a>
            <a
              href="https://tallysolutions.com/website/html/tally_login.html?destination_url=https%3A%2F%2Fcustomer.tallysolutions.com%2Fcustomerapp%2F"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'white',
                color: '#1a1f36',
                border: '1px solid #1a1f36',
                padding: '10px 20px',
                borderRadius: 30,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none'
              }}
            >
              <img
                src="/images.jpg"
                alt="Tally Logo"
                style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
              />
              <span>Tally Portal</span>
              <ExternalLink size={14} style={{ color: '#1a1f36' }} />
            </a>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
            <div className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
            <p style={{ color: '#64748b', fontSize: 14 }}>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
              {renderStatusCard('TSS', overviews.tss, 'TSS', true)}
              {renderStatusCard('Leads', overviews.leads, 'Leads', false)}
              {renderStatusCard('Calls', overviews.calls, 'Calls', false)}
              {renderStatusCard('Events', overviews.events, 'Events', false)}
            </div>

            {/* Layout Row 1: Analytics, Reminders, Project list */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 24, marginBottom: 24 }}>

              {/* Column 1: Project Analytics / Leads per Day Daily Chart */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 280 }}>
                {/* Header Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Analytics</h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select
                      className="form-select"
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: '#fff',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      value={chartMetric}
                      onChange={(e) => setChartMetric(e.target.value)}
                    >
                      <option value="leads">Leads</option>
                      <option value="calls">Calls</option>
                      <option value="events">Events</option>
                      <option value="tss">TSS</option>
                    </select>

                    <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                      {['week', 'month', 'quarter', 'year', 'custom'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setChartRange(opt)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            background: chartRange === opt ? '#fff' : 'transparent',
                            color: chartRange === opt ? '#1e293b' : '#64748b',
                            boxShadow: chartRange === opt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s',
                          }}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom inputs overlay */}
                {chartRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, justifyContent: 'flex-end' }}>
                    <input
                      type="date"
                      className="form-control"
                      style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #cbd5e1', width: 120 }}
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                    <span style={{ fontSize: 11, color: '#64748b' }}>to</span>
                    <input
                      type="date"
                      className="form-control"
                      style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #cbd5e1', width: 120 }}
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ flex: 1, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {chartLoading ? (
                    <div className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
                  ) : chartData.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#64748b' }}>No data available for this range</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.12} />
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          tickFormatter={v => {
                            try {
                              const parts = v.split('-');
                              return `${parts[1]}/${parts[2]}`;
                            } catch {
                              return v;
                            }
                          }}
                        />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: 11 }}
                          labelFormatter={v => {
                            try {
                              return format(new Date(v), 'MMM dd, yyyy');
                            } catch {
                              return v;
                            }
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey={
                            chartMetric === 'leads' ? 'all_leads' :
                              chartMetric === 'calls' ? 'all_calls' :
                                chartMetric === 'events' ? 'all_events' : 'all_tss'
                          }
                          stroke="#1d4ed8"
                          strokeWidth={1.5}
                          fillOpacity={1}
                          fill="url(#colorMetric)"
                          activeDot={{ r: 4, stroke: '#1d4ed8', strokeWidth: 1.5, fill: '#fff' }}
                          name={
                            chartMetric === 'leads' ? 'Leads' :
                              chartMetric === 'calls' ? 'Calls' :
                                chartMetric === 'events' ? 'Events' : 'TSS Records'
                          }
                        />
                        {chartMetric !== 'calls' && (
                          <Area
                            type="monotone"
                            dataKey="all_calls"
                            stroke="#34d399"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#colorSecondary)"
                            activeDot={{ r: 4, stroke: '#34d399', strokeWidth: 1.5, fill: '#fff' }}
                            name="Calls"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Column 2: Reminders */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Reminders</h3>
                  <button
                    onClick={() => window.location.href = '/calendar'}
                    style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    View All
                  </button>
                </div>

                {upcomingCalendarEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
                      {upcomingCalendarEvents.slice(0, 3).map((ev, index) => (
                        <div key={ev._id} style={{ textAlign: 'left', borderBottom: index < 2 ? '1px solid #f1f5f9' : 'none', paddingBottom: index < 2 ? 8 : 0 }}>
                          <div style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: ev.type === 'Reminder' ? '#0284c7' : '#ea580c',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 2
                          }}>
                            {ev.type === 'Reminder' ? 'Reminder' : 'Event'}
                          </div>
                          <h4 style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1f36', margin: '0 0 3px 0', lineHeight: 1.3 }}>
                            {ev.title}
                          </h4>
                          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                            {format(new Date(ev.date), 'MMM dd')}{ev.time ? ` at ${ev.time}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => window.location.href = '/calendar'}
                      style={{
                        background: '#1a1f36',
                        color: 'white',
                        border: 'none',
                        padding: '12px',
                        borderRadius: 30,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 16
                      }}
                    >
                      <Calendar size={16} /> Open Calendar
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 140, color: '#64748b' }}>
                    <Calendar size={32} style={{ strokeWidth: 1.5, color: '#cbd5e1', marginBottom: 10 }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>No upcoming events</span>
                    <button
                      onClick={() => window.location.href = '/calendar'}
                      style={{
                        background: '#ff7a59',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: 12
                      }}
                    >
                      Add Event
                    </button>
                  </div>
                )}
              </div>

              {/* Column 3: Agent Accounts */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Agent Accounts</h3>
                  <button
                    onClick={() => window.location.href = '/users'}
                    style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    Manage
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>
                  {(user?.role === 'Agent' ? agentAccounts.filter(a => a._id === user.id) : agentAccounts).slice(0, 5).map((agent, i) => {
                    const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
                    const color = colors[i % colors.length];
                    const initials = agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                    return (
                      <div key={agent._id} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: color, fontSize: 11, fontWeight: 700
                        }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {agent.name} <span style={{ color: '#475569', fontWeight: 400 }}>({agent.todayRemaining || 0})</span>
                          </div>
                          <div style={{ fontSize: 10, color: agent.remainingTasks > 0 ? '#ea580c' : '#94a3b8', marginTop: 2, fontWeight: agent.remainingTasks > 0 ? 500 : 400 }}>
                            {agent.remainingTasks} total {agent.remainingTasks === 1 ? 'task' : 'tasks'} remaining
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {agentAccounts.length === 0 && (
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                      No agent accounts found
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Layout Row 2: Team, Progress, Time Tracker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.3fr', gap: 24 }}>

              {/* Column 1: Team Collaboration */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Team Collaboration</h3>
                  <button
                    onClick={() => window.location.href = '/users'}
                    style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    + Add Member
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                  {users.slice(0, 3).map((u, i) => {
                    const agentInfo = agentAccounts.find(a => a._id === u._id);
                    const todayRemaining = agentInfo ? (agentInfo.todayRemaining || 0) : 0;
                    return (
                      <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #115e59, #0f766e)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                          {u.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                            {u.name} <span style={{ color: '#475569', fontWeight: 400 }}>({todayRemaining})</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{u.role}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 6 }}>Active</span>
                      </div>
                    );
                  })}
                  {users.length === 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>AD</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>Alexandra Deff</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Working on Github Repository</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 6 }}>Completed</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>EA</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>Edwin Adenike</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Integrate Auth Systems</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#b45309', background: '#fef9c3', padding: '3px 8px', borderRadius: 6 }}>In Progress</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Column 2: Lead Conversion (Circular gauge) */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 10px 0', alignSelf: 'flex-start' }}>Lead Conversion</h3>

                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 130 }}>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={progressData}
                        cx="50%" cy="100%"
                        startAngle={180} endAngle={0}
                        innerRadius={68} outerRadius={85}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#1a1f36" style={{ strokeLinecap: 'round' }} />
                        <Cell fill="#e2e8f0" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Floating percentage label in center */}
                  <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{conversionVal}%</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Overall Conversion</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Time Tracker */}
              <div style={{
                background: 'linear-gradient(135deg, #1a1f36 0%, #252b4a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 20,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                boxShadow: '0 10px 20px rgba(26, 31, 54, 0.15)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Visual decoration - abstract gradient wave overlay */}
                <div style={{
                  position: 'absolute',
                  width: '180%',
                  height: '180%',
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                  top: '-30%',
                  left: '-40%',
                  pointerEvents: 'none'
                }} />

                <div style={{ textAlign: 'left', zIndex: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 500, opacity: 0.9, margin: 0 }}>Time Tracker</h3>
                </div>

                <div style={{ margin: '24px 0', zIndex: 10 }}>
                  <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '1px', display: 'block', lineHeight: 1 }}>
                    {currentTime}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.6, marginTop: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Current Time
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, zIndex: 10 }}>
                  <button style={{ flex: 1, padding: '10px', borderRadius: 30, background: '#ffffff', border: 'none', color: '#1a1f36', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    View Log
                  </button>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </ProtectedLayout>
  );
}
