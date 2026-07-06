'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Search, X, Plus, Trash2, Users, Send, CheckCircle, AlertTriangle, FileText, Edit2
} from 'lucide-react';

interface Contact {
  name: string;
  email: string;
  phone?: string;
  source: string;
}

interface Template {
  _id: string;
  name: string;
  subject: string;
  body: string;
}

export default function SendEmailsPage() {
  // State for contacts
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);

  // State for TSS filtering
  const [tssLabelFilter, setTssLabelFilter] = useState('All');
  const [tssDateField, setTssDateField] = useState('renewalDate');
  const [tssDateRange, setTssDateRange] = useState('All');
  const [tssStartDate, setTssStartDate] = useState('');
  const [tssEndDate, setTssEndDate] = useState('');

  const LABEL_OPTIONS = ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Lead', 'Cold Lead', 'Review', 'Completed', 'Closed'];

  // State for templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // State for composing email
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Sending progress state
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [sendReport, setSendReport] = useState<{ success: number; fail: number; failures: any[] } | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/emails/templates');
      setTemplates(res.data);
    } catch (err) {
      toast.error('Failed to load email templates');
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Debounced contact search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/emails/contacts', { params: { search: searchQuery } });
        setSearchResults(res.data);
      } catch (err) {
        console.error('Error searching contacts');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Handle template selection change
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (!id) {
      setSubject('');
      setBody('');
      return;
    }
    const selected = templates.find(t => t._id === id);
    if (selected) {
      setSubject(selected.subject);
      setBody(selected.body);
    }
  };

  // Add recipient
  const addRecipient = (contact: Contact) => {
    if (selectedRecipients.some(r => r.email.toLowerCase().trim() === contact.email.toLowerCase().trim())) {
      toast.error('Recipient already added');
      return;
    }
    setSelectedRecipients([...selectedRecipients, contact]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Add all search results
  const addAllSearchResults = () => {
    const newRecipients = [...selectedRecipients];
    let addedCount = 0;
    searchResults.forEach(contact => {
      if (!newRecipients.some(r => r.email.toLowerCase().trim() === contact.email.toLowerCase().trim())) {
        newRecipients.push(contact);
        addedCount++;
      }
    });
    setSelectedRecipients(newRecipients);
    setSearchQuery('');
    setSearchResults([]);
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} recipients`);
    } else {
      toast.error('All search results were already added');
    }
  };

  // Remove recipient
  const removeRecipient = (email: string) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.email !== email));
  };

  // Save template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !subject.trim() || !body.trim()) {
      toast.error('Template name, subject, and body are required');
      return;
    }
    setSavingTemplate(true);
    try {
      const isEdit = !!selectedTemplateId;
      const res = await api.post('/emails/templates', {
        id: isEdit ? selectedTemplateId : undefined,
        name: templateName.trim(),
        subject: subject.trim(),
        body: body.trim()
      });
      toast.success(isEdit ? 'Template updated!' : 'Template created!');
      setIsTemplateModalOpen(false);
      setTemplateName('');
      await fetchTemplates();
      if (!isEdit) {
        setSelectedTemplateId(res.data._id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/emails/templates/${selectedTemplateId}`);
      toast.success('Template deleted');
      setSelectedTemplateId('');
      setSubject('');
      setBody('');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  // Trigger broadcast sending
  const handleSendBroadcast = async () => {
    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }
    if (!confirm(`Are you sure you want to send this broadcast to ${selectedRecipients.length} recipients?`)) return;

    setSending(true);
    setSendReport(null);
    setSendProgress({ current: 0, total: selectedRecipients.length });

    try {
      // Direct call to send API. The backend handles loop and delays.
      // We can mock visual progress on the client-side for smoother feedback,
      // or send them sequentially from the frontend for active progress.
      // Sequential frontend dispatch gives the user a REAL progress bar!
      // Let's implement sequential sending from the frontend so the progress bar updates live!
      let successCount = 0;
      let failCount = 0;
      const failuresList: any[] = [];

      for (let i = 0; i < selectedRecipients.length; i++) {
        const recipient = selectedRecipients[i];
        setSendProgress({ current: i + 1, total: selectedRecipients.length });
        
        try {
          await api.post('/emails/send', {
            recipients: [recipient],
            subject,
            body
          });
          successCount++;
        } catch (err: any) {
          failuresList.push({
            name: recipient.name,
            email: recipient.email,
            error: err.response?.data?.message || 'Failed to send'
          });
          failCount++;
        }
        
        // 200ms delay between API calls to prevent rapid firing
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setSendReport({
        success: successCount,
        fail: failCount,
        failures: failuresList
      });

      if (failCount === 0) {
        toast.success(`Broadcast sent successfully to all ${successCount} recipients!`);
        setSelectedRecipients([]);
      } else {
        toast.error(`Broadcast completed. ${successCount} sent, ${failCount} failed.`);
      }
    } catch (err) {
      toast.error('Error sending broadcast');
    } finally {
      setSending(false);
    }
  };

  // Helper: fetch filtered TSS contacts
  const getFilteredTssContacts = async (params: any) => {
    try {
      const res = await api.get('/emails/contacts/tss', { params });
      return res.data as Contact[];
    } catch (err) {
      console.error('Error fetching TSS contacts:', err);
      toast.error('Failed to load TSS contacts');
      return [];
    }
  };

  // Helper: add multiple contacts with duplicate checks
  const addBulkRecipients = (contacts: Contact[]) => {
    if (contacts.length === 0) {
      toast.error('No contacts found matching the criteria');
      return;
    }
    const newRecipients = [...selectedRecipients];
    let addedCount = 0;
    contacts.forEach(contact => {
      if (!newRecipients.some(r => r.email.toLowerCase().trim() === contact.email.toLowerCase().trim())) {
        newRecipients.push(contact);
        addedCount++;
      }
    });
    setSelectedRecipients(newRecipients);
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} TSS recipients`);
    } else {
      toast.success('All matching contacts are already in the list');
    }
  };

  // Action: Add All TSS
  const addAllTss = async () => {
    const contacts = await getFilteredTssContacts({ label: 'All', dateField: '', startDate: '', endDate: '' });
    addBulkRecipients(contacts);
  };

  // Action: Add This Month TSS
  const addThisMonthTss = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    
    const contacts = await getFilteredTssContacts({
      label: 'All',
      dateField: 'renewalDate',
      startDate: startOfMonth,
      endDate: endOfMonth
    });
    addBulkRecipients(contacts);
  };

  // Action: Add Filtered TSS
  const addFilteredTss = async () => {
    let start = '';
    let end = '';
    
    if (tssDateRange === 'ThisMonth') {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    } else if (tssDateRange === 'Today') {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    } else if (tssDateRange === 'Custom') {
      if (!tssStartDate || !tssEndDate) {
        toast.error('Please specify start and end dates');
        return;
      }
      start = new Date(tssStartDate).toISOString();
      const endDateObj = new Date(tssEndDate);
      endDateObj.setHours(23, 59, 59, 999);
      end = endDateObj.toISOString();
    }
    
    const contacts = await getFilteredTssContacts({
      label: tssLabelFilter,
      dateField: tssDateRange !== 'All' ? tssDateField : '',
      startDate: start,
      endDate: end
    });
    addBulkRecipients(contacts);
  };

  const openSaveModal = () => {
    if (selectedTemplateId) {
      const current = templates.find(t => t._id === selectedTemplateId);
      setTemplateName(current?.name || '');
    } else {
      setTemplateName('');
    }
    setIsTemplateModalOpen(true);
  };

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="Send Emails" onRefresh={fetchTemplates} />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
        {/* Left Column: Recipients Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Recipient Picker Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} style={{ color: '#1a73e8' }} /> Select Recipients
            </h3>
            
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="Search leads, quiz users, events, or tss by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={sending}
              />
            </div>

            {/* Search Results dropdown */}
            {searchQuery.trim().length >= 2 && (
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                maxHeight: 220,
                overflowY: 'auto',
                background: 'white',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}>
                {searching ? (
                  <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Searching contacts...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No matching contacts found.</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Search Results ({searchResults.length})</span>
                      <button 
                        onClick={addAllSearchResults}
                        style={{ background: 'none', border: 'none', color: '#1a73e8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Add All
                      </button>
                    </div>
                    {searchResults.map((contact, idx) => (
                      <div
                        key={idx}
                        onClick={() => addRecipient(contact)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background 0.15s'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#f0f5ff'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{contact.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{contact.email}</div>
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 
                            contact.source === 'Lead' ? '#e0f2fe' : 
                            contact.source === 'Quiz User' ? '#f3e8ff' : 
                            contact.source === 'Event' ? '#ffedd5' : '#dcfce7',
                          color: 
                            contact.source === 'Lead' ? '#0369a1' : 
                            contact.source === 'Quiz User' ? '#6b21a8' : 
                            contact.source === 'Event' ? '#c2410c' : '#15803d'
                        }}>
                          {contact.source}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TSS Bulk Add Section */}
            <div style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} style={{ color: '#1a73e8' }} /> Add TSS Contacts in Bulk
              </div>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', borderRadius: 6 }}
                  onClick={addAllTss}
                  disabled={sending}
                >
                  All TSS
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', borderRadius: 6 }}
                  onClick={addThisMonthTss}
                  disabled={sending}
                >
                  This Month's TSS
                </button>
              </div>

              {/* Advanced Filters */}
              <details style={{ fontSize: 12, borderTop: '1px solid #cbd5e1', paddingTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: '#1a73e8', fontWeight: 600, outline: 'none', userSelect: 'none' }}>
                  Filter TSS by label & date
                </summary>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>TSS Label</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: 12, background: 'white', width: '100%' }}
                      value={tssLabelFilter}
                      onChange={e => setTssLabelFilter(e.target.value)}
                    >
                      <option value="All">All Labels</option>
                      {LABEL_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Date Field</label>
                      <select
                        className="form-input"
                        style={{ padding: '6px 8px', fontSize: 12, background: 'white', width: '100%' }}
                        value={tssDateField}
                        onChange={e => setTssDateField(e.target.value)}
                      >
                        <option value="renewalDate">Renewal Date</option>
                        <option value="followUpDate">Follow Up Date</option>
                        <option value="callbackDate">Callback Date</option>
                        <option value="createdAt">Created Date</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Date Range</label>
                      <select
                        className="form-input"
                        style={{ padding: '6px 8px', fontSize: 12, background: 'white', width: '100%' }}
                        value={tssDateRange}
                        onChange={e => setTssDateRange(e.target.value)}
                      >
                        <option value="All">All Time</option>
                        <option value="ThisMonth">This Month</option>
                        <option value="Today">Today</option>
                        <option value="Custom">Custom Range</option>
                      </select>
                    </div>
                  </div>

                  {tssDateRange === 'Custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 2 }}>Start Date</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ padding: '4px 6px', fontSize: 12, background: 'white', width: '100%' }}
                          value={tssStartDate}
                          onChange={e => setTssStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 2 }}>End Date</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ padding: '4px 6px', fontSize: 12, background: 'white', width: '100%' }}
                          value={tssEndDate}
                          onChange={e => setTssEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12, width: '100%', marginTop: 4, cursor: 'pointer' }}
                    onClick={addFilteredTss}
                    disabled={sending}
                  >
                    Add Filtered TSS Contacts
                  </button>
                </div>
              </details>
            </div>

            {/* Selection Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                Selected Recipients ({selectedRecipients.length})
              </span>
              {selectedRecipients.length > 0 && (
                <button
                  onClick={() => setSelectedRecipients([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  disabled={sending}
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Selected Recipient Pills Container */}
            <div style={{
              maxHeight: 350,
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignContent: 'flex-start',
              minHeight: 100,
              padding: 12,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px dashed #e2e8f0'
            }}>
              {selectedRecipients.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#94a3b8', fontSize: 13, flexDirection: 'column', gap: 6 }}>
                  No recipients selected. Search and click contacts above to add them to the broadcast list.
                </div>
              ) : (
                selectedRecipients.map((recipient) => (
                  <div
                    key={recipient.email}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: 20,
                      padding: '4px 10px',
                      fontSize: 12,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#334155' }}>{recipient.name}</span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>({recipient.email})</span>
                    <button
                      onClick={() => removeRecipient(recipient.email)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                      onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                      disabled={sending}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Sending Progress Card */}
          {sending && (
            <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>Sending Broadcast Progress</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>{sendProgress.current} / {sendProgress.total}</span>
              </div>
              
              {/* Progress Bar Container */}
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, height: 8, width: '100%', overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)',
                  height: '100%',
                  width: `${(sendProgress.current / sendProgress.total) * 100}%`,
                  transition: 'width 0.2s ease-out'
                }} />
              </div>
              
              <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="spinner" style={{ width: 12, height: 12, borderColor: '#38bdf8 transparent #38bdf8 transparent' }} />
                Pacing broadcast delivery sequentially to prevent Gmail rate limits...
              </div>
            </div>
          )}

          {/* Delivery Report Card */}
          {sendReport && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                Broadcast Summary Report
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'center' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#16a34a', fontSize: 20, fontWeight: 700 }}>{sendReport.success}</div>
                  <div style={{ color: '#15803d', fontSize: 12, fontWeight: 500 }}>Sent Successfully</div>
                </div>
                <div style={{ background: sendReport.fail > 0 ? '#fef2f2' : '#f8fafc', border: sendReport.fail > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: sendReport.fail > 0 ? '#dc2626' : '#64748b', fontSize: 20, fontWeight: 700 }}>{sendReport.fail}</div>
                  <div style={{ color: sendReport.fail > 0 ? '#b91c1c' : '#64748b', fontSize: 12, fontWeight: 500 }}>Failed</div>
                </div>
              </div>

              {sendReport.failures.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={14} /> Failed Deliveries:
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', background: '#fff5f5' }}>
                    {sendReport.failures.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#b91c1c', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{f.name}</strong> ({f.email})</span>
                        <span>{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Templates + Composition */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header & Templates selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={18} style={{ color: '#1a73e8' }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>Template Selection</h3>
            </div>
            
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ width: 180, height: 36, padding: '6px 12px', fontSize: 13 }}
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                disabled={sending}
              >
                <option value="">-- Custom Email --</option>
                {templates.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              
              {selectedTemplateId && (
                <button
                  onClick={handleDeleteTemplate}
                  className="btn-danger"
                  style={{ padding: '6px 8px', borderRadius: 6, display: 'inline-flex', cursor: 'pointer' }}
                  title="Delete Template"
                  disabled={sending}
                >
                  <Trash2 size={13} />
                </button>
              )}
              
              <button
                onClick={openSaveModal}
                className="btn-secondary"
                style={{ padding: '6px 12px', background: 'white', borderRadius: 6, display: 'inline-flex', cursor: 'pointer', fontSize: 13 }}
                disabled={sending}
              >
                {selectedTemplateId ? <><Edit2 size={13} /> Edit Template</> : <><Plus size={13} /> Save Template</>}
              </button>
            </div>
          </div>

          {/* Composition Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email Subject</label>
              <input
                className="form-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Welcome to Advent Systems!"
                disabled={sending}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Email Body (HTML Supported)</label>
                <span style={{ fontSize: 11, color: '#1a73e8', fontWeight: 500 }}>
                  Tip: Use <code>{"{{name}}"}</code> to personalize
                </span>
              </div>
              <textarea
                className="form-input"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="<h3>Dear {{name}},</h3><p>Write your email body here...</p>"
                rows={14}
                style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                disabled={sending}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 10 }}>
            <button
              onClick={handleSendBroadcast}
              className="btn-primary"
              style={{
                background: sending || selectedRecipients.length === 0 ? '#94a3b8' : '#1a73e8',
                cursor: sending || selectedRecipients.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                padding: '10px 24px',
                borderRadius: 8
              }}
              disabled={sending || selectedRecipients.length === 0}
            >
              <Send size={15} /> Send Broadcast to {selectedRecipients.length} Recipient(s)
            </button>
          </div>
        </div>
      </div>

      {/* Save/Edit Template Modal */}
      {isTemplateModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsTemplateModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedTemplateId ? 'Edit Email Template' : 'Create Email Template'}</h2>
              <button onClick={() => setIsTemplateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveTemplate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Template Name</label>
                  <input
                    className="form-input"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Welcome Broadcast"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingTemplate}>
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
