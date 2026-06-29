import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  SearchCheck, Plus, PackageOpen, HelpCircle, CheckCircle, 
  Trash2, Search, X, Calendar, User, Eye, Sparkles, Building, Phone, RefreshCw,
  Bell, Mail, MessageSquare, Send, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { optimizeImage } from '../../utils/imageOptimizer';


const LostFound = () => {
  const { profile, hasAccess } = useAuth();
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [claimingItem, setClaimingItem] = useState(null);

  // Advanced Linkage and Notification States
  const [dbLinkedEnabled, setDbLinkedEnabled] = useState(false);
  const [dbImageColumnEnabled, setDbImageColumnEnabled] = useState(false);
  const [recentOccupant, setRecentOccupant] = useState(null);
  const [resolvingOccupant, setResolvingOccupant] = useState(false);
  const [notifyingItem, setNotifyingItem] = useState(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [itemImage, setItemImage] = useState(null); // base64 string
  
  // Dynamic contact details from system_settings
  const [systemSettings, setSystemSettings] = useState({
    contact_phone: '08103694837, 08174971881',
    contact_email: 'info@sparklesapartments.com'
  });

  const isHousekeeper = useMemo(() => {
    if (!profile || !profile.role) return false;
    const r = profile.role.toLowerCase().trim();
    return r === 'housekeeper' || r === 'housekeeping' || r === 'head_housekeeper';
  }, [profile]);

  const parseItemImage = (item) => {
    if (!item) return null;
    if (item.image_url) return item.image_url;
    if (item.notes && item.notes.includes('||IMAGE:')) {
      const parts = item.notes.split('||IMAGE:');
      return parts[1]?.trim();
    }
    if (item.description && item.description.includes('||IMAGE:')) {
      const parts = item.description.split('||IMAGE:');
      return parts[1]?.trim();
    }
    return null;
  };

  const parseCleanNotes = (notes) => {
    if (!notes) return '';
    if (notes.includes('||IMAGE:')) {
      return notes.split('||IMAGE:')[0].trim();
    }
    return notes;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loaderId = toast.loading("Processing and optimizing item image...");
    const reader = new FileReader();
    reader.onloadend = () => {
      optimizeImage(reader.result, 800, 800, 0.7).then(optimized => {
        setItemImage(optimized);
        toast.success("✓ Image loaded and automatically optimized.", { id: loaderId });
      }).catch(err => {
        console.error(err);
        toast.error("Failed to process image.", { id: loaderId });
      });
    };
    reader.readAsDataURL(file);
  };
  
  // Notification form fields
  const [notificationData, setNotificationData] = useState({
    channel: 'email',
    recipient_name: '',
    recipient_email: '',
    recipient_phone: '',
    subject: '',
    message: ''
  });

  // Form States
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    found_location: '',
    room_id: '',
    booking_id: '',
    found_by: '',
    notes: ''
  });

  const [claimData, setClaimData] = useState({
    claimant_name: '',
    claimant_phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, unclaimed, claimed, disposed

  // Derived authorization checks
  const canNotifyAndSettle = useMemo(() => {
    return hasAccess('Lost & Found - Notify Guest & Settle Claims');
  }, [hasAccess]);

  const canDispose = useMemo(() => {
    return hasAccess('Lost & Found - Dispose Items');
  }, [hasAccess]);

  useEffect(() => {
    fetchLostFoundData();
  }, []);

  useEffect(() => {
    if (showAddForm && isHousekeeper && profile) {
      const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        found_by: name
      }));
    }
  }, [showAddForm, isHousekeeper, profile]);

  const fetchLostFoundData = async () => {
    setLoading(true);
    try {
      let lfData = [];
      
      // 1. Fetch Lost and Found Items (Try with bookings linkage first)
      try {
        const { data, error } = await supabase
          .from('lost_found_items')
          .select(`
            *,
            rooms (id, room_number, name),
            bookings (
              id,
              guest_name,
              guest_email,
              guest_phone,
              check_in_date,
              check_out_date,
              profiles (first_name, last_name, email, phone)
            )
          `)
          .order('found_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        lfData = data || [];
        setDbLinkedEnabled(true);
      } catch (err) {
        console.warn('Advanced lost_found_items schema columns not yet available. Falling back to base query.', err);
        const { data, error: baseErr } = await supabase
          .from('lost_found_items')
          .select(`
            *,
            rooms (room_number, name)
          `)
          .order('found_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (baseErr) throw baseErr;
        lfData = data || [];
        setDbLinkedEnabled(false);
      }
      
      setItems(lfData);

      // Probe image_url support
      try {
        const { error: testErr } = await supabase
          .from('lost_found_items')
          .select('image_url')
          .limit(1);
        setDbImageColumnEnabled(!testErr);
      } catch (err) {
        setDbImageColumnEnabled(false);
      }

      // Fetch system settings contact details
      try {
        const { data: sysData } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['contact_phone', 'contact_email']);
        if (sysData) {
          const settingsMap = {};
          sysData.forEach(item => {
            settingsMap[item.setting_key] = item.setting_value;
          });
          setSystemSettings(prev => ({
            contact_phone: settingsMap.contact_phone || prev.contact_phone,
            contact_email: settingsMap.contact_email || prev.contact_email
          }));
        }
      } catch (err) {
        console.warn('Failed to load system settings contact details:', err);
      }

      // 2. Fetch Rooms for selection dropdown
      const { data: rmData, error: rmErr } = await supabase
        .from('rooms')
        .select('id, room_number, name')
        .order('room_number');

      if (rmErr) throw rmErr;
      setRooms(rmData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lost and found data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoomChange = async (roomId) => {
    setFormData(prev => ({ ...prev, room_id: roomId, booking_id: '' }));
    setRecentOccupant(null);
    
    if (!roomId) return;
    
    setResolvingOccupant(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          guest_phone,
          check_in_date,
          check_out_date,
          status,
          profiles (first_name, last_name, email, phone)
        `)
        .eq('room_id', roomId)
        .in('status', ['checked_in', 'checked_out'])
        .order('check_out_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const occupant = data[0];
        setRecentOccupant(occupant);
        setFormData(prev => ({ ...prev, booking_id: occupant.id }));
        toast.success(`Resolved recent occupant: ${occupant.guest_name || (occupant.profiles ? `${occupant.profiles.first_name} ${occupant.profiles.last_name}` : 'Guest')}`);
      } else {
        toast('No recent checked-in or checked-out guests found for this room.', { icon: 'ℹ' });
      }
    } catch (err) {
      console.error('Failed to resolve room occupant:', err);
    } finally {
      setResolvingOccupant(false);
    }
  };

  const handleRegisterItem = async (e) => {
    e.preventDefault();
    const { item_name, found_location, found_by } = formData;
    if (!item_name || !found_location || !found_by) {
      return toast.error('Please fill in Item Name, Found Location, and Finder\'s Name.');
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Registering lost item ticket...');

    try {
      const payload = {
        item_name: formData.item_name,
        description: formData.description,
        found_location: formData.found_location,
        room_id: formData.room_id || null,
        found_by: formData.found_by,
        notes: itemImage && !dbImageColumnEnabled ? `${formData.notes || ''} ||IMAGE:${itemImage}`.trim() : formData.notes,
        status: 'unclaimed'
      };

      if (dbImageColumnEnabled) {
        payload.image_url = itemImage || null;
      }

      if (dbLinkedEnabled) {
        payload.booking_id = formData.booking_id || null;
        payload.guest_notified = false;
      }

      const { error } = await supabase.from('lost_found_items').insert([payload]);
      if (error) throw error;

      // Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Registered lost and found item: ${formData.item_name} found at ${formData.found_location}`,
          module: 'Housekeeping'
        });
      } catch (lErr) {
        console.error(lErr);
      }

      toast.success('✓ Lost and found item registered successfully!', { id: toastId });
      setShowAddForm(false);
      setItemImage(null);
      setFormData({
        item_name: '',
        description: '',
        found_location: '',
        room_id: '',
        booking_id: '',
        found_by: '',
        notes: ''
      });
      setRecentOccupant(null);
      fetchLostFoundData();
    } catch (err) {
      console.error(err);
      toast.error(`Registration failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNotifyModal = (item) => {
    setNotifyingItem(item);
    
    // Resolve guest details from linked booking or user profile
    const guestName = item.bookings?.guest_name || (item.bookings?.profiles ? `${item.bookings.profiles.first_name} ${item.bookings.profiles.last_name}` : 'Valued Guest');
    const guestEmail = item.bookings?.guest_email || item.bookings?.profiles?.email || '';
    const guestPhone = item.bookings?.guest_phone || item.bookings?.profiles?.phone || '';
    const roomNum = item.rooms?.room_number || 'your stay suite';
    
    const phone = systemSettings.contact_phone || '08103694837, 08174971881';
    const email = systemSettings.contact_email || 'info@sparklesapartments.com';
    const subject = `Freshland - Found Property Notification (Room ${roomNum})`;
    const message = `Dear ${guestName},\n\nWe hope you had a wonderful stay with us at Freshland.\n\nOur housekeeping team found a "${item.item_name}" (${item.description || 'no extra description details'}) left in Room ${roomNum} shortly after your departure.\n\nPlease contact our Front Office desk at ${phone} or email us at ${email} to arrange collection or delivery of your item.\n\nWarm regards,\nFront Office Operations\nFreshland`;

    setNotificationData({
      channel: 'email',
      recipient_name: guestName,
      recipient_email: guestEmail,
      recipient_phone: guestPhone,
      subject,
      message
    });
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!canNotifyAndSettle) {
      return toast.error("You do not have permission to notify guests.");
    }
    if (!notifyingItem) return;
    
    setIsNotifying(true);
    const toastId = toast.loading('Sending guest notification...');
    
    try {
      // 1. Update guest_notified status
      const { error: lfErr } = await supabase
        .from('lost_found_items')
        .update({ guest_notified: true })
        .eq('id', notifyingItem.id);
        
      if (lfErr) throw lfErr;
      
      // 2. Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Sent lost property notification (${notificationData.channel.toUpperCase()}) to ${notificationData.recipient_name} for item: ${notifyingItem.item_name}`,
          module: 'Lost & Found'
        });
      } catch (lErr) {
        console.error(lErr);
      }
      
      // 3. Simulated API callback for email dispatch
      if (notificationData.channel === 'email' && notificationData.recipient_email) {
        try {
          const itemImageHtml = parseItemImage(notifyingItem);
          const API_BASE = import.meta.env.VITE_API_URL || '/api';
          await fetch(`${API_BASE}/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: notificationData.recipient_email,
              subject: notificationData.subject,
              html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 2px solid #0d9488;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.05em;">Freshland</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                  <h2 style="color: #0d9488; margin-top: 0; font-size: 18px;">Found Property Alert</h2>
                  <p style="white-space: pre-line; color: #475569; font-size: 14px;">${notificationData.message.replace(/\n/g, '<br>')}</p>
                  ${itemImageHtml ? `
                  <div style="margin-top: 24px; text-align: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #f8fafc;">
                    <p style="margin-top: 0; font-size: 12px; font-weight: bold; color: #64748b;">ATTACHED PROPERTY PHOTO</p>
                    <img src="${itemImageHtml}" alt="Lost Item Image" style="max-width: 100%; max-height: 250px; border-radius: 6px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
                  </div>
                  ` : ''}
                </div>
                <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-t: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8;">
                  This is an automated operational notification regarding items collected from your suite stay.
                </div>
              </div>`
            })
          });
        } catch (emailErr) {
          console.warn('Real email dispatcher deferred (mock mode fallback).', emailErr);
        }
      }
      
      toast.success(`✓ Notification logged & simulated successfully via ${notificationData.channel.toUpperCase()}!`, { id: toastId });
      setNotifyingItem(null);
      fetchLostFoundData();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to send notification: ${err.message}`, { id: toastId });
    } finally {
      setIsNotifying(false);
    }
  };

  const handleSettleClaim = async (e) => {
    e.preventDefault();
    if (!canNotifyAndSettle) {
      return toast.error("You do not have permission to settle claims.");
    }
    if (!claimData.claimant_name || !claimData.claimant_phone) {
      return toast.error('Please enter claimant\'s name and phone number.');
    }

    setIsClaiming(true);
    const toastId = toast.loading('Processing item claim settlement...');

    try {
      const { error } = await supabase
        .from('lost_found_items')
        .update({
          status: 'claimed',
          claimant_name: claimData.claimant_name,
          claimant_phone: claimData.claimant_phone,
          claimed_date: new Date().toISOString().split('T')[0],
          notes: claimingItem.notes ? `${claimingItem.notes} | Claimed: ${claimData.claimant_name}` : `Claimed by ${claimData.claimant_name}`
        })
        .eq('id', claimingItem.id);

      if (error) throw error;

      // Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Settled claimed lost item: ${claimingItem.item_name} claimed by ${claimData.claimant_name}`,
          module: 'Housekeeping'
        });
      } catch (lErr) {
        console.error(lErr);
      }

      toast.success('✓ Lost item successfully returned and claimed!', { id: toastId });
      setClaimingItem(null);
      setClaimData({ claimant_name: '', claimant_phone: '' });
      fetchLostFoundData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process claim', { id: toastId });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleDisposeItem = async (itemId) => {
    if (!canDispose) {
      return toast.error("You do not have permission to dispose items.");
    }
    if (!window.confirm("Are you sure you want to mark this item as disposed/donated? This updates its state permanently.")) return;
    
    const loadingToast = toast.loading("Updating item status to disposed...");
    try {
      const { error } = await supabase
        .from('lost_found_items')
        .update({ status: 'disposed' })
        .eq('id', itemId);

      if (error) throw error;
      toast.success("✓ Item successfully marked as disposed/donated!", { id: loadingToast });
      fetchLostFoundData();
    } catch (err) {
      toast.error("Failed to update status", { id: loadingToast });
    }
  };

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            item.found_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.found_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.bookings?.guest_name && item.bookings.guest_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, filterStatus]);

  if (!hasAccess('Lost & Found')) {
    return <div className="p-8 text-center text-gray-300">You do not have permission to view Lost and Found items.</div>;
  }

  return (
    <div className="space-y-6 pb-20 text-white select-none">

      {/* Database Linkage Diagnostic Banner */}
      {!dbLinkedEnabled && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4 text-amber-200 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm">Advanced Guest Linkage Offline</h4>
              <p className="text-xs text-gray-200 mt-0.5">Please execute the database migration file <span className="font-mono text-amber-400">backend/add_lost_found_guest_link.sql</span> in your Supabase SQL editor to link items to guest stays and enable front-office notifications.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-dark-800 border border-dark-700 p-6 flex flex-col md:flex-row justify-between items-center rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-lg flex items-center justify-center text-white shadow-md">
            <SearchCheck size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lost & Found Registry</h1>
            <p className="text-gray-200 mt-1">Register items left behind in hotel suites, track claim statuses, and coordinate settlements.</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-lg"
          >
            <Plus size={18} /> Register Found Item
          </button>
          <button 
            onClick={fetchLostFoundData}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 py-2.5 px-4 rounded-lg text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={16} /> Sync
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-yellow-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Unclaimed Items</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {items.filter(i => i.status === 'unclaimed').length} Item(s)
              </h3>
            </div>
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded"><HelpCircle size={20} /></div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-green-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Returned / Claimed</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {items.filter(i => i.status === 'claimed').length} Item(s)
              </h3>
            </div>
            <div className="p-2 bg-green-500/10 text-green-500 rounded"><CheckCircle size={20} /></div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-gray-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Disposed / Donated</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {items.filter(i => i.status === 'disposed').length} Item(s)
              </h3>
            </div>
            <div className="p-2 bg-gray-500/10 text-gray-200 rounded"><Trash2 size={20} /></div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {!isHousekeeper && (
        <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center shadow-lg">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="text"
              placeholder="Search items by Name, Description, Found By, Guest, or Location..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder-gray-500 text-white outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {['all', 'unclaimed', 'claimed', 'disposed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2.5 rounded-lg border transition-all uppercase tracking-wider select-none ${
                  filterStatus === status 
                    ? 'bg-teal-600/15 border-teal-500/30 text-teal-400' 
                    : 'bg-dark-900 border-dark-700 text-gray-200 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Database Inventory Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-dark-900 border-b border-dark-700 text-gray-200 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Item Name / Linked Guest</th>
                <th className="p-4">Found location</th>
                <th className="p-4">Found Date</th>
                <th className="p-4">Found By</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-300 italic">No lost and found items found matching query filters.</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-dark-700/35 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {parseItemImage(item) && (
                          <img 
                            src={parseItemImage(item)} 
                            alt={item.item_name} 
                            className="w-12 h-12 rounded-lg object-cover border border-dark-600 bg-dark-900 cursor-pointer hover:scale-105 transition-transform shrink-0"
                            onClick={() => {
                              toast((t) => (
                                <div className="flex flex-col items-center gap-2 p-1" onClick={() => toast.dismiss(t.id)}>
                                  <img src={parseItemImage(item)} alt={item.item_name} className="max-w-xs max-h-60 rounded object-contain" />
                                  <span className="font-bold text-xs text-white">{item.item_name}</span>
                                </div>
                              ), { duration: 5000, style: { background: '#1e293b', border: '1px solid #334155' } });
                            }}
                          />
                        )}
                        <div>
                          <p className="font-bold text-white text-sm">{item.item_name}</p>
                          {item.description && <span className="text-xs text-gray-200 block max-w-[240px] truncate mt-0.5">{parseCleanNotes(item.description)}</span>}
                          
                          {/* Linked Guest Stay details */}
                          {dbLinkedEnabled && item.bookings && (
                            <div className="mt-2 bg-teal-950/20 border border-teal-500/20 p-2 rounded-lg inline-flex flex-col gap-0.5 text-left max-w-[200px]">
                              <span className="text-[9px] text-teal-400 font-black uppercase tracking-wider flex items-center gap-1">
                                <User size={10} /> Linked Guest
                              </span>
                              <span className="font-bold text-white text-xs truncate">
                                {item.bookings.guest_name || (item.bookings.profiles ? `${item.bookings.profiles.first_name} ${item.bookings.profiles.last_name}` : 'Valued Guest')}
                              </span>
                              {item.bookings.guest_phone && <span className="text-[10px] text-gray-200 font-mono font-bold">{item.bookings.guest_phone}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-semibold flex items-center gap-1.5">
                        <Building size={14} className="text-teal-500" />
                        {item.found_location} {item.rooms ? `[Room ${item.rooms.room_number}]` : ''}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-200">{item.found_date}</td>
                    <td className="p-4 text-gray-300 font-semibold">{item.found_by}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {item.status === 'unclaimed' && (
                          <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded inline-block">
                            ❓ Unclaimed
                          </span>
                        )}
                        {item.status === 'claimed' && (
                          <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded inline-block">
                            ✓ Claimed
                          </span>
                        )}
                        {item.status === 'disposed' && (
                          <span className="bg-gray-500/10 text-gray-200 border border-gray-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded inline-block">
                            🗑️ Disposed
                          </span>
                        )}
                        
                        {/* Guest notification pill */}
                        {dbLinkedEnabled && item.booking_id && item.status === 'unclaimed' && (
                          item.guest_notified ? (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Bell size={10} /> Notified
                            </span>
                          ) : (
                            <span className="bg-gray-500/10 text-gray-200 border border-gray-500/20 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Bell size={10} /> Pending Alert
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        {item.status === 'unclaimed' ? (
                          <div className="flex flex-wrap gap-2 justify-end">
                            {/* Notify button visible only to operators with permission */}
                            {dbLinkedEnabled && item.booking_id && canNotifyAndSettle && (
                              !item.guest_notified ? (
                                <button 
                                  onClick={() => handleOpenNotifyModal(item)}
                                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-dark-950 font-black text-xs py-1.5 px-3 rounded shadow transition-all flex items-center gap-1"
                                >
                                  <Bell size={13} /> Notify Guest
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleOpenNotifyModal(item)}
                                  className="bg-dark-700 hover:bg-dark-600 border border-dark-600 text-emerald-400 text-xs py-1.5 px-3 rounded transition-all flex items-center gap-1"
                                >
                                  <Mail size={13} /> Alert Again
                                </button>
                              )
                            )}
                            
                            {canNotifyAndSettle && (
                              <button 
                                onClick={() => setClaimingItem(item)}
                                className="bg-green-500 hover:bg-green-600 text-dark-950 font-extrabold text-xs py-1.5 px-3 rounded shadow transition-all flex items-center gap-1"
                              >
                                <CheckCircle size={13} /> Settle Claim
                              </button>
                            )}
                            {canDispose && (
                              <button 
                                onClick={() => handleDisposeItem(item.id)}
                                className="bg-dark-700 hover:bg-red-500/20 hover:text-red-400 text-xs py-1.5 px-3 rounded border border-dark-600 transition-all text-gray-200 font-semibold"
                              >
                                Dispose
                              </button>
                            )}
                          </div>
                        ) : (
                          item.status === 'claimed' ? (
                            <div className="text-xs text-left max-w-[200px] ml-auto">
                              <p className="font-bold text-gray-200 truncate">Recipient: {item.claimant_name}</p>
                              <span className="text-[10px] text-gray-300 block mt-0.5">Settle: {item.claimed_date}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">Disposed / Donated</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: REGISTER ITEM FOUND --- */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PackageOpen className="text-teal-500" /> Register Found Lost Item
              </h2>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleRegisterItem}>
              <div className="p-6 space-y-4">
                
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Found Item Name *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Gold iPhone 15, Black Leather Wallet, Suite keys"
                    value={formData.item_name}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:border-teal-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Item Description / Serial Details</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Cracked screen protector, containing 3 mastercards, or other unique details..."
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-teal-500 min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Found Location */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Found Location *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Under bed, poolside table"
                      value={formData.found_location}
                      onChange={e => setFormData({ ...formData, found_location: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Room Linkage */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Link to Suite Stay</label>
                    <select
                      value={formData.room_id}
                      onChange={e => handleRoomChange(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-teal-500 font-bold"
                    >
                      <option value="">No Suite Linkage</option>
                      {rooms.map(rm => (
                        <option key={rm.id} value={rm.id}>Room {rm.room_number} ({rm.name})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Automated Occupant Resolver Card */}
                {dbLinkedEnabled && (recentOccupant || resolvingOccupant) && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-teal-400 uppercase tracking-widest">Stay Linkage Verification</label>
                    {recentOccupant ? (
                      <div className="bg-teal-950/20 border border-teal-500/25 rounded-lg p-3 text-xs space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between border-b border-teal-500/20 pb-1.5 mb-1.5">
                          <span className="text-teal-400 font-extrabold flex items-center gap-1.5">
                            <User size={13} /> Linked Guest (Latest Occupant)
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            recentOccupant.status === 'checked_in' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {recentOccupant.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-gray-300">
                          <div>
                            <p className="text-[9px] text-gray-300 font-bold uppercase">Name</p>
                            <p className="font-bold text-white">{recentOccupant.guest_name || (recentOccupant.profiles ? `${recentOccupant.profiles.first_name} ${recentOccupant.profiles.last_name}` : 'Guest')}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-300 font-bold uppercase">Stay Dates</p>
                            <p className="font-bold text-white font-mono">{recentOccupant.check_in_date} to {recentOccupant.check_out_date}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-300 font-bold uppercase">Email</p>
                            <p className="font-bold text-white truncate">{recentOccupant.guest_email || recentOccupant.profiles?.email || 'No email registered'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-300 font-bold uppercase">Phone</p>
                            <p className="font-bold text-white font-mono">{recentOccupant.guest_phone || recentOccupant.profiles?.phone || 'No phone registered'}</p>
                          </div>
                        </div>
                      </div>
                    ) : resolvingOccupant ? (
                      <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 flex items-center justify-center gap-2 text-xs text-gray-200">
                        <RefreshCw size={14} className="animate-spin text-teal-500" /> Resolving latest room occupant stay...
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Finder Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Finder's Name (Staff or Guest) *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input 
                      type="text"
                      required
                      readOnly={isHousekeeper}
                      disabled={isHousekeeper}
                      placeholder="e.g. Housekeeper Joy"
                      value={formData.found_by}
                      onChange={e => setFormData({ ...formData, found_by: e.target.value })}
                      className={`w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-4 py-2.5 rounded-lg text-xs font-semibold outline-none focus:border-teal-500 ${
                        isHousekeeper ? 'bg-dark-950/40 text-gray-200 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Administrative Notes</label>
                  <input 
                    type="text"
                    placeholder="e.g. Kept in Reception Locker B"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg text-xs outline-none focus:border-teal-500"
                  />
                </div>

                {/* Found Item Photo Uploader */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-200">Attach Item Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="w-full h-24 border border-dashed border-dark-600 hover:border-teal-500 bg-dark-900 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors p-2">
                        <Plus className="text-gray-300 hover:text-teal-400" size={20} />
                        <span className="text-[10px] text-gray-200 font-bold mt-1">Upload Photo</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden" 
                        />
                      </label>
                    </div>
                    {itemImage && (
                      <div className="relative w-24 h-24 border border-dark-600 rounded-lg overflow-hidden bg-dark-900 shrink-0">
                        <img 
                          src={itemImage} 
                          alt="Thumbnail preview" 
                          className="w-full h-full object-cover" 
                        />
                        <button 
                          type="button"
                          onClick={() => setItemImage(null)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => { setShowAddForm(false); setRecentOccupant(null); }}
                  className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Registering...' : 'Register Item Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: GUEST NOTIFICATION DRAWER / TERMINAL --- */}
      {notifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="text-amber-500 animate-bounce" /> Guest Dispatch Communications
              </h2>
              <button 
                onClick={() => setNotifyingItem(null)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSendNotification}>
              <div className="p-6 space-y-4">
                
                {/* Channel Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1.5">Dispatch Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNotificationData(prev => ({ ...prev, channel: 'email' }))}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-xs font-black transition-all ${
                        notificationData.channel === 'email'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-md'
                          : 'bg-dark-900 border-dark-700 text-gray-200 hover:text-white'
                      }`}
                    >
                      <Mail size={16} /> Send Email Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotificationData(prev => ({ ...prev, channel: 'sms' }))}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-xs font-black transition-all ${
                        notificationData.channel === 'sms'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-md'
                          : 'bg-dark-900 border-dark-700 text-gray-200 hover:text-white'
                      }`}
                    >
                      <MessageSquare size={16} /> Send SMS Dispatch
                    </button>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-2 gap-4 bg-dark-900/50 p-3 rounded-lg border border-dark-700 text-xs">
                  <div>
                    <span className="text-gray-300 font-bold uppercase block text-[9px]">Guest Contact</span>
                    <span className="text-white font-bold">{notificationData.recipient_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-300 font-bold uppercase block text-[9px]">
                      {notificationData.channel === 'email' ? 'Email Address' : 'Phone Number'}
                    </span>
                    <span className="text-teal-400 font-bold truncate block">
                      {notificationData.channel === 'email' 
                        ? (notificationData.recipient_email || 'No email resolved') 
                        : (notificationData.recipient_phone || 'No phone resolved')
                      }
                    </span>
                  </div>
                </div>

                {/* Email Subject (Only visible for Email) */}
                {notificationData.channel === 'email' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Subject Header</label>
                    <input 
                      type="text"
                      required
                      value={notificationData.subject}
                      onChange={e => setNotificationData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Template Message Box */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-200">Customized Template Dispatch Body</label>
                    <span className="text-[9px] bg-dark-700 text-gray-300 font-black px-1.5 py-0.5 rounded">EXECUTIVE STYLED</span>
                  </div>
                  <textarea 
                    required
                    rows={6}
                    value={notificationData.message}
                    onChange={e => setNotificationData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-amber-500 font-sans leading-relaxed"
                  />
                </div>

                {/* Attached Image Preview */}
                {parseItemImage(notifyingItem) && (
                  <div className="bg-dark-900/50 p-3 rounded-lg border border-dark-700 space-y-2">
                    <span className="text-gray-300 font-bold uppercase block text-[9px]">Attached Item Photo</span>
                    <img 
                      src={parseItemImage(notifyingItem)} 
                      alt="Attached Lost Item" 
                      className="max-h-40 rounded-lg mx-auto object-cover border border-dark-600 shadow-md"
                    />
                  </div>
                )}

              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setNotifyingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isNotifying}
                  className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  <Send size={13} /> {isNotifying ? 'Dispatching...' : 'Dispatch Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SETTLE CLAIM --- */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-green-400 animate-pulse" /> Settle Claim & Return Item
              </h2>
              <button 
                onClick={() => setClaimingItem(null)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSettleClaim}>
              <div className="p-6 space-y-4">
                
                {/* Item Details Summary */}
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-bold uppercase">Item Claiming:</span>
                    <span className="text-white font-black text-sm">{claimingItem.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-bold uppercase">Found Location:</span>
                    <span className="text-gray-300 font-semibold">{claimingItem.found_location}</span>
                  </div>
                  {claimingItem.rooms && (
                    <div className="flex justify-between">
                      <span className="text-gray-300 font-bold uppercase">Linked Room:</span>
                      <span className="text-teal-400 font-bold">Suite {claimingItem.rooms.room_number}</span>
                    </div>
                  )}
                </div>

                {/* Claimant Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Claimant Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Guest Emeka Daniel"
                      value={claimData.claimant_name}
                      onChange={e => setClaimData({ ...claimData, claimant_name: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                {/* Claimant Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Claimant Contact Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input 
                      type="text"
                      required
                      placeholder="e.g. +234 803 123 4567"
                      value={claimData.claimant_phone}
                      onChange={e => setClaimData({ ...claimData, claimant_phone: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:border-green-500"
                    />
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setClaimingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isClaiming}
                  className="bg-green-500 hover:bg-green-600 text-dark-950 font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isClaiming ? 'Settling claim...' : 'Confirm Return & Close Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LostFound;
