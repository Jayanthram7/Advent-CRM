'use client';
import { useState, useEffect, useRef } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Search, Hash, FileText, AtSign, Paperclip, Plus, Send, 
  MessageSquare, User, MoreVertical, Settings, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

interface ChatUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string;
  };
  receiver: {
    _id: string;
    name: string;
    email: string;
  };
  content: string;
  createdAt: string;
}

export default function TeamChatPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch users list
  const fetchUsers = async (showLoading = true) => {
    if (showLoading) setUsersLoading(true);
    try {
      const res = await api.get('/team-chat/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load chat users', err);
    } finally {
      if (showLoading) setUsersLoading(false);
    }
  };

  // Fetch chat history
  const fetchHistory = async (otherUserId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const res = await api.get(`/team-chat/history/${otherUserId}`);
      setMessages(res.data || []);
      // Mark as read
      await api.post(`/team-chat/read/${otherUserId}`);
      // Refresh user list unread counts silently
      fetchUsers(false);
    } catch (err) {
      console.error('Failed to load chat history', err);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, []);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchUsers(false);
      if (selectedUser) {
        fetchHistory(selectedUser._id, true);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectUser = (u: ChatUser) => {
    setSelectedUser(u);
    fetchHistory(u._id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');

    try {
      const res = await api.post('/team-chat/send', {
        receiverId: selectedUser._id,
        content: textToSend
      });
      setMessages(prev => [...prev, res.data]);
      fetchUsers(false);
    } catch (err) {
      toast.error('Failed to send message');
      setInputText(textToSend); // Restore
    }
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach(m => {
      const dateStr = format(new Date(m.createdAt), 'EEEE, MMMM do');
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(m);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  // Filter users by search query
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserColor = (id: string) => {
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const index = id.charCodeAt(id.length - 1) % colors.length;
    return colors[index];
  };

  return (
    <ProtectedLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: '#fcfcfd', overflow: 'hidden' }}>
        
        <TopBar title="Team Chat">
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '7px 12px 7px 36px', fontSize: 13,
                border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
                background: '#f8fafc'
              }}
            />
          </div>
        </TopBar>

        {/* Main Work Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Left panel: Slack/Teams-like Sidebar */}
          <div style={{
            width: 280, borderRight: '1px solid #f1f5f9', background: '#ffffff',
            display: 'flex', flexDirection: 'column', padding: '16px 0'
          }}>
            
            {/* New Message Button */}
            <div style={{ padding: '0 16px 16px' }}>
              <button
                onClick={() => {
                  if (filteredUsers.length > 0) {
                    handleSelectUser(filteredUsers[0]);
                  }
                }}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 10,
                  background: '#0f172a', color: 'white', border: 'none',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)', transition: 'all 0.2s'
                }}
              >
                <Plus size={16} /> New Message
              </button>
            </div>

            {/* Standard Nav Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px 16px' }}>
              {[
                { label: 'Channels', icon: <Hash size={16} /> },
                { label: 'Drafts', icon: <FileText size={16} /> },
                { label: 'Mentions', icon: <AtSign size={16} /> },
                { label: 'Files & Media', icon: <Paperclip size={16} /> }
              ].map(item => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 8, fontSize: 13.5, color: '#475569', fontWeight: 500,
                    cursor: 'default', opacity: 0.75
                  }}
                >
                  <span style={{ color: '#64748b' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '0 16px 16px' }} />

            {/* Direct Messages List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ 
                padding: '0 20px 8px', fontSize: 11, fontWeight: 700, 
                color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' 
              }}>
                Direct Messages
              </div>

              {usersLoading && users.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Loading team members...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No members found
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
                  {filteredUsers.map(u => {
                    const isSelected = selectedUser?._id === u._id;
                    const initials = getInitials(u.name);
                    const color = getUserColor(u._id);

                    return (
                      <div
                        key={u._id}
                        onClick={() => handleSelectUser(u)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                          background: isSelected ? '#f1f5f9' : 'transparent',
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: `${color}15`,
                            color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700
                          }}>
                            {initials}
                          </div>
                          <span style={{
                            position: 'absolute', right: 0, bottom: 0, width: 8, height: 8,
                            borderRadius: '50%', background: '#10b981', border: '1.5px solid white'
                          }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ 
                            fontSize: 13.5, fontWeight: isSelected ? 600 : 500, 
                            color: isSelected ? '#0f172a' : '#1e293b',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.name}
                            </span>
                            {u.unreadCount && u.unreadCount > 0 ? (
                              <span style={{
                                background: '#3b82f6', color: 'white', fontSize: 10, fontWeight: 700,
                                borderRadius: '50%', minWidth: 16, height: 16, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', padding: '0 4px'
                              }}>
                                {u.unreadCount}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ 
                            fontSize: 11, color: '#94a3b8', marginTop: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
                          }}>
                            {u.lastMessage || u.role}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right panel: Chat Screen */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            
            {selectedUser ? (
              <>
                {/* Chat Panel Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', 
                      background: `${getUserColor(selectedUser._id)}15`,
                      color: getUserColor(selectedUser._id), display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700
                    }}>
                      {getInitials(selectedUser.name)}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Chat with {selectedUser.name}
                      </h3>
                      <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                        {selectedUser.role} • Active now
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94a3b8' }}><Settings size={18} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94a3b8' }}><MoreVertical size={18} /></button>
                  </div>
                </div>

                {/* Messages View Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                  {messagesLoading && messages.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <div className="spinner spinner-dark" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      
                      {Object.keys(messageGroups).map(dateStr => (
                        <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          
                          {/* Date separator */}
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: '#64748b',
                              background: '#e2e8f0', borderRadius: 20, padding: '4px 12px'
                            }}>
                              {dateStr}
                            </span>
                          </div>

                          {/* Messages under this date */}
                          {messageGroups[dateStr].map(m => {
                            const isMe = m.sender._id === user?.id;
                            const timeStr = format(new Date(m.createdAt), 'hh:mm a');

                            return (
                              <div
                                key={m._id}
                                style={{
                                  display: 'flex',
                                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                                  width: '100%',
                                  gap: 10
                                }}
                              >
                                {/* Left Avatar for received messages */}
                                {!isMe && (
                                  <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: `${getUserColor(m.sender._id)}15`,
                                    color: getUserColor(m.sender._id),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 700, flexShrink: 0
                                  }}>
                                    {getInitials(m.sender.name)}
                                  </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '65%' }}>
                                  
                                  {/* Bubble content */}
                                  <div style={{
                                    padding: '12px 16px',
                                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                    background: isMe ? '#fef08a' : '#e0e7ff', // Beige/yellow for me, light purple/lavender for others
                                    color: '#1e293b',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    textAlign: 'left',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                  }}>
                                    {m.content}
                                  </div>

                                  {/* Sender name + time footer */}
                                  <div style={{ 
                                    fontSize: 10, color: '#94a3b8', 
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    display: 'flex', gap: 6
                                  }}>
                                    {!isMe && <strong style={{ color: '#64748b' }}>{m.sender.name}</strong>}
                                    <span>{timeStr}</span>
                                  </div>

                                </div>

                              </div>
                            );
                          })}

                        </div>
                      ))}

                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Input Controls Bar at Bottom */}
                <form onSubmit={handleSendMessage} style={{
                  padding: '20px 32px', background: '#ffffff', borderTop: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <button
                    type="button"
                    style={{
                      background: '#f1f5f9', border: 'none', borderRadius: '50%',
                      width: 36, height: 36, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#64748b', cursor: 'pointer'
                    }}
                  >
                    <Plus size={18} />
                  </button>

                  <input
                    type="text"
                    placeholder={`Message ${selectedUser.name}...`}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{
                      flex: 1, padding: '10px 16px', border: '1px solid #e2e8f0',
                      borderRadius: 24, fontSize: 13.5, outline: 'none', background: '#f8fafc'
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    style={{
                      background: inputText.trim() ? '#0f172a' : '#cbd5e1',
                      color: 'white', border: 'none', borderRadius: '50%',
                      width: 36, height: 36, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#64748b'
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#3b82f6', marginBottom: 16
                }}>
                  <MessageSquare size={28} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                  No Chat Selected
                </h3>
                <p style={{ fontSize: 13.5, color: '#64748b', margin: 0, maxWidth: 280, textAlign: 'center' }}>
                  Select a team member from the Direct Messages sidebar to start chatting.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    </ProtectedLayout>
  );
}
