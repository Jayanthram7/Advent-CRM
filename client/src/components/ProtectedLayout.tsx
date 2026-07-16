'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import { Search, Mail, Bell, X, Compass, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'Manager' | 'Agent';
}

const SECTIONS = [
  { name: 'Dashboard', url: '/home', keywords: ['home', 'dashboard', 'analytics', 'stopwatch', 'stats'] },
  { name: 'Leads', url: '/leads', keywords: ['leads', 'contacts', 'customers', 'pipelines'] },
  { name: 'Calls', url: '/calls', keywords: ['calls', 'telephony', 'dialer', 'callback'] },
  { name: 'Events', url: '/events', keywords: ['events', 'stalls', 'exhibition', 'halls'] },
  { name: 'TSS', url: '/tss', keywords: ['tss', 'tally', 'license', 'renewal', 'tally software service'] },
  { name: 'Send Emails', url: '/send-emails', keywords: ['email', 'mailer', 'send emails', 'templates', 'wysiwyg'] },
  { name: 'Tasks', url: '/tasks', keywords: ['tasks', 'projects', 'todo', 'kanban'] },
  { name: 'Calendar', url: '/calendar', keywords: ['calendar', 'events', 'notes', 'reminders', 'schedule'] }
];

export default function ProtectedLayout({ children, requiredRole }: ProtectedLayoutProps) {
  const { user, loading, sidebarCollapsed } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showDock, setShowDock] = useState(true);

  // Dragging states
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'BUTTON' || 
      target.closest('button') || 
      target.closest('a')
    ) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'BUTTON' || 
      target.closest('button') || 
      target.closest('a')
    ) {
      return;
    }
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let x = e.clientX - dragStart.x;
      let y = e.clientY - dragStart.y;
      x = Math.max(10, Math.min(x, window.innerWidth - 730));
      y = Math.max(10, Math.min(y, window.innerHeight - 100));
      setCoords({ x, y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      let x = touch.clientX - dragStart.x;
      let y = touch.clientY - dragStart.y;
      x = Math.max(10, Math.min(x, window.innerWidth - 730));
      y = Math.max(10, Math.min(y, window.innerHeight - 100));
      setCoords({ x, y });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragStart]);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [recordResults, setRecordResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const navigateToSection = async (sectionUrl: string) => {
    if (sectionUrl === '/events') {
      try {
        const res = await api.get('/events/datasets');
        const datasets = res.data;
        if (Array.isArray(datasets) && datasets.length > 0) {
          router.push(`/events/${datasets[0]._id}`);
          setSearchQuery('');
          setActiveIndex(-1);
          return;
        }
      } catch (err) {
        console.error('Error navigating to latest event:', err);
      }
    }
    router.push(sectionUrl);
    setSearchQuery('');
    setActiveIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalResults = matchedSections.length + recordResults.length;
    if (totalResults === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % totalResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + totalResults) % totalResults);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < totalResults) {
        if (activeIndex < matchedSections.length) {
          const selectedSection = matchedSections[activeIndex];
          navigateToSection(selectedSection.url);
        } else {
          const selectedRecord = recordResults[activeIndex - matchedSections.length];
          router.push(selectedRecord.url);
          setSearchQuery('');
          setActiveIndex(-1);
        }
      }
    } else if (e.key === 'Escape') {
      setActiveIndex(-1);
      e.currentTarget.blur();
    }
  };

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery, recordResults]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex === -1 || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const items = container.querySelectorAll('[data-search-item="true"]');
    const activeElement = items[activeIndex] as HTMLElement;
    if (activeElement) {
      activeElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  // Poll for today's calendar events
  useEffect(() => {
    if (!user) return;
    const fetchTodayEvents = async () => {
      try {
        const res = await api.get('/calendar');
        const allEvents = res.data || [];
        const todayStr = new Date().toISOString().split('T')[0];
        const filtered = allEvents.filter((e: any) => {
          if (!e.date) return false;
          const eventDateStr = new Date(e.date).toISOString().split('T')[0];
          return eventDateStr === todayStr && !e.isCompleted;
        });
        setTodayEvents(filtered);
      } catch (err) {
        console.error('Error fetching today events:', err);
      }
    };
    fetchTodayEvents();
    const interval = setInterval(fetchTodayEvents, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Poll for tasks needing review
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      try {
        const res = await api.get('/users/tasks', { params: { limit: '1', label: 'Review' } });
        setReviewCount(res.data.total || 0);
      } catch (err) {
        console.error('Error fetching review tasks count:', err);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000); // refresh every 15 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Load dock visibility preference and listen for Ctrl+H
  useEffect(() => {
    if (pathname === '/team-chat') {
      setShowDock(false);
    } else {
      const stored = localStorage.getItem('advent_crm_show_dock');
      if (stored !== null) {
        setShowDock(stored === 'true');
      } else {
        setShowDock(true);
      }
    }
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl + H (or Cmd + H on macOS)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowDock(prev => {
          const newVal = !prev;
          localStorage.setItem('advent_crm_show_dock', String(newVal));
          return newVal;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global search query effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setRecordResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/dashboard/global-search?q=${encodeURIComponent(searchQuery)}`);
        setRecordResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (!loading && user && requiredRole) {
      const roleHierarchy = { Admin: 3, Manager: 2, Agent: 1 };
      const userLevel = roleHierarchy[user.role] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      if (userLevel < requiredLevel) {
        router.replace('/home');
      }
    }
  }, [user, loading, router, requiredRole]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner spinner-dark" />
      </div>
    );
  }

  if (!user) return null;

  const matchedSections = searchQuery.trim() ? SECTIONS.filter(sec => 
    sec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.keywords.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  return (
    <>
      <Sidebar />
      <div 
        className={`main-layout ${sidebarCollapsed ? 'collapsed' : ''}`}
        style={{ 
          paddingBottom: showDock ? '110px' : '24px',
          transition: 'padding-bottom 0.2s ease-in-out'
        }}
      >
        {children}
      </div>

        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            position: 'fixed',
            bottom: coords ? 'auto' : 24,
            left: coords ? coords.x : '50%',
            top: coords ? coords.y : 'auto',
            opacity: showDock ? 1 : 0,
            pointerEvents: showDock ? 'auto' : 'none',
            transform: coords
              ? (showDock ? 'none' : 'translateY(100px) scale(0.95)')
              : (sidebarCollapsed
                  ? `translateX(calc(-50% + 32px)) ${showDock ? 'translateY(0)' : 'translateY(100px) scale(0.95)'}`
                  : `translateX(calc(-50% + 120px)) ${showDock ? 'translateY(0)' : 'translateY(100px) scale(0.95)'}`),
            transition: isDragging
              ? 'none'
              : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, padding-bottom 0.2s ease-in-out',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: isDragging ? 'none' : 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            padding: '10px 24px',
            borderRadius: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            width: '720px',
            maxWidth: 'calc(100vw - 320px)',
            gap: 20,
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
          {/* Search Container */}
          <div 
            style={{ 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              background: '#f1f5f9', 
              border: '1px solid #e2e8f0', 
              borderRadius: 30, 
              padding: '6px 16px', 
              gap: 10, 
              flex: 1 
            }}
          >
            <Search size={15} color="#64748b" />
            <input 
              type="text" 
              placeholder="Search sections or records..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleInputKeyDown}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#334155', width: '100%' }} 
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}

            {/* Popover Suggestions Overlay */}
            {isFocused && (matchedSections.length > 0 || recordResults.length > 0 || searchLoading) && (
              <div 
                ref={scrollContainerRef}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: 12,
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1), 0 -8px 10px -6px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.05)',
                  maxHeight: 280,
                  overflowY: 'auto',
                  padding: '8px 0',
                  zIndex: 1001,
                  textAlign: 'left'
                }}
              >
                {/* Sections */}
                {matchedSections.length > 0 && (
                  <div>
                    <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sections</div>
                    {matchedSections.map((sec, secIdx) => {
                      const isActive = activeIndex === secIdx;
                      return (
                        <div 
                          key={sec.url} 
                          data-search-item="true"
                          onMouseDown={() => {
                            navigateToSection(sec.url);
                          }}
                          onMouseEnter={() => setActiveIndex(secIdx)}
                          onMouseLeave={() => setActiveIndex(-1)}
                          style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 13,
                            color: '#1e293b',
                            background: isActive ? '#f1f5f9' : 'transparent',
                            transition: 'background 0.2s',
                            borderBottom: '1px solid #f8fafc'
                          }}
                        >
                          <Compass size={14} style={{ color: '#1d4ed8' }} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{sec.name}</div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>Navigate to {sec.name} section</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Records */}
                {recordResults.length > 0 && (
                  <div style={{ marginTop: matchedSections.length > 0 ? 8 : 0 }}>
                    <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Records</div>
                    {recordResults.map((rec, recIdx) => {
                      const globalIdx = matchedSections.length + recIdx;
                      const isActive = activeIndex === globalIdx;
                      return (
                        <div 
                          key={rec.id} 
                          data-search-item="true"
                          onMouseDown={() => {
                            router.push(rec.url);
                            setSearchQuery('');
                          }}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          onMouseLeave={() => setActiveIndex(-1)}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            fontSize: 13,
                            color: '#1e293b',
                            background: isActive ? '#f1f5f9' : 'transparent',
                            transition: 'background 0.2s',
                            borderBottom: '1px solid #f8fafc'
                          }}
                        >
                          <div style={{ 
                            fontSize: 9, 
                            fontWeight: 700, 
                            color: 'white', 
                            background: rec.type === 'Agent' ? '#8b5cf6' : rec.type === 'TSS' ? '#1a1f36' : rec.type === 'Lead' ? '#3b82f6' : rec.type === 'Call' ? '#f59e0b' : rec.type === 'Task' ? '#6366f1' : '#10b981',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginTop: 2
                          }}>
                            {rec.type}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{rec.company}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{rec.callerName}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {searchLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 8 }}>
                    <div className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>Searching database...</span>
                  </div>
                )}

                {!searchLoading && searchQuery.trim() && matchedSections.length === 0 && recordResults.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: 12.5, color: '#64748b' }}>
                    No matching sections or records found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mail, Notifications, Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Critical Icon (Needs Review tasks count) */}
            <button 
              onClick={() => router.push('/tasks?label=Review')}
              style={{ 
                background: reviewCount > 0 ? '#fee2e2' : '#f1f5f9', 
                border: reviewCount > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0', 
                padding: 8, 
                borderRadius: '50%', 
                cursor: 'pointer', 
                display: 'flex', 
                color: reviewCount > 0 ? '#ef4444' : '#64748b',
                position: 'relative',
                transition: 'all 0.2s'
              }} 
              title={`${reviewCount} records need review`}
            >
              <AlertCircle size={15} />
              <span style={{
                position: 'absolute',
                top: -6,
                right: -6,
                background: reviewCount > 0 ? '#ef4444' : '#64748b',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: 9,
                fontWeight: 700,
                boxShadow: reviewCount > 0 ? '0 2px 4px rgba(239, 68, 68, 0.2)' : 'none'
              }}>
                {reviewCount}
              </span>
            </button>


            {/* Notifications Bell */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ 
                  background: todayEvents.length > 0 ? '#eff6ff' : '#f1f5f9', 
                  border: todayEvents.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                  padding: 8, 
                  borderRadius: '50%', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  color: todayEvents.length > 0 ? '#1d4ed8' : '#475569',
                  transition: 'all 0.2s'
                }} 
                title="Today's Events"
              >
                <Bell size={15} />
                {todayEvents.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: '#1d4ed8',
                    color: 'white',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(29, 78, 216, 0.2)'
                  }}>
                    {todayEvents.length}
                  </span>
                )}
              </button>

              {/* Notifications Popover Overlay */}
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 12,
                  width: 280,
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1), 0 -8px 10px -6px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.05)',
                  padding: '12px 16px',
                  zIndex: 1002,
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1f36' }}>Today's Schedule</span>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {todayEvents.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', padding: '12px 0' }}>
                        No events scheduled for today
                      </div>
                    ) : (
                      todayEvents.map(ev => {
                        const colors = {
                          'Work-Order': '#ef4444',
                          'Move-In': '#059669',
                          'Move-Out': '#7c3aed',
                          'Note': '#ea580c',
                          'Reminder': '#0284c7'
                        };
                        const typeColor = colors[ev.type as keyof typeof colors] || '#64748b';
                        return (
                          <div 
                            key={ev._id}
                            onClick={() => {
                              router.push('/calendar');
                              setShowNotifications(false);
                            }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8, 
                              padding: '6px 8px', 
                              borderRadius: 8, 
                              cursor: 'pointer', 
                              transition: 'background 0.2s',
                              border: '1px solid #f1f5f9'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'ellipsis', overflowX: 'hidden' }}>{ev.title}</div>
                              <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1 }}>{ev.type} {ev.time ? `· ${ev.time}` : ''}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
              {user?.email === 'jayanthramnithin@gmail.com' ? (
                <img
                  src="/WhatsApp Image 2026-07-06 at 9.53.29 AM.jpeg"
                  alt="Avatar"
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
                />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1a1f36, #2d3561)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>
                  {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('') : 'M'}
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{user?.name || 'Totok Michael'}</div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>{user?.role || 'Admin'}</div>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}
