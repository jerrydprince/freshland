import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  ShoppingCart, Coffee, Utensils, Wine, Plus, Minus, Trash2, 
  Search, Printer, DollarSign, Users, CheckCircle, CreditCard, 
  Lock, Settings, PlusCircle, ChefHat, X, Percent, Clock, Archive,
  AlertTriangle
} from 'lucide-react';
import StoreRequisitionModal from '../../components/admin/StoreRequisitionModal';

const POS = () => {
  const { user, profile, hasAccess } = useAuth();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  
  // States
  const [services, setServices] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@Freshlandhotels.com',
    logo: ''
  });
  
  // Cart & Catalog State
  const [cart, setCart] = useState([]);
  const [outlet, setOutlet] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [billingMode, setBillingMode] = useState('walk-in'); // 'walk-in' or 'room'
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'pos', 'paystack'
  
  // Room Charge State
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [chargeToGroup, setChargeToGroup] = useState(false);

  // Add Custom Item Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    base_price_ngn: '',
    outlet: 'bar'
  });

  // Receipt / Print Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);
  const printRef = useRef();

  // Close of Day states
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [isCloseOfDayModalOpen, setIsCloseOfDayModalOpen] = useState(false);
  const [closeOfDayReport, setCloseOfDayReport] = useState(null);
  const [isCompilingCloseOfDay, setIsCompilingCloseOfDay] = useState(false);

  const isOutletClosed = useMemo(() => {
    if (!outlet) return false;
    return departmentalClosures.some(c => c.department === outlet && c.business_date === todayStr);
  }, [departmentalClosures, outlet, todayStr]);

  // Unified Order History State
  const [posView, setPosView] = useState('order'); // 'order' or 'history'
  const [isRequisitionOpen, setIsRequisitionOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 1. Resolve Access Levels & Lock Assigned Outlets
  // A super_admin gets all outlets, other staff gets outlets from their pos_outlets array
  const staffOutlets = useMemo(() => {
    if (user?.role === 'super_admin') {
      return ['bar', 'restaurant'];
    }
    const outlets = (profile?.pos_outlets || user?.pos_outlets || []).filter(o => o.toLowerCase().trim() !== 'kitchen');
    return outlets.map(o => o.toLowerCase().trim());
  }, [user, profile]);

  const hasAccessToAny = staffOutlets.length > 0;

  const isManagerOrAdmin = useMemo(() => {
    return hasAccess('POS - Manage Menu Items & Custom Pricing');
  }, [hasAccess]);

  // Editing state for updating/deleting catalog items
  const [editingService, setEditingService] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    base_price_ngn: ''
  });

  const handleOpenEditModal = (e, product) => {
    e.stopPropagation(); // Prevent adding to cart
    if (!isManagerOrAdmin) return toast.error("Unauthorized. Only managers and admins can modify menu items.");
    setEditingService(product);
    setEditFormData({
      name: product.name,
      description: product.description || '',
      base_price_ngn: product.base_price_ngn
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (isOutletClosed) {
      return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
    }
    if (!isManagerOrAdmin) return toast.error("Unauthorized.");
    if (!editFormData.name || !editFormData.base_price_ngn || Number(editFormData.base_price_ngn) <= 0) {
      return toast.error("Please fill in valid name and price");
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({
          name: editFormData.name,
          description: editFormData.description,
          base_price_ngn: Number(editFormData.base_price_ngn)
        })
        .eq('id', editingService.id);

      if (error) throw error;
      toast.success(`✓ Menu item "${editFormData.name}" updated successfully!`);
      setIsEditModalOpen(false);
      setEditingService(null);
      fetchPOSData();
    } catch (err) {
      console.error("Error updating F&B item:", err);
      toast.error("Failed to update menu item.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteItem = async () => {
    if (isOutletClosed) {
      return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
    }
    if (!isManagerOrAdmin) return toast.error("Unauthorized.");
    if (!window.confirm(`Are you sure you want to delete "${editingService.name}"? This cannot be undone.`)) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', editingService.id);

      if (error) throw error;
      toast.success(`✓ Menu item deleted successfully!`);
      setIsEditModalOpen(false);
      setEditingService(null);
      fetchPOSData();
    } catch (err) {
      console.error("Error deleting F&B item:", err);
      toast.error("Failed to delete item. It may be linked to transaction history.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Set default outlet upon loading based on assigned access
  useEffect(() => {
    if (staffOutlets.length > 0) {
      setOutlet(staffOutlets[0]);
    }
  }, [staffOutlets]);

  // Clear cart whenever active outlet terminal changes (Bar cannot sell kitchen items, etc.)
  useEffect(() => {
    setCart([]);
  }, [outlet]);

  // Fetch F&B services and checked-in guests
  useEffect(() => {
    if (hasAccessToAny) {
      fetchPOSData();
      fetchClosures();
    }
  }, [hasAccessToAny]);

  useRealtimeSync(['bookings', 'services', 'system_settings'], (table) => {
    if (hasAccessToAny) {
      fetchPOSData(false);
      if (table === 'system_settings') {
        fetchClosures();
      }
    }
  });

  const fetchClosures = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      if (data && data.setting_value) {
        setDepartmentalClosures(typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value);
      }
    } catch (err) {
      console.warn("Failed to fetch closures in Bar POS:", err);
    }
  };

  const handleCompileCloseOfDayBar = async () => {
    setIsCompilingCloseOfDay(true);
    const toastId = toast.loading("Compiling today's Bar transactions...");
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch payments for today
      const { data: payments, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      // 2. Fetch completed booking services for today
      const { data: bs, error: bsErr } = await supabase
        .from('booking_services')
        .select('*, bookings(rooms(room_number), guest_name, booking_reference), services(name, category, internal_notes)')
        .eq('status', 'completed');
      if (bsErr) throw bsErr;

      // Filter walk-in payments (prefix POS-BAR-)
      const walkinTxns = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && p.transaction_ref?.startsWith('POS-BAR-');
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref,
        description: p.notes || 'POS Walk-in Bar Sale',
        amount: Number(p.amount),
        method: p.method
      }));

      // Filter in-house charges
      const inhouseTxns = (bs || []).filter(item => {
        const dStr = format(new Date(item.updated_at || item.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && item.services?.internal_notes?.toLowerCase() === 'bar' && (item.notes === 'pos_charge' || item.notes === 'pos_charge_group');
      }).map(i => ({
        time: format(new Date(i.updated_at), 'HH:mm'),
        ref: i.bookings?.booking_reference || 'IN-HOUSE',
        description: `Room ${i.bookings?.rooms?.room_number || 'N/A'} Folio Charge - ${i.services?.name || 'F&B Item'} (x${i.quantity || 1})`,
        amount: Number(i.total_price_ngn || 0),
        method: i.payment_status === 'paid' ? 'corporate_billed' : 'room_charge'
      }));

      const allTxns = [...walkinTxns, ...inhouseTxns];
      const totalRev = allTxns.reduce((sum, t) => sum + t.amount, 0);

      setCloseOfDayReport({
        business_date: todayStr,
        walkin_txns: walkinTxns,
        inhouse_txns: inhouseTxns,
        total_walkin_revenue: walkinTxns.reduce((sum, t) => sum + t.amount, 0),
        total_inhouse_revenue: inhouseTxns.reduce((sum, t) => sum + t.amount, 0),
        total_revenue: totalRev,
        total_count: allTxns.length
      });

      toast.dismiss(toastId);
      setIsCloseOfDayModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile Close of Day metrics: " + err.message, { id: toastId });
    } finally {
      setIsCompilingCloseOfDay(false);
    }
  };

  const handleConfirmCloseOfDayBar = async () => {
    if (!closeOfDayReport) return;
    const toastId = toast.loading("Closing day and saving reports...");
    try {
      const todayStr = closeOfDayReport.business_date;

      const closureRecord = {
        department: 'bar',
        business_date: todayStr,
        staff_id: profile?.id || 'unknown',
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        closed_at: new Date().toISOString()
      };

      let currentClosures = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_closures').maybeSingle();
        if (data && data.setting_value) {
          currentClosures = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedClosures = [...currentClosures, closureRecord];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });

      // Save detailed reports
      const reportRecord = {
        id: `dept_close_bar_${todayStr}`,
        department: 'bar',
        business_date: todayStr,
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        closed_at: new Date().toISOString(),
        total_revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        details: {
          walkin_revenue: closeOfDayReport.total_walkin_revenue,
          inhouse_revenue: closeOfDayReport.total_inhouse_revenue
        },
        transactions: [
          ...closeOfDayReport.walkin_txns.map(t => ({ ...t, type: 'POS Walk-in Sale' })),
          ...closeOfDayReport.inhouse_txns.map(t => ({ ...t, type: 'In-house Folio Charge' }))
        ]
      };

      let currentReports = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_close_reports').maybeSingle();
        if (data && data.setting_value) {
          currentReports = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedReports = [reportRecord, ...currentReports];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });

      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Closed departmental ledger for BAR on date ${todayStr}. Revenue: ₦${closeOfDayReport.total_revenue.toLocaleString()}`,
        module: 'Accounting'
      });

      toast.success("✓ Bar close of day completed successfully!", { id: toastId });
      setIsCloseOfDayModalOpen(false);
      setDepartmentalClosures(updatedClosures);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close business day: " + err.message, { id: toastId });
    }
  };

  const handleViewHistoryReceipt = (txn) => {
    const sub = txn.amount / 1.075; // compute subtotal backward
    const vat = txn.amount - sub;
    
    const receiptItems = txn.type === 'Walk-in Sale' ? [
      {
        id: 'pos-sale-item',
        name: `${outlet.toUpperCase()} Service Order`,
        base_price_ngn: sub,
        quantity: 1
      }
    ] : txn.items;

    setActiveReceipt({
      txnRef: txn.reference,
      date: format(new Date(txn.date), 'yyyy-MM-dd HH:mm'),
      outlet,
      items: receiptItems,
      subtotal: sub,
      taxAmount: vat,
      grandTotal: txn.amount,
      mode: txn.type === 'Walk-in Sale' ? 'Walk-in Customer' : `Room Charge`,
      method: txn.method,
      servedBy: txn.servedBy || user?.name || user?.email,
      guestName: txn.type === 'Walk-in Sale' ? null : txn.customer.split(' - ')[1] || txn.customer,
      bookingRef: txn.type === 'Walk-in Sale' ? null : txn.reference
    });
  };

  const fetchOrderHistory = async () => {
    setHistoryLoading(true);
    try {
      // 1. Fetch walk-in payments and room charges in parallel
      const [payRes, bsRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .ilike('transaction_ref', `POS-${outlet.toUpperCase()}-%`)
          .order('processed_at', { ascending: false })
          .limit(40),
        supabase
          .from('booking_services')
          .select('*, bookings(id, booking_reference, guest_name, rooms(room_number), profiles(first_name, last_name, email)), services(*)')
          .eq('notes', 'pos_charge')
          .order('created_at', { ascending: false })
      ]);

      if (payRes.error) throw payRes.error;
      if (bsRes.error) throw bsRes.error;

      const payData = payRes.data;
      const bsData = bsRes.data;

      // Filter in JS by service outlet internal_notes
      const outletRoomCharges = (bsData || []).filter(item => 
        item.services?.internal_notes?.toLowerCase() === outlet
      );

      // Group room charges within 5 seconds window
      const groupedChargesMap = {};
      outletRoomCharges.forEach(item => {
        const timeKey = Math.floor(new Date(item.created_at).getTime() / 5000); // 5-second grouping
        const key = `${item.booking_id}-${timeKey}`;
        if (!groupedChargesMap[key]) {
          groupedChargesMap[key] = {
            id: key,
            date: item.created_at,
            type: 'Room Charge',
            reference: item.bookings?.booking_reference || 'RM-CHARGE',
            customer: `Room ${item.bookings?.rooms?.room_number || 'N/A'} - ${item.bookings?.guest_name || 'In-House'}`,
            method: 'ROOM STAY FOLIO',
            amount: 0,
            items: [],
            servedBy: item.bookings?.profiles?.first_name ? `${item.bookings.profiles.first_name} ${item.bookings.profiles.last_name}` : 'Front Desk'
          };
        }
        groupedChargesMap[key].items.push({
          id: item.service_id,
          name: item.services?.name || 'F&B Item',
          base_price_ngn: Number(item.unit_price_ngn),
          quantity: item.quantity
        });
        groupedChargesMap[key].amount += Number(item.total_price_ngn);
      });

      const groupedRoomCharges = Object.values(groupedChargesMap);

      // Map walk-in payments
      const resolvedWalkIns = (payData || []).map(p => {
        return {
          id: p.id,
          date: p.processed_at || p.created_at,
          type: 'Walk-in Sale',
          reference: p.transaction_ref,
          customer: 'Walk-in Customer',
          method: p.method.toUpperCase(),
          amount: Number(p.amount),
          items: [],
          servedBy: 'POS Terminal'
        };
      });

      // Combine and Sort
      const sortedHistory = [
        ...resolvedWalkIns,
        ...groupedRoomCharges
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistoryList(sortedHistory);
    } catch (err) {
      console.error("Error loading POS transaction log:", err);
      toast.error("Failed to load order history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo']);
        
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email,
          logo: settingsMap.contact_logo || prev.logo
        }));
      }
    } catch (e) {
      console.error("Failed to load contact settings:", e);
    }
  };

  const fetchPOSData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch dynamic contact settings, services, and checked-in guests in parallel
      const [settingsRes, servicesRes, guestsRes] = await Promise.all([
        supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo']),
        supabase
          .from('services')
          .select('*')
          .eq('category', 'Food & Beverage')
          .eq('is_active', true),
        supabase
          .from('bookings')
          .select('*, profiles(first_name, last_name, phone), rooms(room_number, name), group_accounts(id, name)')
          .eq('status', 'checked_in')
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (guestsRes.error) throw guestsRes.error;

      // Map settings
      const settingsMap = (settingsRes.data || []).reduce((acc, curr) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});
      
      setContactInfo(prev => ({
        address: settingsMap.contact_address || prev.address,
        phone: settingsMap.contact_phone || prev.phone,
        email: settingsMap.contact_email || prev.email,
        logo: settingsMap.contact_logo || prev.logo
      }));

      setServices(servicesRes.data || []);
      setGuests(guestsRes.data || []);
    } catch (err) {
      console.error("Error loading POS records:", err);
      toast.error("Failed to load point of sale services");
    } finally {
      setLoading(false);
    }
  };

  // Filter products by outlet and search query
  const filteredProducts = useMemo(() => {
    return services.filter(p => {
      const matchOutlet = p.internal_notes?.toLowerCase() === outlet;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchOutlet && matchSearch;
    });
  }, [services, outlet, searchQuery]);

  // Filter checked-in guests for searchable dropdown
  const filteredGuests = useMemo(() => {
    if (!guestSearch) return guests;
    return guests.filter(g => {
      const name = `${g.guest_name || ''} ${g.profiles?.first_name || ''} ${g.profiles?.last_name || ''}`.toLowerCase();
      const roomNum = g.rooms?.room_number?.toLowerCase() || '';
      const refNum = g.booking_reference?.toLowerCase() || '';
      return name.includes(guestSearch.toLowerCase()) || 
             roomNum.includes(guestSearch.toLowerCase()) ||
             refNum.includes(guestSearch.toLowerCase());
    });
  }, [guests, guestSearch]);

  // Cart operations
  const addToCart = (product) => {
    if (isOutletClosed) {
      toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} added to cart`, { duration: 1000 });
  };

  const updateQuantity = (id, delta) => {
    if (isOutletClosed) {
      toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
      return;
    }
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    if (isOutletClosed) {
      toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
      return;
    }
    setCart(cart.filter(item => item.id !== id));
    toast.success("Item removed from cart");
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.base_price_ngn * item.quantity), 0);
  }, [cart]);

  const taxRate = 0.075; // 7.5% VAT
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  // Add dynamic menu item handler (Comments requirement)
  const handleAddCustomItem = async (e) => {
    e.preventDefault();
    if (isOutletClosed) {
      return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
    }
    if (!isManagerOrAdmin) {
      return toast.error("Unauthorized. Only managers and admins can add catalog items.");
    }
    if (!newService.name || !newService.base_price_ngn || Number(newService.base_price_ngn) <= 0) {
      return toast.error("Please fill in valid name and price");
    }

    setIsProcessing(true);
    try {
      const payload = {
        name: newService.name,
        description: newService.description || "Freshly added item from POS terminal.",
        category: "Food & Beverage",
        base_price_ngn: Number(newService.base_price_ngn),
        pricing_type: "fixed",
        is_active: true,
        internal_notes: newService.outlet || outlet
      };

      const { data, error } = await supabase.from('services').insert([payload]).select();
      if (error) throw error;

      toast.success(`✓ Service "${newService.name}" created successfully!`);
      setIsAddModalOpen(false);
      setNewService({ name: '', description: '', base_price_ngn: '', outlet: outlet });
      fetchPOSData();
    } catch (err) {
      console.error("Error creating F&B item:", err);
      toast.error("Failed to register new food or beverage item.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Checkout Execution
  const handleCheckout = async () => {
    if (isOutletClosed) {
      return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
    }
    if (cart.length === 0) {
      return toast.error("Your cart is empty");
    }

    if (billingMode === 'room' && !selectedGuest) {
      return toast.error("Please select a checked-in guest suite to charge");
    }

    setIsProcessing(true);
    const txnRef = `POS-${outlet.toUpperCase()}-${billingMode === 'room' ? 'ROOM' : paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    try {
      if (billingMode === 'walk-in') {
        // Build detailed items list for journal entry notes
        const itemsListStr = cart.map(item => `${item.name} x${item.quantity}`).join(', ');

        // --- Walk-in Flow ---
        // 1. Record direct financial payment inflow in 'payments' table
        const { error: payErr } = await supabase.from('payments').insert([{
          amount: grandTotal,
          method: paymentMethod,
          status: 'completed',
          transaction_ref: txnRef,
          notes: `POS Direct Walk-in Sale - ${outlet.charAt(0).toUpperCase() + outlet.slice(1)} | Items: [${itemsListStr}]`
        }]);

        if (payErr) throw payErr;

        toast.success(`Walk-in sale settled! Grand Total: ₦${grandTotal.toLocaleString()}`);
        
        // Load active receipt view
        setActiveReceipt({
          txnRef,
          date: format(new Date(), 'yyyy-MM-dd HH:mm'),
          outlet,
          items: [...cart],
          subtotal,
          taxAmount,
          grandTotal,
          mode: 'Walk-in Customer',
          method: paymentMethod.toUpperCase(),
          servedBy: user?.name || user?.email
        });

        // Reset Cart
        setCart([]);
      } else {
        // --- Charge to Room Folio Flow ---
        const isBilledToGroup = selectedGuest.group_account_id && chargeToGroup;

        // Loop through each cart item and insert as a completed service
        for (const item of cart) {
          const { error: srvErr } = await supabase.from('booking_services').insert([{
            booking_id: selectedGuest.id,
            service_id: item.id,
            quantity: item.quantity,
            unit_price_ngn: item.base_price_ngn,
            total_price_ngn: item.base_price_ngn * item.quantity,
            notes: isBilledToGroup ? `pos_charge_group` : `pos_charge`, // pos_charge_group bypasses check-out folio holds
            status: 'completed',
            payment_status: isBilledToGroup ? 'paid' : 'unpaid' // If billed to group, it's considered resolved on individual folio
          }]);

          if (srvErr) throw srvErr;
        }

        if (isBilledToGroup) {
          // Increment group account outstanding balance
          const { data: groupAcc } = await supabase.from('group_accounts').select('outstanding_balance').eq('id', selectedGuest.group_account_id).single();
          const currentOutstanding = Number(groupAcc?.outstanding_balance || 0);
          await supabase.from('group_accounts').update({ outstanding_balance: currentOutstanding + grandTotal }).eq('id', selectedGuest.group_account_id);
          
          // Log payment inflow under method 'corporate_billed' so it registers in P&L ledger reports
          await supabase.from('payments').insert([{
            booking_id: selectedGuest.id,
            amount: grandTotal,
            method: 'corporate_billed',
            status: 'completed',
            notes: `POS Corporate Charge - ${outlet.toUpperCase()} | Billed to Group: ${selectedGuest.group_accounts?.name || 'Company'} | Room ${selectedGuest.rooms?.room_number} | Items: ${cart.map(item => `${item.name} x${item.quantity}`).join(', ')}`,
            transaction_ref: `CORP-CHG-${outlet.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`
          }]);

          toast.success(`Charged ₦${grandTotal.toLocaleString()} successfully to Corporate Group "${selectedGuest.group_accounts?.name}"!`);
        } else {
          toast.success(`Charged ₦${grandTotal.toLocaleString()} successfully to Room ${selectedGuest.rooms?.room_number}! Check-out locked until cleared.`);
        }

        // Load active receipt view
        setActiveReceipt({
          txnRef,
          date: format(new Date(), 'yyyy-MM-dd HH:mm'),
          outlet,
          items: [...cart],
          subtotal,
          taxAmount,
          grandTotal,
          mode: isBilledToGroup 
            ? `Corporate Charge - ${selectedGuest.group_accounts?.name}` 
            : `Room Folio Charge - Room ${selectedGuest.rooms?.room_number}`,
          guestName: selectedGuest.guest_name || `${selectedGuest.profiles?.first_name} ${selectedGuest.profiles?.last_name}`,
          bookingRef: selectedGuest.booking_reference,
          servedBy: user?.name || user?.email
        });

        // Reset Cart & Selection States
        setCart([]);
        setSelectedGuest(null);
        setGuestSearch('');
        setChargeToGroup(false);
      }
    } catch (err) {
      console.error("Checkout execution failure:", err);
      toast.error("POS transaction checkout failed. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger print action for thermal roll receipt
  const triggerPrintReceipt = () => {
    window.print();
  };

  // Render Access Denied if staff has no POS outlet permissions
  if (!hasAccessToAny) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel max-w-md w-full p-8 border border-red-500/20 rounded-3xl shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">POS Access Restricted</h2>
          <p className="text-gray-200 text-sm mb-6 leading-relaxed">
            Your staff account is currently not assigned to any Point of Sale (POS) outlet. 
            You must be assigned to the Bar or Restaurant in order to process hospitality orders.
          </p>
          <div className="w-full bg-dark-800 rounded-xl p-4 text-xs text-left text-gray-300 border border-dark-700/50">
            <p className="font-semibold text-gray-200 mb-1">To Resolve This:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Navigate to <strong>Staff & Roles</strong> under the Admin menu.</li>
              <li>Edit your profile under the directory list.</li>
              <li>Select your permitted outlets under <strong>POS Outlet Assignments</strong>.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {isOutletClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-red-500/5 animate-pulse mb-6">
          <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">{outlet === 'bar' ? 'Bar' : 'Restaurant'} Ledger Closed for Today</h4>
            <p className="text-xs text-red-300/95 mt-0.5 font-medium">
              All {outlet === 'bar' ? 'Bar' : 'Restaurant'} operations including cart item additions, service menu modifications, custom F&B creations, and payment checkouts (walk-in and suite charges) are locked. Contact an authorized manager to re-open the ledger.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header & Outlet Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <ShoppingCart className="text-brand-500" />
            Hospitality Point of Sale (POS)
          </h1>
          <p className="text-gray-200 text-sm">
            Process direct walk-in payments or charge stay enhancements to in-house suites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {outlet === 'bar' && (() => {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const closure = departmentalClosures.find(c => c.department === 'bar' && c.business_date === todayStr);
            return closure ? (
              <div className="bg-green-500/10 text-green-400 border border-green-500/25 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span>Closed today by {closure.staff_name}</span>
              </div>
            ) : (
              <button 
                onClick={handleCompileCloseOfDayBar}
                disabled={isCompilingCloseOfDay}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-dark-950 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Clock size={14} />
                <span>Close of Day</span>
              </button>
            );
          })()}
          {hasAccess('Store Keeping - Log Requisitions') && (
            <button 
              onClick={() => setIsRequisitionOpen(true)} 
              className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2"
            >
              <Archive size={14} />
              <span>Store Requisition</span>
            </button>
          )}
          {/* Toggle between Order Catalog and Order History */}
          <div className="flex bg-dark-800 p-1.5 rounded-2xl border border-dark-700/60 shadow-lg">
            <button 
              onClick={() => setPosView('order')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${posView === 'order' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-200 hover:text-white'}`}
            >
              <ShoppingCart size={14} />
              <span>New Order</span>
            </button>
            <button 
              onClick={() => {
                setPosView('history');
                fetchOrderHistory();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${posView === 'history' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-200 hover:text-white'}`}
            >
              <Clock size={14} />
              <span>Order History</span>
            </button>
          </div>

          {/* Dynamic Outlets Toggle (Filters to assigned outlets only) */}
          <div className="flex bg-dark-800 p-1.5 rounded-2xl border border-dark-700/60 shadow-lg">
            {staffOutlets.includes('bar') && (
              <button 
                onClick={() => {
                  setOutlet('bar');
                  if (posView === 'history') setTimeout(fetchOrderHistory, 50);
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${outlet === 'bar' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-200 hover:text-white'}`}
              >
                <Wine size={14} />
                <span>Bar</span>
              </button>
            )}
            {staffOutlets.includes('restaurant') && (
              <button 
                onClick={() => {
                  setOutlet('restaurant');
                  if (posView === 'history') setTimeout(fetchOrderHistory, 50);
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${outlet === 'restaurant' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-200 hover:text-white'}`}
              >
                <Utensils size={14} />
                <span>Restaurant</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 2. Conditionally switch workspace view */}
      {posView === 'history' ? (
        /* Order History Log Table View */
        <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4 print:hidden animate-fade-in">
          <div className="flex justify-between items-center border-b border-dark-700/60 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Clock className="text-brand-500" />
                Historic Sales & Receipts Log ({outlet.toUpperCase()})
              </h2>
              <p className="text-gray-300 text-xs mt-1">Review operational log and re-print receipts for walk-in or charged bookings.</p>
            </div>
            <button 
              onClick={fetchOrderHistory} 
              className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white px-4 py-2 border border-brand-500/20 rounded-xl text-xs font-bold transition-all"
            >
              Refresh Log
            </button>
          </div>

          {historyLoading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-300 text-sm">Retrieving historic receipts log...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-24 text-center text-gray-300">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
              <p className="text-sm">No sales transactions processed today under the {outlet} POS.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-dark-700 bg-dark-900/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-bold">Timestamp</th>
                    <th className="p-4 font-bold">Transaction Ref</th>
                    <th className="p-4 font-bold">Order Type</th>
                    <th className="p-4 font-bold">Customer Account</th>
                    <th className="p-4 font-bold">Settlement</th>
                    <th className="p-4 font-bold">Grand Total</th>
                    <th className="p-4 font-bold text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {historyList.map(item => (
                    <tr key={item.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-200 text-xs font-mono">
                        {format(new Date(item.date), 'MMM dd, HH:mm')}
                      </td>
                      <td className="p-4 text-white font-bold font-mono text-xs">
                        {item.reference}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${item.type === 'Walk-in Sale' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300 font-medium text-xs">
                        {item.customer}
                      </td>
                      <td className="p-4 text-gray-200 font-extrabold uppercase text-[10px] tracking-wider">
                        {item.method}
                      </td>
                      <td className="p-4 text-white font-black text-xs">
                        ₦{item.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleViewHistoryReceipt(item)}
                          className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white p-2 rounded-lg border border-brand-500/20 transition-all flex items-center gap-1 text-xs font-bold float-right shadow-sm"
                          title="View and re-print receipt"
                        >
                          <Printer size={12} />
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* 2. Grid Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print:hidden">
        
        {/* Left Column: Product Grid & Search */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 text-gray-300 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search food, drinks, or beers in the ${outlet}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700/60 rounded-2xl pl-12 pr-4 py-3 text-white outline-none focus:border-brand-500 transition-all shadow-md"
              />
            </div>
            
            {/* Quick add custom F&B item */}
            {isManagerOrAdmin && (
              <button 
                onClick={() => {
                  if (isOutletClosed) return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
                  setNewService({ ...newService, outlet });
                  setIsAddModalOpen(true);
                }}
                disabled={isOutletClosed}
                className={`border text-brand-400 hover:text-white px-5 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-md ${isOutletClosed ? 'bg-dark-700/50 border-dark-600/30 text-gray-300 cursor-not-allowed opacity-50 hover:bg-dark-700/50' : 'bg-brand-500/10 hover:bg-brand-500 border-brand-500/20'}`}
                title={isOutletClosed ? `${outlet === 'bar' ? 'Bar' : 'Restaurant'} is closed` : "Add a new F&B menu item to the catalog"}
              >
                <PlusCircle size={20} />
                <span className="hidden md:inline">Add Menu Item</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-24">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mb-3"></div>
              <p className="text-gray-300 text-sm">Fetching catalog menu...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
              <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
                <Coffee size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">No products found</h3>
              <p className="text-gray-300 text-sm mb-4">There are no food or beverage items registered under this outlet filter.</p>
              {isManagerOrAdmin && (
                <button 
                  onClick={() => {
                    if (isOutletClosed) return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
                    setNewService({ ...newService, outlet });
                    setIsAddModalOpen(true);
                  }}
                  disabled={isOutletClosed}
                  className={`px-6 py-2.5 rounded-xl font-bold ${isOutletClosed ? 'bg-dark-700 text-gray-300 cursor-not-allowed opacity-50' : 'btn-primary'}`}
                >
                  Create First Item
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => {
                    if (isOutletClosed) {
                      toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
                      return;
                    }
                    addToCart(product);
                  }}
                  className={`glass-panel border p-5 rounded-2xl transition-all duration-300 flex flex-col justify-between h-48 group relative overflow-hidden ${isOutletClosed ? 'border-dark-700/20 opacity-60 cursor-not-allowed' : 'border-dark-700/40 hover:border-brand-500/40 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5'}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors duration-300" />
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-extrabold text-white group-hover:text-brand-400 transition-colors leading-tight line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isManagerOrAdmin && (
                          <button 
                            onClick={(e) => {
                              if (isOutletClosed) {
                                e.stopPropagation();
                                return toast.error(`${outlet === 'bar' ? 'Bar' : 'Restaurant'} operations are locked due to daily ledger closure.`);
                              }
                              handleOpenEditModal(e, product);
                            }}
                            disabled={isOutletClosed}
                            className={`p-1.5 rounded-lg text-gray-200 transition-all shadow-sm z-10 ${isOutletClosed ? 'bg-dark-800 opacity-50 cursor-not-allowed' : 'bg-dark-800 hover:bg-brand-500 hover:text-white'}`}
                            title="Manage menu item"
                          >
                            <Settings size={14} />
                          </button>
                        )}
                        <div className="p-2 bg-dark-800 rounded-xl text-brand-400">
                          {product.internal_notes?.toLowerCase() === 'bar' ? <Wine size={16} /> : 
                           product.internal_notes?.toLowerCase() === 'restaurant' ? <Utensils size={16} /> : <Coffee size={16} />}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs mt-2 line-clamp-3 leading-relaxed">
                      {product.description || "Premium service selection."}
                    </p>
                  </div>
                  <div className="flex justify-between items-center border-t border-dark-700/30 pt-3 mt-3">
                    <span className="text-base font-black text-white group-hover:scale-105 transition-transform duration-300">
                      ₦{product.base_price_ngn.toLocaleString()}
                    </span>
                    <span className="text-[10px] bg-brand-500/10 text-brand-400 group-hover:bg-brand-500 group-hover:text-white px-2.5 py-1 rounded-lg font-bold transition-all uppercase tracking-wider">
                      Add to Cart
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Checkout Cart Summary */}
        <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl flex flex-col max-h-[85vh] sticky top-24">
          <div className="flex justify-between items-center border-b border-dark-700/60 pb-4 mb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <ShoppingCart className="text-brand-500" size={20} />
              Active Order
            </h2>
            <span className="bg-brand-500/20 text-brand-400 font-bold px-3 py-1 rounded-full text-xs">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
            </span>
          </div>

          {/* Cart Item Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[150px] max-h-[280px]">
            {cart.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center text-gray-300">
                <ShoppingCart size={24} className="mb-2 opacity-30" />
                <p className="text-sm">Click items on the left to build order</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-dark-800/80 border border-dark-700/50 rounded-xl p-3 flex justify-between items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-200">₦{item.base_price_ngn.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-dark-900 rounded-lg p-1 border border-dark-700/30">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-dark-700 text-gray-200 hover:text-white rounded"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold text-white px-1.5">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-dark-700 text-gray-200 hover:text-white rounded"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 hover:bg-red-500/10 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Billing Options Selector */}
          <div className="border-t border-dark-700/60 pt-4 mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-2">
                Order Billing Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-dark-800 p-1 rounded-xl border border-dark-700/50">
                <button 
                  onClick={() => setBillingMode('walk-in')}
                  disabled={isOutletClosed}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isOutletClosed ? 'cursor-not-allowed text-gray-300' : ''} ${billingMode === 'walk-in' ? 'bg-dark-900 text-white border border-dark-700' : 'text-gray-200 hover:text-white'}`}
                >
                  <DollarSign size={14} />
                  Walk-In
                </button>
                <button 
                  onClick={() => setBillingMode('room')}
                  disabled={isOutletClosed}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isOutletClosed ? 'cursor-not-allowed text-gray-300' : ''} ${billingMode === 'room' ? 'bg-dark-900 text-white border border-dark-700' : 'text-gray-200 hover:text-white'}`}
                >
                  <Users size={14} />
                  Charge to Room
                </button>
              </div>
            </div>

            {/* Dynamic Billing Sub-Forms */}
            {billingMode === 'walk-in' ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'pos', 'paystack'].map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-[10px] font-extrabold uppercase border transition-all ${paymentMethod === method ? 'bg-brand-500/10 text-brand-400 border-brand-500/30' : 'bg-dark-800 border-dark-700 text-gray-200 hover:text-white'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 relative">
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Search Checked-in Guest
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-300 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search room number or name..."
                    value={guestSearch}
                    onChange={e => {
                      setGuestSearch(e.target.value);
                      setGuestDropdownOpen(true);
                    }}
                    onFocus={() => setGuestDropdownOpen(true)}
                    className="w-full bg-dark-800 border border-dark-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-brand-500"
                  />
                  
                  {/* Search Dropdown */}
                  {guestDropdownOpen && (
                    <div className="absolute z-50 w-full left-0 bottom-full mb-1 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                      {filteredGuests.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-300">No checked-in guests found</div>
                      ) : (
                        filteredGuests.map(g => (
                          <div 
                            key={g.id}
                            onClick={() => {
                              setSelectedGuest(g);
                              setGuestSearch(`Room ${g.rooms?.room_number} - ${g.guest_name}`);
                              setGuestDropdownOpen(false);
                              setChargeToGroup(false);
                            }}
                            className="p-2 text-xs rounded-lg hover:bg-dark-800 cursor-pointer flex justify-between items-center text-white"
                          >
                            <div>
                              <p className="font-bold">Room {g.rooms?.room_number}</p>
                              <p className="text-[10px] text-gray-200">{g.guest_name}</p>
                            </div>
                            <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-bold uppercase">
                              In-house
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {billingMode === 'room' && selectedGuest && selectedGuest.group_account_id && (
              <div className="bg-dark-900/60 p-4 border border-dark-750 rounded-xl space-y-2 mt-3 animate-in fade-in duration-350">
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                  💼 Group Corporate Billing
                </label>
                <p className="text-[10px] text-gray-200 leading-normal">
                  This guest is part of the corporate group <strong>{selectedGuest.group_accounts?.name || 'Company'}</strong>. Choose checkout target:
                </p>
                <div className="grid grid-cols-2 gap-2 bg-dark-800 p-1 rounded-lg border border-dark-700/50">
                  <button 
                    type="button"
                    onClick={() => setChargeToGroup(false)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${!chargeToGroup ? 'bg-dark-900 text-white border border-dark-700/80 shadow' : 'text-gray-455 hover:text-white'}`}
                  >
                    Room Folio
                  </button>
                  <button 
                    type="button"
                    onClick={() => setChargeToGroup(true)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${chargeToGroup ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-455 hover:text-white'}`}
                  >
                    Group Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Ledger */}
          <div className="border-t border-dark-700/60 pt-4 mt-4 space-y-2 text-xs text-gray-200">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-white">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                VAT <span className="bg-dark-800 px-1 py-0.5 rounded text-[8px] font-bold">7.5%</span>
              </span>
              <span className="font-bold text-white">₦{taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-black text-white pt-2 border-t border-dark-700/30">
              <span>Grand Total</span>
              <span className="text-brand-400">₦{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Complete Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing || isOutletClosed}
            className="w-full bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 disabled:text-gray-300 text-white font-bold py-3 px-4 rounded-xl mt-6 transition-all duration-300 shadow-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
            ) : (
              <>
                <CheckCircle size={18} />
                <span>
                  {billingMode === 'room' ? "Charge to Suite Room" : `Pay ₦${grandTotal.toLocaleString()}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      )}

      {/* 3. ADD NEW F&B PRODUCT MODAL (Requirement: interface to add items) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="glass-panel max-w-md w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-200 hover:text-white rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <PlusCircle size={22} className="text-brand-500" />
              Register New F&B Item
            </h2>
            <p className="text-gray-200 text-xs mb-6">
              This will add a food or beverage service to the standard PMS catalog database.
            </p>

            <form onSubmit={handleAddCustomItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Product/Drink Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapman, Grilled Croaker, Chapman Cocktail"
                  value={newService.name}
                  onChange={e => setNewService({ ...newService, name: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-200 font-bold mb-1.5 uppercase">Price (NGN)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 8000"
                    value={newService.base_price_ngn}
                    onChange={e => setNewService({ ...newService, base_price_ngn: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-200 font-bold mb-1.5 uppercase">Target POS Outlet</label>
                  <select
                    disabled
                    value={outlet}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-gray-200 focus:border-brand-500 outline-none cursor-not-allowed font-semibold uppercase"
                  >
                    <option value={outlet}>Locked to {outlet.toUpperCase()}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Description (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="Describe ingredients, glass size, cooking method..."
                  value={newService.description}
                  onChange={e => setNewService({ ...newService, description: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-3 rounded-xl mt-4 transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Register Menu Item</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. EDIT/DELETE F&B PRODUCT MODAL (Requirement: interface to update/delete items) */}
      {isEditModalOpen && editingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="glass-panel max-w-md w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingService(null);
              }}
              className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-200 hover:text-white rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <Settings size={22} className="text-brand-500" />
              Manage "{editingService.name}"
            </h2>
            <p className="text-gray-200 text-xs mb-6">
              Update details or permanently remove this item from the {outlet.toUpperCase()} catalog.
            </p>

            <form onSubmit={handleUpdateItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Product/Drink Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premium Chapman"
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Price (NGN)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 7500"
                  value={editFormData.base_price_ngn}
                  onChange={e => setEditFormData({ ...editFormData, base_price_ngn: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Description (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="Describe ingredients, glass size, cooking method..."
                  value={editFormData.description}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  disabled={isProcessing}
                  className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 py-3 rounded-xl font-bold transition-all duration-300 shadow flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={16} />
                  Delete Item
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-1.5"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RECEIPT OVERLAY & THERMAL PRINTER STYLING */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:absolute print:inset-0">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative print:border-0 print:bg-white print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            
            {/* Modal Close / Print controls - hidden on physical print */}
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h3 className="font-extrabold text-gray-900 text-base" style={{ color: '#111827' }}>Receipt Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={triggerPrintReceipt}
                  className="p-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center gap-1 text-xs font-bold transition-colors shadow"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button 
                  onClick={() => setActiveReceipt(null)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-300 hover:text-gray-800 rounded-lg transition-colors border border-gray-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Receipt Body: Optimized for Thermal Print via @media print */}
            <div ref={printRef} className="print-receipt bg-white text-black p-4 font-mono text-xs rounded-xl print:p-0 print:m-0 border border-gray-150 shadow-inner" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
              
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3 flex flex-col items-center">
                {contactInfo.logo && (
                  <img src={contactInfo.logo} alt="Freshland Logo" className="max-h-8 object-contain mb-1.5" style={{ filter: 'grayscale(100%) contrast(150%)' }} />
                )}
                <h2 className="text-lg font-black tracking-wider uppercase m-0" style={{ color: '#000000' }}>Freshland</h2>
                <p className="text-[9px] text-gray-300 m-0.5">Luxury Suites & Premium Lounge</p>
                <p className="text-[9px] text-gray-300 m-0">{contactInfo.address}</p>
                <p className="text-[9px] text-gray-300 m-0">{contactInfo.phone}</p>
                <div className="mt-2 text-[10px] font-bold bg-black text-white px-2 py-1 inline-block uppercase rounded">
                  {activeReceipt.outlet.toUpperCase()} OUTLET
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="space-y-1 pb-3 mb-3 border-b border-dashed border-gray-400 text-[10px]">
                <div className="flex justify-between">
                  <span>REF NO:</span>
                  <span className="font-bold">{activeReceipt.txnRef}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{activeReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>BILLING:</span>
                  <span className="font-bold">{activeReceipt.mode}</span>
                </div>
                {activeReceipt.guestName && (
                  <>
                    <div className="flex justify-between">
                      <span>GUEST:</span>
                      <span className="font-bold uppercase">{activeReceipt.guestName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>STAY REF:</span>
                      <span>{activeReceipt.bookingRef}</span>
                    </div>
                  </>
                )}
                {activeReceipt.method && (
                  <div className="flex justify-between">
                    <span>METHOD:</span>
                    <span>{activeReceipt.method}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>SERVED BY:</span>
                  <span>{activeReceipt.servedBy}</span>
                </div>
              </div>

              {/* Items Summary Table */}
              <div className="space-y-2 pb-3 mb-3 border-b border-dashed border-gray-400">
                <div className="grid grid-cols-12 font-bold pb-1 text-[9px] border-b border-gray-300">
                  <span className="col-span-6">ITEM</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-4 text-right">TOTAL</span>
                </div>
                {activeReceipt.items.map(item => (
                  <div key={item.id} className="grid grid-cols-12 text-[10px]">
                    <span className="col-span-6 truncate font-medium">{item.name}</span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right">₦{(item.base_price_ngn * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals Section */}
              <div className="space-y-1 pb-3 mb-3 border-b border-dashed border-gray-400 text-[10px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>₦{activeReceipt.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (7.5%):</span>
                  <span>₦{activeReceipt.taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-dashed border-gray-300 pt-1 mt-1">
                  <span>TOTAL PAID:</span>
                  <span>₦{activeReceipt.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[9px] text-gray-300">
                <p className="m-0 font-bold">THANK YOU FOR YOUR PATRONAGE!</p>
                <p className="m-0 mt-0.5">Please present this receipt upon request.</p>
                <p className="m-0 mt-1 font-serif text-[7px] tracking-widest text-gray-200">LUXE PMS SOFTWARE</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global CSS injection for printing white thermal receipt */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide all other elements in the body */
          body * {
            visibility: hidden !important;
          }
          /* Force standard pure white background and black text on all layout roots during print */
          html, body, #root, #root *, .print-receipt, .print-receipt * {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* Make only the receipt block and its children visible and force solid white background */
          .print-receipt, .print-receipt * {
            visibility: visible !important;
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Position the receipt at the top left of the page */
          .print-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            background-color: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          /* Ensure HTML and Body don't clip the printed page height */
          html, body {
            background: white !important;
            background-color: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}} />

      {/* --- Store Requisition Modal --- */}
      <StoreRequisitionModal 
        isOpen={isRequisitionOpen} 
        onClose={() => setIsRequisitionOpen(false)} 
        department={outlet || 'kitchen'}
      />

      {/* --- MODAL: CLOSE OF DAY --- */}
      {isCloseOfDayModalOpen && closeOfDayReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-dark-800 rounded-3xl border border-dark-700 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8 text-white">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-900 rounded-t-3xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Bar POS - Close of Day Verification
              </h2>
              <button 
                onClick={() => setIsCloseOfDayModalOpen(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Consolidated Revenue</span>
                  <span className="text-2xl font-black text-white">₦{closeOfDayReport.total_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">{closeOfDayReport.total_count} total transactions</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">POS Walk-in Revenue</span>
                  <span className="text-2xl font-black text-brand-500">₦{closeOfDayReport.total_walkin_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">{closeOfDayReport.walkin_txns.length} walk-in cash/card receipts</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">In-house Room Revenue</span>
                  <span className="text-2xl font-black text-blue-400">₦{closeOfDayReport.total_inhouse_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">{closeOfDayReport.inhouse_txns.length} stay folio charges</span>
                </div>
              </div>

              {/* POS Walk-ins */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <Coffee size={14} />
                  POS Walk-In Sales Receipts
                </h3>
                {closeOfDayReport.walkin_txns.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No walk-in sales recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Reference</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.walkin_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{t.ref}</td>
                            <td className="py-2.5 px-3">{t.description}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-dark-900 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-700 uppercase">
                                {t.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₦{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* In-house Folio Charges */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <Users size={14} />
                  In-House Suite Stay Folio Charges (Bar)
                </h3>
                {closeOfDayReport.inhouse_txns.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No in-house guest bar charges recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Booking Ref</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.inhouse_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{t.ref}</td>
                            <td className="py-2.5 px-3">{t.description}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-dark-900 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-700 uppercase">
                                {t.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₦{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900 flex justify-end gap-3 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsCloseOfDayModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmCloseOfDayBar}
                className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black text-xs py-2.5 px-6 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirm Close of Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
