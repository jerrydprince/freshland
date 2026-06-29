import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Send, Users, AlertOctagon, RefreshCw, 
  Trash2, X, Plus, FileText, UserCheck, 
  ShieldCheck, Paperclip, Image, Download, Search, 
  MessageSquare, AlertTriangle, Bell, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { optimizeImage } from '../../utils/imageOptimizer';


const CHANNELS = [
  { id: 'all', role: 'all', label: '🛎️ General Broadcast', description: 'Global updates visible to all logged-in staff.' },
  { id: 'receptionist', role: 'receptionist', label: '🛎️ Front Office Reception', description: 'Chat with receptionist managers and agents.' },
  { id: 'housekeeping', role: 'housekeeping', label: '🧹 Housekeeping Crew', description: 'Coordinate cleaning and room inspector logs.' },
  { id: 'laundry_staff', role: 'laundry_staff', label: '🧺 Laundry Department', description: 'Log washing allocations and walk-in settlements.' },
  { id: 'maintenance', role: 'maintenance', label: '🔧 Maintenance & Repairs', description: 'Utility incident handovers and repair logs.' },
  { id: 'accountant', role: 'accountant', label: '💳 Accounting & Ledgers', description: 'Folios, finance queries, and checkout invoicing.' }
];

const InternalMessages = () => {
  const { profile, hasAccess } = useAuth();
  const [messages, setMessages] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [sidebarTab, setSidebarTab] = useState(() => {
    return hasAccess('Internal Messaging - Broadcast Announcements') ? 'channels' : 'users';
  }); // 'channels' or 'users'
  const [activeTarget, setActiveTarget] = useState(() => {
    if (hasAccess('Internal Messaging - Broadcast Announcements')) {
      return { type: 'channel', role: 'all', label: '🛎️ General Broadcast', description: 'Global updates visible to all logged-in staff.' };
    }
    return { type: 'user', id: '', name: 'Select a colleague', role: '', is_on_shift: false };
  });
  const [filterQuery, setFilterQuery] = useState('');
  
  // Chat Input States
  const [chatInput, setChatInput] = useState('');
  const [chatPriority, setChatPriority] = useState('normal'); // normal, high, urgent
  const [attachment, setAttachment] = useState(null); // { name: string, dataUrl: string }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // null or { url, name }

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasBroadcastAccess = hasAccess('Internal Messaging - Broadcast Announcements');
  const isBroadcastDisabled = activeTarget.type === 'channel' && !hasBroadcastAccess;
  const isNoUserSelected = activeTarget.type === 'user' && !activeTarget.id;
  const isChatDisabled = isBroadcastDisabled || isNoUserSelected;

  useEffect(() => {
    if (profile) {
      const hasBroadcast = hasAccess('Internal Messaging - Broadcast Announcements');
      if (!hasBroadcast) {
        setSidebarTab('users');
        setActiveTarget(prev => {
          if (prev.type === 'channel') {
            return { type: 'user', id: '', name: 'Select a colleague', role: '', is_on_shift: false };
          }
          return prev;
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    fetchMessages();
    fetchStaff();

    const channel = supabase
      .channel(`internal-messages-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' }, () => {
        fetchMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStaff();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_active_sessions' }, () => {
        fetchStaff();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto scroll to bottom of chat feed on message updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTarget]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select(`
          *,
          sender:sender_id (first_name, last_name, role),
          recipient:recipient_id (first_name, last_name, role)
        `)
        .order('created_at', { ascending: true }); // chronological order for chats

      if (error) throw error;
      
      // Parse fallback base64 attachments stored inside body if columns are not ready
      const parsedData = (data || []).map(msg => {
        if (!msg.attachment_url && msg.body && msg.body.includes('[ATTACHMENT_FALLBACK:')) {
          const match = msg.body.match(/\[ATTACHMENT_FALLBACK:(.*?)\|(.*?)\]/);
          if (match) {
            return {
              ...msg,
              attachment_name: match[1],
              attachment_url: match[2],
              body: msg.body.replace(/\[ATTACHMENT_FALLBACK:(.*?)\|(.*?)\]/, '').trim()
            };
          }
        }
        return msg;
      });

      setMessages(parsedData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load internal chat history logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, email, is_on_shift')
        .neq('role', 'guest')
        .order('first_name');

      if (profileErr) throw profileErr;

      // Fetch active sessions to verify login state
      const { data: sessions, error: sessionsErr } = await supabase
        .from('user_active_sessions')
        .select('user_id, last_active_at');

      if (sessionsErr) {
        console.warn("Failed to fetch user active sessions: ", sessionsErr);
      }

      const mappedStaff = (profiles || []).map(st => {
        const isOnline = (sessions || []).some(s => 
          s.user_id === st.id && 
          (Date.now() - new Date(s.last_active_at).getTime()) < 15 * 60 * 1000 // 15 mins active threshold
        );
        return {
          ...st,
          is_online: isOnline
        };
      });

      setStaff(mappedStaff);
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all unread received direct messages as read when opening user chat thread
  useEffect(() => {
    if (activeTarget && activeTarget.type === 'user') {
      const unreadFromTarget = messages.filter(m => 
        m.sender_id === activeTarget.id && 
        m.recipient_id === profile?.id && 
        !m.is_read
      );
      if (unreadFromTarget.length > 0) {
        markMessagesAsRead(unreadFromTarget.map(m => m.id));
      }
    }
  }, [activeTarget, messages, profile]);

  const markMessagesAsRead = async (msgIds) => {
    try {
      const { error } = await supabase
        .from('internal_messages')
        .update({ is_read: true })
        .in('id', msgIds);

      if (error) throw error;
      
      // Local state sync
      setMessages(prev => prev.map(m => msgIds.includes(m.id) ? { ...m, is_read: true } : m));
    } catch (err) {
      console.warn("Failed to mark messages as read:", err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      return toast.error("File size exceeds 4MB sandbox upload limit.");
    }

    const loaderId = toast.loading(`📎 Reading attachment: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        optimizeImage(reader.result, 800, 800, 0.7).then(optimized => {
          setAttachment({
            name: file.name,
            dataUrl: optimized
          });
          toast.success(`📎 Image attached and optimized: ${file.name}`, { id: loaderId });
        }).catch(err => {
          console.error(err);
          toast.error("Failed to optimize image attachment.", { id: loaderId });
        });
      } else {
        setAttachment({
          name: file.name,
          dataUrl: reader.result
        });
        toast.success(`📎 File attached: ${file.name}`, { id: loaderId });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (isChatDisabled) {
      return toast.error('Sending messages is disabled in the current selection.');
    }
    if (!chatInput.trim() && !attachment) {
      return toast.error('Please enter a message or attach a file.');
    }

    setIsSubmitting(true);
    const textMsg = chatInput;
    setChatInput(''); // clear immediately for fluid chat UX

    try {
      const payload = {
        sender_id: profile?.id,
        recipient_role: activeTarget.type === 'channel' ? activeTarget.role : null,
        recipient_id: activeTarget.type === 'user' ? activeTarget.id : null,
        subject: activeTarget.type === 'channel' ? `Broadcast: ${activeTarget.label}` : 'Direct Message',
        body: textMsg,
        priority: chatPriority,
        is_read: false,
        attachment_url: attachment?.dataUrl || null,
        attachment_name: attachment?.name || null
      };

      const { error } = await supabase.from('internal_messages').insert([payload]);
      
      if (error) {
        // If SQL column is missing (migration not applied yet), fallback using body-nesting encoding
        if (error.message.includes('attachment_url') || error.code === '42703') {
          console.warn("Database columns not migrated yet, executing body-nesting fallback codec...");
          
          let fallbackBody = textMsg;
          if (attachment) {
            fallbackBody += `\n[ATTACHMENT_FALLBACK:${attachment.name}|${attachment.dataUrl}]`;
          }

          const fallbackPayload = {
            sender_id: profile?.id,
            recipient_role: activeTarget.type === 'channel' ? activeTarget.role : null,
            recipient_id: activeTarget.type === 'user' ? activeTarget.id : null,
            subject: activeTarget.type === 'channel' ? `Broadcast: ${activeTarget.label}` : 'Direct Message',
            body: fallbackBody,
            priority: chatPriority,
            is_read: false
          };

          const { error: fallbackError } = await supabase.from('internal_messages').insert([fallbackPayload]);
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      setAttachment(null);
      setChatPriority('normal');
      fetchMessages();
    } catch (err) {
      console.error(err);
      toast.error(`Send failed: ${err.message}`);
      setChatInput(textMsg); // restore text on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Are you sure you want to delete this message log?")) return;
    try {
      const { error } = await supabase.from('internal_messages').delete().eq('id', msgId);
      if (error) throw error;
      toast.success("Message removed from logs");
      fetchMessages();
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  // --- FILTERS & FILTER CORES ---
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      if (activeTarget.type === 'channel') {
        return m.recipient_role === activeTarget.role && m.recipient_id === null;
      } else {
        return (m.sender_id === profile?.id && m.recipient_id === activeTarget.id) ||
               (m.sender_id === activeTarget.id && m.recipient_id === profile?.id);
      }
    });
  }, [messages, activeTarget, profile]);

  const channelsList = useMemo(() => {
    return CHANNELS.filter(ch => 
      ch.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
      ch.description.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [filterQuery]);

  const colleaguesList = useMemo(() => {
    return staff.filter(st => {
      if (st.id === profile?.id) return false;
      const fullName = `${st.first_name} ${st.last_name}`.toLowerCase();
      return fullName.includes(filterQuery.toLowerCase()) || 
             st.role.toLowerCase().includes(filterQuery.toLowerCase());
    });
  }, [staff, filterQuery, profile]);

  // Badge Counters
  const getDirectUnreadCount = (userId) => {
    return messages.filter(m => m.sender_id === userId && m.recipient_id === profile?.id && !m.is_read).length;
  };

  const getChannelUnreadCount = (role) => {
    // Basic unread check for group channels (e.g. message matches role and was not sent by self)
    // For local prototype workspace simplicity, lets show priority messages counts!
    return messages.filter(m => m.recipient_role === role && m.recipient_id === null && m.sender_id !== profile?.id && m.priority !== 'normal').length;
  };

  if (!hasAccess('Internal Messaging') && !hasAccess('Internal Messaging - Send Direct Messages') && !hasAccess('Internal Messaging - Broadcast Announcements')) {
    return <div className="p-8 text-center text-gray-300">You do not have permission to view Internal Communications.</div>;
  }

  return (
    <div className="space-y-6 pb-20 text-white select-none">

      {/* Header Banner */}
      <div className="bg-dark-800 border border-dark-700 p-5 flex flex-col md:flex-row justify-between items-center rounded-2xl shadow-lg relative overflow-hidden bg-gradient-to-r from-dark-900/60 to-dark-800/40">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl flex items-center justify-center text-white shadow-lg animate-pulse">
            <Send size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Operations Chat Terminal</h1>
            <p className="text-gray-200 text-xs mt-0.5">Real-time collaborative group channels and secure peer-to-peer staff direct messaging.</p>
          </div>
        </div>
        <button 
          onClick={fetchMessages}
          className="mt-3 md:mt-0 bg-dark-750 hover:bg-dark-700 border border-dark-700 py-2 px-4 rounded-xl text-gray-300 hover:text-white transition-all flex items-center gap-1.5 self-end md:self-center font-bold text-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Database
        </button>
      </div>

      {/* Chat Terminal Core */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px] max-h-[80vh] items-stretch">
        
        {/* ==================================================== */}
        {/* LEFT SIDEBAR: Threads, Channels & DMs (4/12 columns) */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 bg-dark-800 border border-dark-700 rounded-3xl p-5 flex flex-col justify-between shadow-2xl space-y-4">
          
          <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
            {/* Unified Terminal Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input 
                type="text"
                placeholder="Search channels, employees..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                className="w-full bg-dark-900 border border-dark-750/70 pl-10 pr-4 py-2.5 rounded-2xl text-xs font-semibold text-white outline-none focus:border-brand-500 transition-all font-sans"
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selector tabs */}
            <div className="grid grid-cols-2 gap-2 bg-dark-900/80 p-1.5 rounded-2xl border border-dark-750/50">
              <button
                onClick={() => setSidebarTab('channels')}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'channels' 
                    ? 'bg-gradient-to-r from-brand-900/30 to-brand-850/10 text-brand-400 font-extrabold border border-brand-500/20' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Users size={13} /> Channels
              </button>
              <button
                onClick={() => setSidebarTab('users')}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'users' 
                    ? 'bg-gradient-to-r from-brand-900/30 to-brand-850/10 text-brand-400 font-extrabold border border-brand-500/20' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Clock size={13} /> Direct (DMs)
              </button>
            </div>

            {/* List Stream (Channels OR Staff) */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1 select-none">
              {sidebarTab === 'channels' ? (
                channelsList.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 italic text-xs">No channels found.</div>
                ) : (
                  channelsList.map(ch => {
                    const isActive = activeTarget.type === 'channel' && activeTarget.role === ch.role;
                    const unreadPriority = getChannelUnreadCount(ch.role);

                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveTarget({ type: 'channel', role: ch.role, label: ch.label, description: ch.description })}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-between border ${
                          isActive 
                            ? 'bg-gradient-to-r from-brand-900/40 to-brand-850/20 border-brand-500/80 shadow-lg translate-x-1' 
                            : 'bg-dark-900/20 hover:bg-dark-750/30 border-transparent hover:border-dark-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className={`text-xs font-black block font-serif ${isActive ? 'text-white' : 'text-gray-200'}`}>
                            {ch.label}
                          </span>
                          <span className="text-[10px] text-gray-300 block truncate mt-0.5">{ch.description}</span>
                        </div>
                        {unreadPriority > 0 && (
                          <span className="bg-amber-500 text-dark-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0">
                            Alert
                          </span>
                        )}
                      </button>
                    );
                  })
                )
              ) : (
                colleaguesList.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 italic text-xs">No staff found.</div>
                ) : (
                  colleaguesList.map(st => {
                    const isActive = activeTarget.type === 'user' && activeTarget.id === st.id;
                    const unreadCount = getDirectUnreadCount(st.id);

                    return (
                      <button
                        key={st.id}
                        onClick={() => setActiveTarget({ type: 'user', id: st.id, name: `${st.first_name} ${st.last_name}`, role: st.role, is_online: st.is_online })}
                        className={`w-full text-left p-3 rounded-2xl transition-all duration-300 flex items-center justify-between border ${
                          isActive 
                            ? 'bg-gradient-to-r from-brand-900/40 to-brand-850/20 border-brand-500/80 shadow-lg translate-x-1' 
                            : 'bg-dark-900/20 hover:bg-dark-750/30 border-transparent hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Colleague Initial Avatar with Shift Indicator */}
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 bg-dark-900 border border-dark-750 rounded-xl flex items-center justify-center text-xs font-black text-brand-400 shadow-inner">
                              {st.first_name.charAt(0)}{st.last_name.charAt(0)}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-dark-800 ring-2 ${
                              st.is_online 
                                ? 'bg-green-500 ring-green-500/20 animate-pulse' 
                                : 'bg-gray-600 ring-transparent'
                            }`} />
                          </div>

                          <div className="min-w-0">
                            <span className={`text-xs font-black block font-serif ${isActive ? 'text-white' : 'text-gray-200'}`}>
                              {st.first_name} {st.last_name}
                            </span>
                            <span className="text-[9px] text-brand-500 font-bold uppercase tracking-wider block mt-0.5">
                              {st.role.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {unreadCount > 0 && (
                          <span className="bg-brand-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>

          <div className="bg-dark-900 border border-dark-750 p-4 rounded-2xl text-[11px] text-gray-450 leading-relaxed font-semibold">
            <h4 className="font-extrabold text-gray-300 flex items-center gap-1 uppercase text-[9px] tracking-widest"><ShieldCheck size={12} className="text-brand-500" /> Security Controls</h4>
            <p className="mt-1">Messages are logged securely. Shift activity is dynamically synchronized via networked entry terminals.</p>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CENTER PANE: Dynamic Chat Window Feed (8/12 columns) */}
        {/* ==================================================== */}
        <div className="lg:col-span-8 bg-dark-800 border border-dark-700 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden max-h-[80vh]">
          
          {/* Active Chat Header */}
          <div className="p-4 border-b border-dark-700 bg-dark-900/60 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl flex items-center justify-center text-white shadow shadow-brand-500/10">
                {activeTarget.type === 'channel' ? <Users size={18} /> : <MessageSquare size={18} />}
              </div>
              <div>
                <h3 className="font-extrabold text-white font-serif text-sm tracking-tight flex items-center gap-2">
                  {activeTarget.type === 'channel' ? activeTarget.label : activeTarget.name}
                  {activeTarget.type === 'user' && (
                    <span className={`h-2 w-2 rounded-full ${activeTarget.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                  )}
                </h3>
                <span className="text-[10px] text-gray-200 block font-medium mt-0.5">
                  {activeTarget.type === 'channel' 
                    ? activeTarget.description 
                    : `Active Direct Message | Role: ${activeTarget.role.replace(/_/g, ' ').toUpperCase()} (${activeTarget.is_online ? 'Online' : 'Offline'})`}
                </span>
              </div>
            </div>
            
            <span className="bg-dark-950 px-3 py-1 rounded-xl text-[9px] font-black uppercase text-brand-400 border border-dark-750">
              {activeTarget.type}
            </span>
          </div>

          {/* Messages Feed View */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4 bg-dark-900/35">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 italic text-xs gap-3">
                <div className="w-12 h-12 bg-dark-900 border border-dark-750 rounded-xl flex items-center justify-center text-gray-600 shadow-inner">
                  <MessageSquare size={20} />
                </div>
                <p>Begin synchronization. Type a secure operational message below.</p>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isSentByMe = msg.sender_id === profile?.id;
                const senderName = msg.sender 
                  ? `${msg.sender.first_name} ${msg.sender.last_name}`
                  : 'System';

                return (
                  <div 
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] ${isSentByMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    {/* Sender Tag (Received messages or broad channels only) */}
                    {!isSentByMe && (
                      <span className="text-[9px] text-gray-300 font-extrabold uppercase tracking-wide mb-1 ml-1 flex items-center gap-1 select-all">
                        {senderName} 
                        <span className="text-brand-500 text-[8px] font-bold">
                          ({msg.sender?.role.replace(/_/g, ' ') || 'PMS'})
                        </span>
                      </span>
                    )}

                    {/* Chat Bubble Box */}
                    <div 
                      className={`p-4 rounded-3xl text-[13px] leading-relaxed relative shadow-lg flex flex-col space-y-2.5 border select-text ${
                        isSentByMe 
                          ? 'bg-brand-500/10 text-white border-brand-500 rounded-tr-none shadow-md shadow-brand-500/5' 
                          : 'bg-dark-900 border-dark-750 text-white rounded-tl-none'
                      } ${
                        msg.priority === 'urgent' 
                          ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)] ring-1 ring-red-500/20' 
                          : msg.priority === 'high' 
                            ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/20' 
                            : ''
                      }`}
                    >
                      {/* Urgent Banner Indicator in Bubble */}
                      {msg.priority !== 'normal' && (
                        <span className={`inline-flex items-center gap-1 self-start px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          msg.priority === 'urgent' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <AlertTriangle size={10} /> {msg.priority} Notice
                        </span>
                      )}

                      {/* Message Body */}
                      <p className="whitespace-pre-wrap leading-relaxed select-text font-semibold">{msg.body}</p>

                      {/* Attachment preview inline in bubble */}
                      {msg.attachment_url && (
                        <div className={`mt-1 border-t pt-2 flex flex-col space-y-1 w-full max-w-[320px] ${
                          isSentByMe ? 'border-brand-500/20' : 'border-dark-750/30'
                        }`}>
                          {msg.attachment_url.startsWith('data:image/') ? (
                            <div className="relative rounded-2xl overflow-hidden border border-dark-700/60 max-h-[160px] bg-dark-950 group">
                              <img 
                                src={msg.attachment_url} 
                                alt={msg.attachment_name || 'attachment'} 
                                onClick={() => setLightboxImage({ url: msg.attachment_url, name: msg.attachment_name })}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold pointer-events-none">
                                Click to View Image
                              </div>
                            </div>
                          ) : (
                            <a 
                              href={msg.attachment_url} 
                              download={msg.attachment_name || 'document'}
                              className="flex items-center justify-between p-3 rounded-xl bg-dark-950/80 border border-dark-750 hover:bg-dark-950 transition-all gap-3 text-xs w-full text-white"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={15} className="text-brand-400 shrink-0" />
                                <span className="font-extrabold truncate select-all">{msg.attachment_name || 'PMS-File'}</span>
                              </div>
                              <Download size={14} className="text-gray-200 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Time and Delete Action Row */}
                      <div className="flex items-center justify-between gap-6 self-end pt-1">
                        <span className={`text-[8px] font-mono leading-none ${isSentByMe ? 'text-white/60' : 'text-gray-300'}`}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        {isSentByMe && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-white/40 hover:text-red-500 transition-colors pointer-events-auto"
                            title="Delete this message"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ==================================================== */}
          {/* BOTTOM PANEL: Chat input Entry bar (File selection) */}
          {/* ==================================================== */}
          <div className="p-4 border-t border-dark-700 bg-dark-900/60 flex-shrink-0 space-y-3">
            
            {/* Attachment preview chip bar */}
            {attachment && (
              <div className="flex items-center justify-between bg-dark-950/90 border border-dark-750 p-2.5 rounded-xl text-xs gap-3 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  {attachment.dataUrl.startsWith('data:image/') ? <Image size={15} className="text-brand-400" /> : <FileText size={15} className="text-brand-400" />}
                  <span className="font-extrabold truncate text-white select-all">{attachment.name}</span>
                </div>
                <button 
                  onClick={() => setAttachment(null)}
                  className="p-1 bg-dark-900 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded transition-all"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Chat form entry bar */}
            <form onSubmit={handleSendChat} className="flex flex-col sm:flex-row items-center gap-3.5">
              
              {/* Paperclip upload trigger */}
              <div className="flex items-center gap-2 flex-shrink-0 self-stretch sm:self-auto">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isChatDisabled}
                  className="p-3 bg-dark-900 hover:bg-dark-750 border border-dark-750/70 text-gray-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl transition-all shadow-inner"
                  title="Attach file / report"
                >
                  <Paperclip size={16} />
                </button>

                {/* Priority Selector Pill */}
                <select
                  value={chatPriority}
                  onChange={e => setChatPriority(e.target.value)}
                  disabled={isChatDisabled}
                  className={`px-3 py-3 bg-dark-900 hover:bg-dark-750 border border-dark-750/70 text-xs font-bold rounded-2xl outline-none focus:border-brand-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    chatPriority === 'urgent' ? 'text-red-400' : chatPriority === 'high' ? 'text-amber-400' : 'text-gray-200'
                  }`}
                  title="Select message significance priority"
                >
                  <option value="normal">🟢 Normal</option>
                  <option value="high">🟡 High</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>

              {/* Chat Input Field */}
              <div className="flex-1 w-full relative">
                <input 
                  type="text"
                  placeholder={
                    isBroadcastDisabled 
                      ? "You do not have permission to post broadcast announcements in this channel." 
                      : isNoUserSelected 
                      ? "Select a colleague from the list to start messaging..." 
                      : activeTarget.type === 'channel'
                      ? `Broadcast operational message in ${activeTarget.label}...`
                      : `DM text message to ${activeTarget.name}...`
                  }
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isChatDisabled}
                  className="w-full bg-dark-900 border border-dark-750/70 px-4 py-3 rounded-2xl text-xs font-semibold text-white outline-none focus:border-brand-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
                />
              </div>

              {/* Submit Dispatch */}
              <button
                type="submit"
                disabled={isSubmitting || isChatDisabled || (!chatInput.trim() && !attachment)}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-dark-950 font-black text-xs py-3 px-6 rounded-2xl transition-all shadow-[0_4px_15px_rgba(223,104,83,0.2)] hover:shadow-[0_4px_20px_rgba(223,104,83,0.3)] flex items-center justify-center gap-1.5 self-stretch sm:self-auto flex-shrink-0"
              >
                {isSubmitting ? 'Sending...' : 'Send'} <Send size={12} />
              </button>

            </form>
          </div>
        </div>
      </div>

      {/* --- IMAGE LIGHTBOX FULL SCREEN MODAL DIALOG --- */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in">
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-2 bg-dark-900 border border-dark-700 text-gray-200 hover:text-white rounded-full hover:scale-105 transition-all shadow-xl"
            title="Close Lightbox"
          >
            <X size={24} />
          </button>
          
          <div className="relative max-w-4xl max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl border border-dark-700 flex items-center justify-center bg-dark-950 select-text">
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name || 'lightbox'} 
              className="max-w-full max-h-[85vh] object-contain select-none"
            />
          </div>

          <div className="mt-6 flex gap-4 bg-dark-900 border border-dark-700/80 px-6 py-3.5 rounded-2xl shadow-lg items-center">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block">Attachment details</span>
              <span className="text-xs font-extrabold text-white block select-all">{lightboxImage.name || 'PMS-Image-attachment'}</span>
            </div>
            <a 
              href={lightboxImage.url}
              download={lightboxImage.name || 'luxe-image-attachment'}
              className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-black text-xs py-2 px-4 rounded-xl flex items-center gap-1 shadow transition-all"
            >
              <Download size={13} /> Download Image
            </a>
          </div>
        </div>
      )}

    </div>
  );
};

export default InternalMessages;
