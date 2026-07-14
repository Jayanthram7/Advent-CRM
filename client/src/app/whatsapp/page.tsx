'use client';
import { useState, useEffect, useRef } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Settings, FileText, MessageSquare, Send, Bot, Play, Check, Copy, Sparkles,
  ToggleLeft, ToggleRight, Eye, RefreshCw, AlertTriangle, User, ShieldAlert
} from 'lucide-react';

interface ChatSession {
  _id: string; // phone number
  lastMessage: string;
  lastSender: string;
  lastTimestamp: string;
  count: number;
}

interface ChatMessage {
  _id: string;
  phoneNumber: string;
  sender: 'User' | 'AI' | 'System';
  message: string;
  createdAt: string;
}

export default function WhatsappPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'context' | 'chats'>('settings');
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [provider, setProvider] = useState<'twilio' | 'meta'>('twilio');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('advent_verify_token');
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('');

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.1-flash-lite');
  const [context, setContext] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Compression Preview State
  const [showCompressionPreview, setShowCompressionPreview] = useState(false);
  const [compressedTextPreview, setCompressedTextPreview] = useState('');

  // Chats State
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Simulator State
  const [simulatorPhone, setSimulatorPhone] = useState('+15550100');
  const [simulatorInput, setSimulatorInput] = useState('');
  const [simulatorSending, setSimulatorSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch all settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/whatsapp/settings');
      if (res.data) {
        setProvider(res.data.provider || 'twilio');
        setMetaPhoneNumberId(res.data.metaPhoneNumberId || '');
        setMetaAccessToken(res.data.metaAccessToken || '');
        setMetaVerifyToken(res.data.metaVerifyToken || 'advent_verify_token');
        setMetaBusinessAccountId(res.data.metaBusinessAccountId || '');

        setTwilioAccountSid(res.data.twilioAccountSid || '');
        setTwilioAuthToken(res.data.twilioAuthToken || '');
        setTwilioPhoneNumber(res.data.twilioPhoneNumber || '');
        setGeminiApiKey(res.data.geminiApiKey || '');
        setGeminiModel(res.data.geminiModel || 'gemini-3.1-flash-lite');
        setContext(res.data.context || '');
        setIsEnabled(res.data.isEnabled || false);
      }
    } catch (err) {
      toast.error('Failed to load WhatsApp settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch chats
  const fetchChats = async () => {
    try {
      const res = await api.get('/whatsapp/chats');
      setChats(res.data || []);
    } catch (err) {
      toast.error('Failed to load active chats');
    }
  };

  // Fetch chat history for selected phone
  const fetchChatHistory = async (phone: string) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/whatsapp/chats/${encodeURIComponent(phone)}`);
      setChatMessages(res.data || []);
    } catch (err) {
      toast.error('Failed to load chat history');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchChats();
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      fetchChatHistory(selectedPhone);
    }
  }, [selectedPhone]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.post('/whatsapp/settings', {
        provider,
        metaPhoneNumberId,
        metaAccessToken,
        metaVerifyToken,
        metaBusinessAccountId,
        twilioAccountSid,
        twilioAuthToken,
        twilioPhoneNumber,
        geminiApiKey,
        geminiModel,
        context,
        isEnabled
      });
      toast.success('Settings saved successfully');
      if (res.data?.settings) {
        setTwilioAuthToken(res.data.settings.twilioAuthToken);
        setMetaAccessToken(res.data.settings.metaAccessToken);
        setGeminiApiKey(res.data.settings.geminiApiKey);
      }
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Token Estimator (Approx. 4 chars per token)
  const estimateTokens = (text: string) => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  };

  // Context Compression Logic
  const handlePreviewCompression = () => {
    if (!context.trim()) {
      toast.error('Context is empty');
      return;
    }

    let compressed = context;
    
    // replacements for common boilerplate
    const replacements = [
      { regex: /please note that/gi, replacement: "Note:" },
      { regex: /feel free to/gi, replacement: "can" },
      { regex: /our hours of operation are/gi, replacement: "Hours:" },
      { regex: /we are open from/gi, replacement: "Hours:" },
      { regex: /in order to/gi, replacement: "to" },
      { regex: /we would like to inform you that/gi, replacement: "Note:" },
      { regex: /if you have any questions/gi, replacement: "for Qs" },
      { regex: /do not hesitate to/gi, replacement: "can" },
      { regex: /as soon as possible/gi, replacement: "ASAP" },
      { regex: /business hours/gi, replacement: "Hours" },
      { regex: /working days/gi, replacement: "workdays" },
      { regex: /contact details/gi, replacement: "contact" },
      { regex: /additional information/gi, replacement: "details" },
      { regex: /customer relationship management/gi, replacement: "CRM" }
    ];

    replacements.forEach(r => {
      compressed = compressed.replace(r.regex, r.replacement);
    });

    // Remove double spaces and empty lines
    compressed = compressed.replace(/[ \t]+/g, ' '); 
    compressed = compressed.replace(/\n\s*\n+/g, '\n');
    
    setCompressedTextPreview(compressed.trim());
    setShowCompressionPreview(true);
  };

  const applyCompressedContext = () => {
    setContext(compressedTextPreview);
    setShowCompressionPreview(false);
    toast.success('Compressed context applied successfully!');
  };

  // Simulation Message Sender
  const handleSendSimulatorMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatorInput.trim()) return;

    const messageToSend = simulatorInput;
    setSimulatorInput('');
    setSimulatorSending(true);

    try {
      // Post mock message to simulation endpoint
      const res = await api.post('/whatsapp/simulate', {
        message: messageToSend,
        phoneNumber: simulatorPhone
      });

      if (res.data?.success) {
        // Refresh chats list and append response to active session details
        fetchChats();
        if (selectedPhone === simulatorPhone) {
          fetchChatHistory(simulatorPhone);
        } else {
          setSelectedPhone(simulatorPhone);
        }
        toast.success('AI Bot Replied!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Simulation failed. Make sure Gemini API key is correct.');
    } finally {
      setSimulatorSending(false);
    }
  };

  const copyWebhookUrl = () => {
    const rootUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const webhookUrl = `${rootUrl}/api/whatsapp/webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard!');
  };

  if (loading) {
    return (
      <ProtectedLayout requiredRole="Admin">
        <TopBar title="WhatsApp AI Automation" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="spinner spinner-dark" />
        </div>
      </ProtectedLayout>
    );
  }

  const origTokens = estimateTokens(context);
  const compTokens = estimateTokens(compressedTextPreview);
  const tokenSavings = origTokens > 0 ? Math.round(((origTokens - compTokens) / origTokens) * 100) : 0;

  return (
    <ProtectedLayout requiredRole="Admin">
      <TopBar title="WhatsApp AI Automation" onRefresh={fetchSettings} />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings size={16} />
            Settings & Credentials
          </button>
          <button
            onClick={() => setActiveTab('context')}
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'context'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} />
            AI Prompt Context
          </button>
          <button
            onClick={() => {
              setActiveTab('chats');
              fetchChats();
            }}
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'chats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <MessageSquare size={16} />
            Chat Inbox & Webhook
          </button>
        </div>

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 max-w-3xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">API Credentials</h2>
                <p className="text-xs text-gray-500">Configure Twilio and Gemini API connections for automation.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Bot Status:</span>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className="focus:outline-none transition-colors"
                >
                  {isEnabled ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs font-semibold">Active / Enabled</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200">
                      <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                      <span className="text-xs font-semibold">Disabled</span>
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp Service Provider</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('twilio')}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-xs transition-all border flex items-center justify-center gap-2 ${
                    provider === 'twilio'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Settings size={14} />
                  Twilio WhatsApp API
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('meta')}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-xs transition-all border flex items-center justify-center gap-2 ${
                    provider === 'meta'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Bot size={14} />
                  Meta Business Cloud API (Free / Direct)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {provider === 'twilio' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Twilio Auth Token
                    </label>
                    <input
                      type="password"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="Obscured"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Twilio WhatsApp Phone Number
                    </label>
                    <input
                      type="text"
                      value={twilioPhoneNumber}
                      onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="whatsapp:+14155238886"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Must start with 'whatsapp:' prefix</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Meta Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={metaPhoneNumberId}
                      onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="107849xxxxxxxxxx"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Found in Meta App Settings ➔ API Setup</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Meta Verify Token
                    </label>
                    <input
                      type="text"
                      value={metaVerifyToken}
                      onChange={(e) => setMetaVerifyToken(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="advent_verify_token"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Custom secret token to paste in Meta Webhook config</span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Meta System User Access Token
                    </label>
                    <input
                      type="password"
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="Obscured permanent token"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Permanent System User token generated in Meta Business Suite</span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Meta Business Account ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={metaBusinessAccountId}
                      onChange={(e) => setMetaBusinessAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="Optional Account ID"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="AIzaSy..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Gemini AI Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                >
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Recommended - High Quota)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Extremely responsive)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (State of the Art)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy Pro)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}

        {/* Tab Content: Prompt Context */}
        {activeTab === 'context' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Context Input Form */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">System Instruction Context</h2>
                  <p className="text-xs text-gray-500">Provide the knowledge base used by the AI agent to answer queries.</p>
                </div>
                <button
                  type="button"
                  onClick={handlePreviewCompression}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles size={14} />
                  Optimize Context
                </button>
              </div>

              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono leading-relaxed"
                placeholder="Write your system context here. For example:
Company: Advent Leads
Hours: M-F 09:30-17:30
Services: CRM custom setups, Tally license renewal, customer dashboards.
Tally renewal price: $100/year.
Fallback instruction: Ask user to leave email/phone number if Q not answered."
              />

              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex gap-4 text-xs text-gray-600">
                  <div>
                    Characters: <span className="font-semibold text-gray-800">{context.length}</span>
                  </div>
                  <div>
                    Estimated Tokens: <span className="font-semibold text-blue-600">{origTokens}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-sm transition-all"
                >
                  {savingSettings ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </div>

            {/* Token Saving Tips Panel */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
                <AlertTriangle size={16} className="text-amber-500" />
                Token Savings Blueprint
              </h3>
              
              <div className="text-xs text-gray-600 flex flex-col gap-3 leading-relaxed">
                <p>
                  Gemini API billing is based on token consumption. To conserve budget:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-700">
                  <li><strong>Use Abbreviations:</strong> Instead of "Monday through Friday", write "M-F".</li>
                  <li><strong>Drop Verbs & Articles:</strong> Write "Office: NY", not "Our head office is located in New York".</li>
                  <li><strong>Colon Shorthand:</strong> Group details with colons rather than conversational prose.</li>
                  <li><strong>Strip Fluff:</strong> Eliminate polite transitions like "We are excited to offer".</li>
                </ul>

                <div className="mt-2 border-t border-gray-100 pt-3">
                  <div className="font-semibold text-gray-800 mb-2">Example Comparison:</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-red-50 p-2.5 rounded border border-red-100 text-red-800">
                      <span className="font-bold">Verbose (45 tokens):</span>
                      <p className="mt-1 font-mono">Our customer service office is open from 9:30 AM to 5:30 PM. Please call us if you have any questions.</p>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded border border-emerald-100 text-emerald-800">
                      <span className="font-bold">Optimized (12 tokens):</span>
                      <p className="mt-1 font-mono">Hours:9:30-17:30. Call for Qs.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Chat History / Simulator */}
        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
            
            {/* Chats list sidebar */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Conversations</h3>
                  <p className="text-[10px] text-gray-500">Chats handled by your AI agent</p>
                </div>
                <button
                  onClick={() => {
                    fetchChats();
                    toast.success('Inbox updated');
                  }}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                  title="Reload Conversations"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {chats.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No active chats found. Setup webhook or send a simulation message.
                  </div>
                ) : (
                  chats.map((c) => {
                    const isActive = selectedPhone === c._id;
                    return (
                      <div
                        key={c._id}
                        onClick={() => setSelectedPhone(c._id)}
                        className={`p-4 cursor-pointer transition-colors flex flex-col gap-1.5 ${
                          isActive ? 'bg-blue-50/75 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-gray-800 font-mono">{c._id}</span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(c.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-medium text-gray-600 mr-1">
                            {c.lastSender === 'User' ? 'User:' : 'AI:'}
                          </span>
                          {c.lastMessage}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Webhook details card at bottom */}
              <div className="p-4 bg-slate-900 text-white border-t border-slate-800 flex flex-col gap-2.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-300">Webhook Connection</h4>
                  <p className="text-[9px] text-slate-400">Add this URL to Twilio WhatsApp Sandbox Sandbox Webhook field.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : ''}
                    className="flex-1 bg-slate-800 border border-slate-700 text-[10px] py-1 px-2 rounded text-slate-300 select-all outline-none font-mono"
                  />
                  <button
                    onClick={copyWebhookUrl}
                    className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-white flex items-center justify-center transition-colors"
                    title="Copy URL"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat history pane + Live Simulator */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden h-full">
              {selectedPhone ? (
                <>
                  {/* Active Chat Header */}
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="font-bold text-sm text-gray-800 font-mono">{selectedPhone}</span>
                    </div>
                    
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <Bot size={11} /> Agent: Gemini
                    </span>
                  </div>

                  {/* Message bubble pane */}
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 flex flex-col gap-3">
                    {chatLoading ? (
                      <div className="flex justify-center p-8">
                        <div className="spinner spinner-dark" />
                      </div>
                    ) : (
                      chatMessages.map((m) => {
                        const isAI = m.sender === 'AI';
                        return (
                          <div
                            key={m._id}
                            className={`flex flex-col max-w-[75%] ${isAI ? 'self-start' : 'self-end items-end'}`}
                          >
                            <div
                              className={`p-3 rounded-xl text-xs leading-relaxed shadow-sm ${
                                isAI
                                  ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                  : 'bg-blue-600 text-white rounded-tr-none'
                              }`}
                            >
                              {m.message}
                            </div>
                            <span className="text-[8.5px] text-gray-400 mt-1 px-1">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Simulator send input */}
                  <form onSubmit={handleSendSimulatorMsg} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={simulatorInput}
                        onChange={(e) => setSimulatorInput(e.target.value)}
                        placeholder={`Simulate a user texting the bot on ${selectedPhone}...`}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        disabled={simulatorSending}
                      />
                      <span className="absolute right-3 text-[10px] text-slate-400 font-semibold select-none bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        SIMULATOR
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={simulatorSending || !simulatorInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                  <Bot size={48} className="text-gray-300 mb-3" />
                  <h4 className="font-semibold text-gray-700 text-sm mb-1">Select a Conversation</h4>
                  <p className="text-xs text-gray-400 max-w-sm mb-6">
                    Choose a client from the inbox, or start a new simulation by entering a test phone number below.
                  </p>
                  
                  {/* Simulator Initializer Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!simulatorPhone.trim()) return;
                      setSelectedPhone(simulatorPhone);
                    }}
                    className="w-full max-w-xs bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3"
                  >
                    <div>
                      <label className="block text-[10px] font-semibold text-left text-gray-500 uppercase mb-1">
                        Test Phone Number
                      </label>
                      <input
                        type="text"
                        value={simulatorPhone}
                        onChange={(e) => setSimulatorPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded border border-gray-300 text-xs text-center font-mono"
                        placeholder="+15550100"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play size={12} /> Create Simulated Chat
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compression Optimizer Modal */}
      {showCompressionPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-3xl w-full flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={18} />
                <h3 className="font-semibold text-sm">Context Optimizer Preview</h3>
              </div>
              <button
                onClick={() => setShowCompressionPreview(false)}
                className="text-white hover:text-white/80 text-lg font-bold outline-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Context Display */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 uppercase">Original Text</span>
                  <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-semibold">
                    {origTokens} tokens
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono whitespace-pre-wrap h-64 overflow-y-auto">
                  {context}
                </div>
              </div>

              {/* Compressed Context Display */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 uppercase">Optimized Text</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-semibold">
                      {compTokens} tokens
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                      Saved {tokenSavings}%
                    </span>
                  </div>
                </div>
                <textarea
                  value={compressedTextPreview}
                  onChange={(e) => setCompressedTextPreview(e.target.value)}
                  className="w-full p-4 rounded-lg bg-emerald-50/20 border border-emerald-200 text-xs font-mono h-64 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none overflow-y-auto text-emerald-950"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCompressionPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={applyCompressedContext}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                Apply Compressed Context
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
