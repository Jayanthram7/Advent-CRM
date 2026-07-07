'use client';
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, ChevronRight, Plus, Calendar, Briefcase, 
  ArrowDownLeft, ArrowUpRight, FileText, Bell, Trash2, X, CheckSquare, Clock 
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isSameDay } from 'date-fns';

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type: 'Work-Order' | 'Move-In' | 'Move-Out' | 'Note' | 'Reminder';
  assignedTo?: string;
  isCompleted?: boolean;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    type: 'Note' as 'Work-Order' | 'Move-In' | 'Move-Out' | 'Note' | 'Reminder'
  });
  
  const [reminderForm, setReminderForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00'
  });

  // Filter states
  const [filters, setFilters] = useState({
    'Work-Order': true,
    'Move-In': true,
    'Move-Out': true,
    'Note': true,
    'Reminder': true
  });

  // View state: 'day' | 'week' | 'month' (default to 'month')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');

  // Fetch events
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/calendar');
      setEvents(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Grid dates generator
  const getGridDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Get preceding padding days (Mon starts week: getDay returns 0 for Sun, 1 for Mon... 6 for Sat)
    // We want Mon as index 0, so we adjust offset: (day.getDay() + 6) % 7
    const firstDayIndex = (getDay(start) + 6) % 7;
    const paddingStart: Date[] = [];
    for (let i = firstDayIndex; i > 0; i--) {
      const prevDate = new Date(start);
      prevDate.setDate(start.getDate() - i);
      paddingStart.push(prevDate);
    }

    // Get trailing padding days to fill 42 cells grid
    const totalCells = 42;
    const remaining = totalCells - (paddingStart.length + days.length);
    const paddingEnd: Date[] = [];
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(end);
      nextDate.setDate(end.getDate() + i);
      paddingEnd.push(nextDate);
    }

    return [...paddingStart, ...days, ...paddingEnd];
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Create Event Submit
  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    try {
      await api.post('/calendar', eventForm);
      toast.success('Event added successfully!');
      setShowAddEvent(false);
      setEventForm({
        title: '',
        description: '',
        date: format(currentDate, 'yyyy-MM-dd'),
        time: '10:00',
        type: 'Note'
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save event');
    }
  };

  // Create Reminder Submit
  const handleAddReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderForm.title.trim()) {
      toast.error('Please enter a reminder title');
      return;
    }
    try {
      await api.post('/calendar', {
        title: reminderForm.title,
        date: reminderForm.date,
        time: reminderForm.time,
        type: 'Reminder'
      });
      toast.success('Reminder set successfully!');
      setReminderForm({
        title: '',
        date: format(currentDate, 'yyyy-MM-dd'),
        time: '09:00'
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to set reminder');
    }
  };

  // Toggle reminder status
  const toggleReminderCompletion = async (id: string, currentVal: boolean) => {
    try {
      await api.put(`/calendar/${id}`, { isCompleted: !currentVal });
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update reminder');
    }
  };

  // Delete event
  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/calendar/${id}`);
      toast.success('Event deleted');
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event');
    }
  };

  const gridDays = getGridDays();
  const activeReminders = events.filter(e => e.type === 'Reminder');

  // Type rendering styles
  const TYPE_STYLES = {
    'Work-Order': { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5', icon: <Briefcase size={11} /> },
    'Move-In': { bg: '#d1fae5', text: '#059669', border: '#6ee7b7', icon: <ArrowDownLeft size={11} /> },
    'Move-Out': { bg: '#f3e8ff', text: '#7c3aed', border: '#c084fc', icon: <ArrowUpRight size={11} /> },
    'Note': { bg: '#ffedd5', text: '#ea580c', border: '#fdbb2d', icon: <Calendar size={11} /> },
    'Reminder': { bg: '#e0f2fe', text: '#0284c7', border: '#7dd3fc', icon: <Bell size={11} /> }
  };

  return (
    <ProtectedLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        
        {/* Top Navbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Calendar size={24} style={{ color: '#1a1f36' }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Calendar & Notes</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* View selectors */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              {(['day', 'week', 'month'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    background: viewMode === mode ? '#1a1f36' : 'transparent',
                    color: viewMode === mode ? 'white' : '#64748b',
                    boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowReminders(true)}
              style={{
                background: 'white',
                color: '#1a1f36',
                border: '1px solid #1a1f36',
                padding: '8px 16px',
                borderRadius: 30,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Bell size={15} /> Reminders ({activeReminders.filter(r => !r.isCompleted).length})
            </button>

            <button
              onClick={() => setShowAddEvent(true)}
              style={{
                background: '#ff7a59',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 30,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Plus size={16} /> Add Event
            </button>
          </div>
        </div>

        {/* Main Section */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Left Column Filters */}
          <div style={{ width: 240, borderRight: '1px solid #e2e8f0', background: 'white', padding: 20, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, textAlign: 'left' }}>Next Events</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events
                  .filter(e => e.type !== 'Reminder' || !e.isCompleted)
                  .filter(e => {
                    if (!e.date) return false;
                    const eventDate = new Date(e.date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return eventDate >= today;
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5)
                  .map(ev => {
                    const style = TYPE_STYLES[ev.type] || TYPE_STYLES['Note'];
                    return (
                      <div
                        key={ev._id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 12,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          textAlign: 'left'
                        }}
                      >
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: style.bg,
                          color: style.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1
                        }}>
                          {style.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} />
                            <span>
                              {format(new Date(ev.date), 'MMM dd')} {ev.time ? `at ${ev.time}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {events.filter(e => e.type !== 'Reminder' || !e.isCompleted).filter(e => {
                  if (!e.date) return false;
                  const eventDate = new Date(e.date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return eventDate >= today;
                }).length === 0 && (
                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                    No upcoming events
                  </div>
                )}
              </div>
            </div>

            {/* Mini Calendar Picker */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1f36' }}>{format(currentDate, 'MMMM yyyy')}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b' }}><ChevronLeft size={14} /></button>
                  <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b' }}><ChevronRight size={14} /></button>
                </div>
              </div>
              
              {/* Mini Calendar Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 10, textAlign: 'center' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                  <div key={idx} style={{ fontWeight: 700, color: '#94a3b8', paddingBottom: 4 }}>{day}</div>
                ))}
                {gridDays.slice(0, 35).map((dateVal, idx) => {
                  const isCurrentMonth = dateVal.getMonth() === currentDate.getMonth();
                  const isDayToday = isToday(dateVal);
                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentDate(dateVal)}
                      style={{
                        padding: '4px 0',
                        cursor: 'pointer',
                        borderRadius: '50%',
                        fontSize: 10,
                        fontWeight: isCurrentMonth ? 600 : 400,
                        color: isDayToday ? 'white' : (isCurrentMonth ? '#334155' : '#cbd5e1'),
                        background: isDayToday ? '#1a1f36' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 20,
                        width: 20,
                        margin: '0 auto'
                      }}
                    >
                      {dateVal.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column Calendar Grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Header with Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {format(currentDate, 'MMMM yyyy')}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={handlePrevMonth} 
                  style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={handleNextMonth} 
                  style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Grid Container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Day Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '10px 0' }}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => (
                  <div key={idx} style={{ paddingLeft: 12, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day}</div>
                ))}
              </div>

              {/* Grid Cells */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', background: '#e2e8f0', gap: '1px', overflowY: 'auto' }}>
                {gridDays.map((dateVal, idx) => {
                  const isCurrentMonth = dateVal.getMonth() === currentDate.getMonth();
                  const isDayToday = isToday(dateVal);
                  
                  // Filter events on this day
                  const dayEvents = events.filter(e => {
                    if (!e.date) return false;
                    const eventDate = new Date(e.date);
                    return isSameDay(eventDate, dateVal) && filters[e.type];
                  });

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isCurrentMonth ? 'white' : '#f8fafc',
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        minHeight: 80,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      {/* Day Number */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isDayToday ? 'white' : (isCurrentMonth ? '#0f172a' : '#cbd5e1'),
                          background: isDayToday ? 'black' : 'transparent',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {dateVal.getDate()}
                        </span>
                      </div>

                      {/* Event Cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1, paddingBottom: 4 }}>
                        {dayEvents.map(ev => {
                          const style = TYPE_STYLES[ev.type] || TYPE_STYLES['Note'];
                          return (
                            <div
                              key={ev._id}
                              style={{
                                background: style.bg,
                                color: style.text,
                                border: `1px solid ${style.border}`,
                                padding: '3px 6px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s'
                              }}
                              title={ev.description || ev.title}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {style.icon}
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {ev.time ? `[${ev.time}] ` : ''}{ev.title}
                                </span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev._id); }}
                                style={{ background: 'none', border: 'none', color: style.text, cursor: 'pointer', padding: 0, marginLeft: 4, display: 'flex' }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Add Event */}
        {showAddEvent && (
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowAddEvent(false)}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <h2 className="modal-title">Add Calendar Event</h2>
                <button onClick={() => setShowAddEvent(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
              </div>
              
              <form onSubmit={handleAddEventSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Event Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={eventForm.title}
                      onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Meeting, Work Order, etc."
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={eventForm.date}
                        onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={eventForm.time}
                        onChange={e => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                  </div>



                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      value={eventForm.description}
                      onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add details..."
                      rows={3}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddEvent(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ background: '#ff7a59' }}>Add Event</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reminders */}
        {showReminders && (
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowReminders(false)}>
            <div className="modal" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={20} /> Reminders Manager
                </h2>
                <button onClick={() => setShowReminders(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
              </div>

              <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                
                {/* Create Quick Reminder */}
                <form onSubmit={handleAddReminderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1f36' }}>Set New Reminder</div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Reminder title..."
                    value={reminderForm.title}
                    onChange={e => setReminderForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      type="date"
                      className="form-input"
                      value={reminderForm.date}
                      onChange={e => setReminderForm(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                    <input
                      type="time"
                      className="form-input"
                      value={reminderForm.time}
                      onChange={e => setReminderForm(prev => ({ ...prev, time: e.target.value }))}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', padding: '6px 16px', fontSize: 12 }}>
                    Create
                  </button>
                </form>

                {/* Reminder Lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36' }}>Pending Reminders</div>
                  {activeReminders.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '16px 0' }}>No reminders set</div>
                  ) : (
                    activeReminders.map(rem => (
                      <div 
                        key={rem._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: rem.isCompleted ? '#f1f5f9' : 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          opacity: rem.isCompleted ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }}>
                          <input 
                            type="checkbox"
                            checked={!!rem.isCompleted}
                            onChange={() => toggleReminderCompletion(rem._id, !!rem.isCompleted)}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: rem.isCompleted ? '#64748b' : '#0f172a', textDecoration: rem.isCompleted ? 'line-through' : 'none' }}>
                              {rem.title}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Clock size={11} /> {format(new Date(rem.date), 'MMM dd')} at {rem.time || '—'}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteEvent(rem._id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </ProtectedLayout>
  );
}
