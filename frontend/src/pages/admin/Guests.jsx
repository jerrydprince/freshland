import React, { useState, useEffect, useMemo } from 'react';
import { Search, Mail, Phone, MapPin, MoreVertical, Star, X, Plus, Crown, Wallet, Clock, CheckCircle, MessageSquare, Edit, Send, LayoutGrid, List, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PaginationControl = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-dark-700 bg-dark-900/30 px-4 py-3 sm:px-6 mt-4 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="relative ml-3 inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-200">
            Showing <span className="font-semibold text-white">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
            <span className="font-semibold text-white">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-white">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-200 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Previous</span>
              &larr;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-3 py-2 text-xs font-bold ring-1 ring-inset ring-dark-750 cursor-pointer ${
                  page === currentPage
                    ? 'z-10 bg-brand-500 text-dark-950 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 font-extrabold'
                    : 'text-gray-300 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-450 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Next</span>
              &rarr;
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
import toast from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const secondarySupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
import { optimizeImage } from '../../utils/imageOptimizer';
import { sendWelcomeEmail, sendResendEmail, sendSMSNotification } from '../../lib/emailService';


const AdminGuests = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [guests, setGuests] = useState([]);
  const [currentPageGuests, setCurrentPageGuests] = useState(1);
  const [currentPageGroups, setCurrentPageGroups] = useState(1);
  const [currentPageAR, setCurrentPageAR] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'card' or 'list'
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, bookings, financials, communications
  
  const [newGuest, setNewGuest] = useState({
    firstName: '', lastName: '', email: '', phone: '', nationality: '', segment: 'standard', vipStatus: false
  });

  // Comms
  const [commsLogs, setCommsLogs] = useState([]);
  const [commMessage, setCommMessage] = useState('');
  const [commType, setCommType] = useState('email');
  
  // Bookings
  const [guestBookings, setGuestBookings] = useState([]);

  // AR statement states
  const [arStatement, setArStatement] = useState([]);
  const [loadingARStatement, setLoadingARStatement] = useState(false);
  const [arAccounts, setArAccounts] = useState([]);

  // Guest login profile credentials tab states
  const [guestProfile, setGuestProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetActive, setResetActive] = useState(true);
  const [provisionPassword, setProvisionPassword] = useState('LuxeGuest123!');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showProvisionPassword, setShowProvisionPassword] = useState(false);

  // Prepayment Wallet Add Funds States
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addFundsMethod, setAddFundsMethod] = useState('cash');
  const [addFundsRef, setAddFundsRef] = useState('');
  const [isProcessingAddFunds, setIsProcessingAddFunds] = useState(false);

  // Group Booking / Corporate CRM States
  const [parentTab, setParentTab] = useState('standard');
  const [broadcastChannel, setBroadcastChannel] = useState('email');
  const [broadcastSegment, setBroadcastSegment] = useState('all');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0 });
  const [broadcastConsoleLogs, setBroadcastConsoleLogs] = useState([]);
  const broadcastActiveRef = React.useRef(false);
  const [groupAccounts, setGroupAccounts] = useState([]);
  const [closedGroupAccounts, setClosedGroupAccounts] = useState([]);
  const [deactivatedGroupAccounts, setDeactivatedGroupAccounts] = useState([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [activePaymentGroup, setActivePaymentGroup] = useState(null);
  const [groupPaymentAmount, setGroupPaymentAmount] = useState('');
  const [groupPaymentMethod, setGroupPaymentMethod] = useState('bank_transfer');
  const [groupPaymentRef, setGroupPaymentRef] = useState('');
  const [isProcessingGroupPayment, setIsProcessingGroupPayment] = useState(false);

  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    group_type: 'Company',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    credit_limit: 1000000.00
  });

  // Loyalty Points States
  const [loyaltySettings, setLoyaltySettings] = useState({
    points_per_night: 10,
    points_per_booking: 50,
    points_per_spend_amount: 5,
    spend_unit_amount: 10000,
    redemption_rate: 100,
    min_points_to_redeem: 50,
    frequent_tier_threshold: 200,
    vip_tier_threshold: 500
  });
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState('');
  const [isProcessingRedeem, setIsProcessingRedeem] = useState(false);

  const fetchLoyaltySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'loyalty_settings')
        .maybeSingle();
      if (error) throw error;
      if (data && data.setting_value) {
        setLoyaltySettings(typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value);
      }
    } catch (err) {
      console.warn("Failed to load loyalty settings:", err);
    }
  };

  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@Freshlandhotels.com',
    logo: ''
  });

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

  useEffect(() => {
    setCurrentPageGuests(1);
  }, [searchTerm, viewMode]);

  useEffect(() => {
    setCurrentPageGroups(1);
  }, [groupSearchTerm]);

  useEffect(() => {
    setCurrentPageAR(1);
  }, [selectedGuest]);

  useEffect(() => {
    fetchGuests();
    fetchGroupAccounts();
    fetchARAccounts();
    fetchGroupStatuses();
    fetchLoyaltySettings();
    fetchContactSettings();
  }, []);

  const fetchGroupStatuses = async () => {
    try {
      const { data: closedData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'closed_group_accounts').maybeSingle();
      if (closedData && closedData.setting_value) {
        setClosedGroupAccounts(closedData.setting_value);
      } else {
        const local = localStorage.getItem('closed_group_accounts');
        setClosedGroupAccounts(local ? JSON.parse(local) : []);
      }
    } catch {
      const local = localStorage.getItem('closed_group_accounts');
      setClosedGroupAccounts(local ? JSON.parse(local) : []);
    }

    try {
      const { data: deactData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'deactivated_group_accounts').maybeSingle();
      if (deactData && deactData.setting_value) {
        setDeactivatedGroupAccounts(deactData.setting_value);
      } else {
        const local = localStorage.getItem('deactivated_group_accounts');
        setDeactivatedGroupAccounts(local ? JSON.parse(local) : []);
      }
    } catch {
      const local = localStorage.getItem('deactivated_group_accounts');
      setDeactivatedGroupAccounts(local ? JSON.parse(local) : []);
    }
  };

  const saveGroupStatuses = async (closedList, deactivatedList) => {
    setClosedGroupAccounts(closedList);
    setDeactivatedGroupAccounts(deactivatedList);
    localStorage.setItem('closed_group_accounts', JSON.stringify(closedList));
    localStorage.setItem('deactivated_group_accounts', JSON.stringify(deactivatedList));
    try {
      await supabase.from('system_settings').upsert({ setting_key: 'closed_group_accounts', setting_value: closedList }, { onConflict: 'setting_key' });
    } catch (e) {
      console.warn("Failed to persist closed group accounts:", e);
    }
    try {
      await supabase.from('system_settings').upsert({ setting_key: 'deactivated_group_accounts', setting_value: deactivatedList }, { onConflict: 'setting_key' });
    } catch (e) {
      console.warn("Failed to persist deactivated group accounts:", e);
    }
  };

  const handleUpdateGroupStatus = async (groupId, newStatus) => {
    let closedList = [...closedGroupAccounts];
    let deactivatedList = [...deactivatedGroupAccounts];

    // Remove from both lists first
    closedList = closedList.filter(id => id !== groupId);
    deactivatedList = deactivatedList.filter(id => id !== groupId);

    if (newStatus === 'closed') {
      closedList.push(groupId);
      toast.success("Group Account Closed Successfully!");
    } else if (newStatus === 'inactive' || newStatus === 'deactivated') {
      deactivatedList.push(groupId);
      toast.success("Group Account Deactivated Successfully!");
    } else if (newStatus === 'active') {
      toast.success("Group Account Reopened Successfully!");
    }

    await saveGroupStatuses(closedList, deactivatedList);
  };

  const fetchARAccounts = async () => {
    try {
      const { data, error } = await supabase.from('ar_accounts').select('*');
      if (error) throw error;
      setArAccounts(data || []);
    } catch (e) {
      try {
        const { data: sysData } = await supabase.from('system_settings').select('*').eq('setting_key', 'ar_accounts').maybeSingle();
        if (sysData && sysData.setting_value) {
          const parsed = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
          setArAccounts(parsed || []);
        } else {
          const local = localStorage.getItem('luxe_ar_accounts');
          setArAccounts(local ? JSON.parse(local) : []);
        }
      } catch (err) {
        setArAccounts([]);
      }
    }
  };

  const fetchGroupAccounts = async () => {
    setGroupLoading(true);
    try {
      const { data, error } = await supabase.from('group_accounts').select('*').order('name');
      if (error) throw error;
      setGroupAccounts(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load group accounts');
    } finally {
      setGroupLoading(false);
    }
  };

  const handleAddGroupAccount = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return toast.error("Group name is required");
    try {
      const { error } = await supabase.from('group_accounts').insert([{
        name: newGroupForm.name.trim(),
        group_type: newGroupForm.group_type,
        contact_name: newGroupForm.contact_name.trim(),
        contact_email: newGroupForm.contact_email.toLowerCase().trim(),
        contact_phone: newGroupForm.contact_phone.trim(),
        credit_limit: Number(newGroupForm.credit_limit) || 1000000.00,
        outstanding_balance: 0.00
      }]);

      if (error) throw error;

      toast.success(`Group "${newGroupForm.name}" created successfully!`);
      setIsAddGroupOpen(false);
      setNewGroupForm({ name: '', group_type: 'Company', contact_name: '', contact_email: '', contact_phone: '', credit_limit: 1000000.00 });
      fetchGroupAccounts();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create group account');
    }
  };

  const handleRecordGroupPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentGroup) return;
    const amount = Number(groupPaymentAmount);
    if (amount <= 0) return toast.error("Invalid payment amount");
    
    setIsProcessingGroupPayment(true);
    const toastId = toast.loading('Recording group payment and settling balance...');
    try {
      const newBalance = Math.max(0, Number(activePaymentGroup.outstanding_balance) - amount);
      const { error: groupError } = await supabase
        .from('group_accounts')
        .update({ outstanding_balance: newBalance })
        .eq('id', activePaymentGroup.id);
      
      if (groupError) throw groupError;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          booking_id: null,
          amount: amount,
          method: groupPaymentMethod,
          status: 'completed',
          notes: `Direct corporate debt payout settlement recorded for group: ${activePaymentGroup.name} (Ref: ${groupPaymentRef || 'N/A'})`,
          transaction_ref: `CORP-PAY-${groupPaymentMethod.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`
        }]);

      if (paymentError) {
        console.warn("Failed to log payment to system ledger, but balance was updated:", paymentError);
      }

      toast.success(`Payment of ₦${amount.toLocaleString()} recorded. Outstanding balance updated to ₦${newBalance.toLocaleString()}`, { id: toastId });
      
      setActivePaymentGroup(null);
      setGroupPaymentAmount('');
      setGroupPaymentRef('');
      fetchGroupAccounts();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to process group payment', { id: toastId });
    } finally {
      setIsProcessingGroupPayment(false);
    }
  };



  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!selectedGuest) return toast.error("No guest selected");
    const arAcc = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
    const walletStatus = arAcc?.status || 'active';
    if (walletStatus !== 'active') {
      return toast.error(`Prepayment wallet is ${walletStatus}. Deposit is blocked.`);
    }
    const amount = Number(addFundsAmount);
    if (amount <= 0) return toast.error("Please enter a valid amount");

    setIsProcessingAddFunds(true);
    const toastId = toast.loading(`Adding ₦${amount.toLocaleString()} to ${selectedGuest.first_name}'s wallet...`);
    try {
      const currentBalance = Number(selectedGuest.wallet_balance || 0);
      const newBalance = currentBalance + amount;
      
      // 1. Update wallet_balance in crm_guests
      const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', selectedGuest.id);
      if (crmErr) throw crmErr;

      // 2. Insert into ar_accounts (with fallback)
      const targetWallet = {
        id: arAcc ? arAcc.id : ('ar_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        guest_id: selectedGuest.id,
        guest_name: `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim() || selectedGuest.guest_name || 'Unnamed Guest',
        guest_email: selectedGuest.email || 'N/A',
        balance: newBalance,
        status: walletStatus,
        created_at: arAcc ? arAcc.created_at : new Date().toISOString()
      };

      let updatedAR;
      if (arAcc) {
        updatedAR = arAccounts.map(acc => 
          acc.guest_id === selectedGuest.id ? targetWallet : acc
        );
      } else {
        updatedAR = [...arAccounts, targetWallet];
      }

      try {
        const { error: arErr } = await supabase.from('ar_accounts').upsert([targetWallet]);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts update/insert fallback, table missing:", arErr.message);
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings on deposit:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      // 3. Insert payment ledger entry
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: null,
          amount: amount,
          currency: 'NGN',
          method: addFundsMethod,
          status: 'completed',
          is_refund: false,
          transaction_ref: `AR-DEP-${addFundsMethod.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`,
          notes: `AR Prepayment Wallet Deposit logged via CRM Guests Directory (Method: ${addFundsMethod.toUpperCase()}, Ref: ${addFundsRef || 'N/A'}) for guest: ${selectedGuest.first_name} ${selectedGuest.last_name} (${selectedGuest.email || 'N/A'})`
        }]);
      if (payErr) console.warn("Failed to log prepayment deposit to payments table:", payErr.message);

      toast.success(`₦${amount.toLocaleString()} successfully added to ${selectedGuest.first_name}'s wallet!`, { id: toastId });
      
      // Reset and close
      setIsAddFundsOpen(false);
      setAddFundsAmount('');
      setAddFundsRef('');
      
      // Update selected guest state and reload
      setSelectedGuest(prev => ({ ...prev, wallet_balance: newBalance }));
      fetchGuests();
      fetchARAccounts();
    } catch (err) {
      console.error(err);
      toast.error(`Deposit failed: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingAddFunds(false);
    }
  };

  useEffect(() => {
    if (selectedGuest && activeTab === 'communications') {
      fetchComms(selectedGuest.id);
    }
    if (selectedGuest && activeTab === 'bookings') {
      fetchGuestBookings(selectedGuest.id);
    }
    if (selectedGuest && activeTab === 'account') {
      fetchGuestProfile(selectedGuest.profile_id, selectedGuest.email);
    }
  }, [selectedGuest, activeTab]);

  const fetchGuestProfile = async (profileId, email) => {
    setProfileLoading(true);
    setResetEmail(email || '');
    setResetPassword('');
    setShowResetPassword(false);
    setShowProvisionPassword(false);
    setResetActive(true);
    setGuestProfile(null);
    try {
      let data = null;
      if (profileId) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
        data = prof;
      }
      if (!data && email) {
        // Fallback: search profile by email
        const { data: prof } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
        data = prof;
      }
      if (data) {
        setGuestProfile(data);
        setResetEmail(data.email || '');
        setResetActive(data.is_active !== false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateGuestCredentials = async (e) => {
    e.preventDefault();
    if (!guestProfile) return;
    setProfileLoading(true);
    const toastId = toast.loading('Updating guest login account...');
    try {
      // 1. Update profiles table basic details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          email: resetEmail.toLowerCase(),
          is_active: resetActive
        })
        .eq('id', guestProfile.id);

      if (profileError) throw profileError;

      // 2. Call the RPC to securely update auth credentials
      const { error: rpcError } = await supabase.rpc('admin_update_staff_auth', {
        target_user_id: guestProfile.id,
        new_email: resetEmail.toLowerCase(),
        new_password: resetPassword || null,
        new_is_active: resetActive
      });

      if (rpcError) throw rpcError;

      toast.success('Guest credentials updated successfully!', { id: toastId });
      fetchGuestProfile(guestProfile.id, resetEmail);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update credentials: ${err.message}`, { id: toastId });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProvisionGuestAccount = async (e) => {
    e.preventDefault();
    if (!selectedGuest) return;
    if (!selectedGuest.email) return toast.error('Guest email is required to provision account.');
    setProfileLoading(true);
    const toastId = toast.loading('Provisioning new guest account...');
    try {
      let newUserId = null;
      let isNewAccount = false;

      // 1. SignUp in background using secondary supabase client
      try {
        const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
          email: selectedGuest.email.toLowerCase(),
          password: provisionPassword
        });

        if (authError) {
          // Check if already registered
          if (authError.message?.toLowerCase().includes('already') || authError.status === 400 || authError.status === 422) {
            // Background query profiles table
            const { data: existingProf, error: queryError } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', selectedGuest.email.toLowerCase())
              .maybeSingle();

            if (queryError) throw queryError;
            if (existingProf) {
              newUserId = existingProf.id;
            } else {
              throw authError; // Re-throw if no profile exists
            }
          } else {
            throw authError;
          }
        } else {
          newUserId = authData?.user?.id;
          isNewAccount = true;
        }
      } catch (signUpErr) {
        // Double check profiles lookup in case signUp threw completely
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', selectedGuest.email.toLowerCase())
          .maybeSingle();

        if (existingProf) {
          newUserId = existingProf.id;
        } else {
          throw signUpErr;
        }
      }

      if (!newUserId) throw new Error("Failed to create or resolve credentials.");

      // 2. Insert row in profiles table with role 'guest'
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: newUserId,
        first_name: selectedGuest.first_name,
        last_name: selectedGuest.last_name,
        email: selectedGuest.email.toLowerCase(),
        phone: selectedGuest.phone || '',
        role: 'guest',
        is_active: true
      });

      if (profileError) throw profileError;

      // 3. Confirm email automatically
      try {
        await supabase.rpc('admin_confirm_user_email', { target_user_id: newUserId });
      } catch (confirmErr) {
        console.warn("Failed to confirm guest email:", confirmErr);
      }

      // 4. Link profile_id in crm_guests
      const { error: crmLinkError } = await supabase
        .from('crm_guests')
        .update({ profile_id: newUserId })
        .eq('id', selectedGuest.id);

      if (crmLinkError) throw crmLinkError;

      // Send welcome email if new account
      if (isNewAccount) {
        try {
          await sendWelcomeEmail({
            email: selectedGuest.email.toLowerCase(),
            firstName: selectedGuest.first_name,
            lastName: selectedGuest.last_name,
            password: provisionPassword
          });
        } catch (emailErr) {
          console.warn("Failed to send welcome email:", emailErr);
        }
      }

      toast.success(`Account successfully provisioned or linked! Profile connected.`, { id: toastId, duration: 8000 });
      
      // Update selected guest state and reload
      setSelectedGuest(prev => ({ ...prev, profile_id: newUserId }));
      fetchGuests();
      fetchGuestProfile(newUserId, selectedGuest.email);
    } catch (err) {
      console.error(err);
      toast.error(`Provision failed: ${err.message}`, { id: toastId });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUploadIDDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("File size exceeds 5MB limit.");
    }

    const toastId = toast.loading("Processing and uploading document...");
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        let base64Data = event.target.result;
        
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          try {
            base64Data = await optimizeImage(base64Data, 1000, 1000, 0.7);
          } catch (optErr) {
            console.warn("Failed to optimize document image:", optErr);
          }
        }
        
        const { error } = await supabase
          .from('crm_guests')
          .update({ id_document_url: base64Data })
          .eq('id', selectedGuest.id);

        if (error) throw error;

        toast.success("ID/Passport document successfully uploaded and registered!", { id: toastId });
        setSelectedGuest(prev => ({ ...prev, id_document_url: base64Data }));
        fetchGuests();
      };
      
      reader.onerror = () => {
        throw new Error("Failed to read file.");
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${err.message || 'Error occurred'}`, { id: toastId });
    }
  };

  const fetchGuests = async () => {
    setLoading(true);
    const { data } = await supabase.from('crm_guests').select('*').order('created_at', { ascending: false });
    if (data) setGuests(data);
    setLoading(false);
  };

  const fetchComms = async (id) => {
    const { data } = await supabase.from('communication_logs').select('*').eq('crm_guest_id', id).order('sent_at', { ascending: false });
    setCommsLogs(data || []);
  };

  const fetchGuestBookings = async (id) => {
    const { data } = await supabase.from('bookings').select('*, rooms(name)').eq('crm_guest_id', id).order('created_at', { ascending: false });
    setGuestBookings(data || []);
  };

  useEffect(() => {
    const fetchARStatement = async () => {
      if (!selectedGuest || activeTab !== 'financials' || selectedGuest.wallet_balance === null || selectedGuest.wallet_balance === undefined) {
        setArStatement([]);
        return;
      }
      setLoadingARStatement(true);
      try {
        const email = (selectedGuest.email || '').toLowerCase().trim();
        
        // 1. Fetch all booking IDs associated with this guest first
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('id')
          .eq('crm_guest_id', selectedGuest.id);
        const bookingIds = bookingsData ? bookingsData.map(b => b.id) : [];

        // 2. Fetch payments list to reconcile statement (filtered to this guest)
        let paymentsData = [];
        try {
          let paymentsQuery = supabase
            .from('payments')
            .select('*, bookings(guest_name, total_amount_ngn)');

          const guestFullName = `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.replace(/\s+/g, ' ').trim();
          const orFilters = [`notes.ilike.%${email}%`];
          if (guestFullName) {
            orFilters.push(`notes.ilike.%${guestFullName}%`);
          }
          if (bookingIds.length > 0) {
            orFilters.push(`booking_id.in.(${bookingIds.map(id => `"${id}"`).join(',')})`);
          }
          paymentsQuery = paymentsQuery.or(orFilters.join(','));
          
          const { data: pData, error: payError } = await paymentsQuery;
          if (payError) throw payError;
          paymentsData = pData || [];
        } catch (payErr) {
          console.error("Failed to fetch payments:", payErr);
        }

        // 3. Fetch completed booking services (POS and Laundry folio charges) for this guest's bookings only
        let folioPOSCharges = [];
        let folioLaundryCharges = [];
        if (bookingIds.length > 0) {
          try {
            const { data: bsData, error: bsError } = await supabase
              .from('booking_services')
              .select('*, bookings(booking_reference, guest_name, rooms(room_number)), services(name, category, internal_notes)')
              .eq('status', 'completed')
              .in('booking_id', bookingIds);
            
            if (bsError) throw bsError;
            
            if (bsData) {
              folioPOSCharges = bsData.filter(bs => 
                (bs.notes === 'pos_charge' || 
                 (bs.services?.internal_notes?.toLowerCase() === 'restaurant' && bs.notes?.startsWith('restaurant_order:'))) &&
                bs.payment_status !== 'paid'
              );
              folioLaundryCharges = bsData.filter(bs => 
                (bs.services?.category?.toLowerCase() === 'laundry' || 
                bs.services?.name?.toLowerCase()?.includes('laundry') ||
                (bs.notes && (bs.notes.startsWith('laundry_') || bs.notes.includes('laundry_completed')))) &&
                bs.payment_status !== 'paid'
              );
            }
          } catch (bsErr) {
            console.warn("Failed to fetch booking_services room POS/Laundry charges:", bsErr);
          }
        }

        let resolvedInflows = [];
        if (paymentsData && paymentsData.length > 0) {
          resolvedInflows = paymentsData.map(p => {
            const isPOS = p.transaction_ref?.startsWith('POS-') || 
                          p.transaction_ref?.startsWith('CORP-CHG-') || 
                          p.notes?.includes('POS Direct Walk-in Sale') || 
                          p.notes?.toLowerCase().includes('pos walk-in') ||
                          p.notes?.toLowerCase().includes('pos corporate charge') ||
                          p.notes?.toLowerCase().includes('restaurant room service') ||
                          p.notes?.toLowerCase().includes('corporate charge');
            const isLaundry = p.transaction_ref?.startsWith('LDY-') || p.notes?.toLowerCase().includes('laundry');
            const isARDeposit = p.transaction_ref?.startsWith('AR-DEP-') || 
                                p.notes?.toLowerCase().includes('deposit') || 
                                p.notes?.toLowerCase().includes('deposited') || 
                                p.notes?.toLowerCase().includes('initial ar wallet') ||
                                p.notes?.toLowerCase().includes('prepayment wallet deposit') ||
                                p.notes?.toLowerCase().includes('ar prepayment wallet deposit');
            const isAR = p.method === 'ar' || p.method === 'ar_wallet' || p.method === 'ar_prepayment_wallet' ||
                         p.notes?.toLowerCase().includes('ar prepayment') ||
                         p.notes?.toLowerCase().includes('ar wallet') ||
                         p.notes?.toLowerCase().includes('prepayment wallet');
            return {
              id: p.id,
              date: p.processed_at || p.created_at,
              amount: Number(p.amount),
              description: isLaundry
                ? p.notes || `Walk-in Laundry direct sale settled via ${p.method?.toUpperCase()}`
                : (isPOS 
                  ? p.notes || `POS Walk-in Sale settled via ${p.method?.toUpperCase()}`
                  : (p.is_refund === true
                    ? p.notes || "AR Prepayment Wallet Refund"
                    : (isARDeposit
                      ? p.notes || `AR Prepayment Wallet Deposit`
                      : `Guest Booking Payment - ${p.bookings?.guest_name || 'Confirmed Guest'}`))),
              method: isAR ? 'ar' : p.method,
              status: p.status,
              type: 'inflow',
              booking_id: p.booking_id,
              notes: p.notes || '',
              category: isLaundry ? 'Laundry Revenue' : (isPOS ? 'POS Revenue' : 'Booking Revenue'),
              is_refund: p.is_refund
            };
          });
        }

        if (folioPOSCharges && folioPOSCharges.length > 0) {
          const resolveFolioInflows = folioPOSCharges.map(bs => ({
            id: bs.id,
            date: bs.created_at,
            amount: Number(bs.total_price_ngn),
            description: `POS Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'F&B Service'} (x${bs.quantity})`,
            method: 'room_charge',
            status: 'completed',
            type: 'inflow',
            notes: `Guest: ${bs.bookings?.guest_name || 'In-House'}`,
            category: 'POS Revenue'
          }));
          resolvedInflows = [...resolvedInflows, ...resolveFolioInflows];
        }

        if (folioLaundryCharges && folioLaundryCharges.length > 0) {
          const resolveFolioLaundry = folioLaundryCharges.map(bs => ({
            id: bs.id,
            date: bs.created_at,
            amount: Number(bs.total_price_ngn),
            description: `Laundry Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'Laundry Service'} (x${bs.quantity})`,
            method: 'room_charge',
            status: 'completed',
            type: 'inflow',
            notes: `Guest: ${bs.bookings?.guest_name || 'In-House'} | Items: ${bs.notes?.replace('laundry_completed:', '').replace('laundry_charge:', '').trim() || 'N/A'}`,
            category: 'Laundry Revenue'
          }));
          resolvedInflows = [...resolvedInflows, ...resolveFolioLaundry];
        }

        const guestFullName = `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.toLowerCase().trim();
        const nameParts = guestFullName.split(/\s+/).filter(part => part.length > 2);

        const statement = resolvedInflows.filter(inf => {
          const desc = (inf.description || '').toLowerCase();
          const notes = (inf.notes || '').toLowerCase();
          
          const matchesEmail = email && (desc.includes(email) || notes.includes(email));
          const matchesName = desc.includes(guestFullName) || notes.includes(guestFullName) || 
                              (nameParts.length > 0 && nameParts.every(part => desc.includes(part) || notes.includes(part)));
          
          const matchesARMethod = inf.method === 'ar_prepayment_wallet' || inf.method === 'ar_wallet' || inf.method === 'ar' ||
                                  desc.includes('ar prepayment') || notes.includes('ar prepayment') ||
                                  desc.includes('ar wallet') || notes.includes('ar wallet') ||
                                  notes.includes('ar prepayment wallet') || notes.includes('prepayment wallet');
          
          const isDeposit = (desc.includes('deposit') || notes.includes('deposit') || desc.includes('deposited') || notes.includes('deposited') || notes.includes('initial ar wallet') || desc.includes('refund') || notes.includes('refund') || desc.includes('refunded') || notes.includes('refunded') || desc.includes('credit') || notes.includes('credit') || inf.is_refund === true) && (matchesName || matchesEmail);
          const isDeduction = !isDeposit && matchesARMethod && (matchesName || matchesEmail);
          
          return isDeposit || isDeduction;
        });

        // Format items and compute running balance chronologically
        const formatted = statement.map(rec => {
          const descLower = (rec.description || '').toLowerCase();
          const notesLower = (rec.notes || '').toLowerCase();
          const isDeposit = descLower.includes('deposit') || notesLower.includes('deposit') || descLower.includes('deposited') || notesLower.includes('deposited') || notesLower.includes('initial ar wallet') || descLower.includes('refund') || notesLower.includes('refund') || descLower.includes('refunded') || notesLower.includes('refunded') || descLower.includes('credit') || notesLower.includes('credit') || rec.is_refund === true;
          return {
            id: rec.id,
            date: rec.date,
            description: rec.description,
            notes: rec.notes,
            method: rec.method,
            type: isDeposit ? 'credit' : 'debit',
            amount: Number(rec.amount || 0)
          };
        }).sort((a, b) => {
          const dateDiff = new Date(a.date) - new Date(b.date);
          if (dateDiff !== 0) return dateDiff;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Add running balance
        let runningBal = 0;
        const withBal = formatted.map(item => {
          if (item.type === 'credit') {
            runningBal += item.amount;
          } else {
            runningBal -= item.amount;
          }
          return { ...item, running_balance: runningBal };
        }).sort((a, b) => {
          const dateDiff = new Date(b.date) - new Date(a.date);
          if (dateDiff !== 0) return dateDiff;
          return (b.id || '').localeCompare(a.id || '');
        }); // Sort newest first for display

        setArStatement(withBal);
      } catch (err) {
        console.error("Failed to load AR statement in CRM:", err);
      } finally {
        setLoadingARStatement(false);
      }
    };
    
    fetchARStatement();
  }, [selectedGuest, activeTab]);

  const handlePrintStatement = (guest, list) => {
    const tableRows = list.map(rec => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${rec.date ? new Date(rec.date).toLocaleDateString() + ' ' + new Date(rec.date).toLocaleTimeString() : 'N/A'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
          <strong>${rec.description}</strong>
          ${rec.notes ? `<br/><small style="color: #6b7280">${rec.notes}</small>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-family: monospace;">${rec.method?.replace('_', ' ')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
          <span style="font-weight: bold; font-size: 12px; color: ${rec.type === 'credit' ? '#047857' : '#b91c1c'}">
            ${rec.type === 'credit' ? 'DEPOSIT' : 'CHARGE'}
          </span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; color: ${rec.type === 'credit' ? '#047857' : '#b91c1c'}">
          ${rec.type === 'credit' ? '+' : '-'}₦${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold;">
          ₦${rec.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

    const printWindow = window.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Prepayment Wallet Statement - ${guest.first_name} ${guest.last_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { border-bottom: 2px solid #e5e7eb; padding: 12px; text-align: left; font-size: 14px; background-color: #f9fafb; font-weight: bold; color: #374151; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #374151; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 24px; color: #111827; }
            .meta { display: grid; grid-template-cols: 2fr 1fr; gap: 20px; margin-top: 15px; font-size: 14px; }
            .footer { margin-top: 40px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${contactInfo.logo ? `<img src="${contactInfo.logo}" style="max-height: 50px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h1>ACCOUNT STATEMENT</h1>
            <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">Accounts Receivable Prepayment Wallet</div>
          </div>
          
          <div class="meta">
            <div>
              <strong>Guest Details:</strong><br />
              Name: ${guest.first_name} ${guest.last_name}<br />
              Email: ${guest.email || 'N/A'}<br />
              Address: ${contactInfo.address}<br />
              Statement Compiled: ${new Date().toLocaleString()}
            </div>
            <div style="text-align: right;">
              <strong>Account Balance:</strong><br />
              <span style="font-size: 22px; font-weight: 900; color: #047857;">
                ₦${Number(guest.wallet_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Description</th>
                <th>Method</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            Thank you for choosing Freshland.<br />
            For support or billing inquiries, please contact ${contactInfo.email}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('crm_guests').insert([{
      first_name: newGuest.firstName,
      last_name: newGuest.lastName,
      email: newGuest.email,
      phone: newGuest.phone,
      nationality: newGuest.nationality,
      segment: newGuest.segment,
      vip_status: newGuest.vipStatus
    }]);

    if (error) {
      toast.error('Failed to add guest');
    } else {
      toast.success('Guest added successfully');
      setIsAddModalOpen(false);
      setNewGuest({ firstName: '', lastName: '', email: '', phone: '', nationality: '', segment: 'standard', vipStatus: false });
      fetchGuests();
    }
  };

  const handleUpdateGuestARStatus = async (guestId, newStatus) => {
    const wallet = arAccounts.find(acc => acc.guest_id === guestId);
    let updated;
    if (wallet) {
      updated = arAccounts.map(acc => {
        if (acc.guest_id === guestId) {
          return { ...acc, status: newStatus };
        }
        return acc;
      });
    } else {
      const guestObj = selectedGuest?.id === guestId ? selectedGuest : guests.find(g => g.id === guestId);
      const newWallet = {
        id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: guestId,
        guest_name: guestObj ? `${guestObj.first_name || ''} ${guestObj.last_name || ''}`.trim() : 'Unnamed Guest',
        guest_email: guestObj?.email || 'N/A',
        balance: Number(guestObj?.wallet_balance || 0),
        status: newStatus,
        created_at: new Date().toISOString()
      };
      updated = [...arAccounts, newWallet];
    }
    
    setArAccounts(updated);
    localStorage.setItem('luxe_ar_accounts', JSON.stringify(updated));
    try {
      const { error } = await supabase.from('ar_accounts').upsert(updated);
      if (error) throw error;
    } catch (e) {
      try {
        await supabase.from('system_settings').upsert({
          setting_key: 'ar_accounts',
          setting_value: updated
        }, { onConflict: 'setting_key' });
      } catch (sysErr) {
        console.warn("Failed to persist guest AR status:", sysErr);
      }
    }
    toast.success(`AR Prepayment Wallet status set to ${newStatus}`);
    fetchARAccounts();
    fetchGuests();
  };

  const updateWallet = async (amount) => {
    if (!selectedGuest) return;
    const arAcc = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
    const walletStatus = arAcc?.status || 'active';
    if (walletStatus !== 'active') {
      return toast.error(`Wallet operation is blocked because this prepayment account is ${walletStatus}.`);
    }

    const newBalance = Number(selectedGuest.wallet_balance) + amount;
    const { error } = await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', selectedGuest.id);
    if (!error) {
      const isDeposit = amount > 0;
      const absAmount = Math.abs(amount);
      const guestName = `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim() || selectedGuest.guest_name || 'Unnamed Guest';
      
      const targetWallet = {
        id: arAcc ? arAcc.id : ('ar_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        guest_id: selectedGuest.id,
        guest_name: guestName,
        guest_email: selectedGuest.email || 'N/A',
        balance: newBalance,
        status: walletStatus,
        created_at: arAcc ? arAcc.created_at : new Date().toISOString()
      };

      const updatedAR = arAccounts.map(acc => 
        acc.guest_id === selectedGuest.id ? targetWallet : acc
      );

      try {
        const { error: arErr } = await supabase.from('ar_accounts').upsert([targetWallet]);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts update/insert fallback in updateWallet:", arErr.message);
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings in updateWallet:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      try {
        await supabase.from('payments').insert([{
          booking_id: null,
          amount: absAmount,
          method: 'bank_transfer',
          status: 'completed',
          notes: isDeposit 
            ? `Initial AR Wallet Prepayment Deposit logged for guest: ${guestName} (Manual adjustment) (${selectedGuest.email || 'N/A'})`
            : `AR Digital Wallet Charge Deduction of ₦${absAmount.toLocaleString()} for guest: ${guestName} (Manual adjustment) (${selectedGuest.email || 'N/A'})`,
          transaction_ref: isDeposit 
            ? `AR-DEP-MANUAL-${Date.now()}`
            : `AR-DED-MANUAL-${Date.now()}`
        }]);
      } catch (payErr) {
        console.warn("Failed to insert manual wallet adjustment payment entry:", payErr.message);
      }

      toast.success(`Wallet updated by ₦${amount.toLocaleString()}`);
      setSelectedGuest({ ...selectedGuest, wallet_balance: newBalance });
      fetchGuests(); // Update list
      fetchARAccounts();
    } else {
      toast.error('Failed to update wallet');
    }
  };

  const savePreferences = async (e) => {
    e.preventDefault();
    const prefs = e.target.elements.prefs.value;
    try {
      const parsed = JSON.parse(prefs);
      const { error } = await supabase.from('crm_guests').update({ preferences: parsed }).eq('id', selectedGuest.id);
      if (!error) {
        toast.success('Preferences updated');
        setSelectedGuest({ ...selectedGuest, preferences: parsed });
      }
    } catch (err) {
      toast.error('Invalid JSON format');
    }
  };

  const sendCommunication = async (e) => {
    e.preventDefault();
    if (!commMessage) return;
    
    // Log to DB
    const { error } = await supabase.from('communication_logs').insert([{
      crm_guest_id: selectedGuest.id,
      type: commType,
      category: 'custom',
      content: commMessage
    }]);

    if (!error) {
      toast.success(`${commType.toUpperCase()} sent to ${selectedGuest.first_name}`);
      setCommMessage('');
      fetchComms(selectedGuest.id);
    } else {
      toast.error('Failed to send message');
    }
  };

  const handleStartBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastBody.trim()) return toast.error("Broadcast message body cannot be empty.");
    if (broadcastChannel === 'email' && !broadcastSubject.trim()) {
      return toast.error("Email subject is required.");
    }

    let targets = guests;
    if (broadcastSegment === 'vip') {
      targets = guests.filter(g => g.vip_status === true || g.segment === 'vip');
    } else if (broadcastSegment === 'standard') {
      targets = guests.filter(g => g.segment === 'standard');
    } else if (broadcastSegment === 'corporate') {
      targets = guests.filter(g => g.segment === 'corporate');
    }

    if (targets.length === 0) {
      return toast.error("No guests match the selected filter segment.");
    }

    if (!window.confirm(`Are you sure you want to send this broadcast message to ${targets.length} guests?`)) {
      return;
    }

    setBroadcastSending(true);
    broadcastActiveRef.current = true;
    setBroadcastProgress({ current: 0, total: targets.length });
    setBroadcastConsoleLogs([`Starting broadcast dispatch to ${targets.length} recipients...`]);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      if (!broadcastActiveRef.current) {
        break;
      }
      
      const guest = targets[i];
      const guestName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || 'Valued Guest';
      
      setBroadcastConsoleLogs(prev => [...prev, `[${i + 1}/${targets.length}] Sending to ${guestName}...`]);

      let res;
      try {
        if (broadcastChannel === 'email') {
          if (!guest.email) throw new Error("Missing email address");
          
          const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 6px solid #DF6853; border-radius: 12px;">
              <h2 style="color: #000000; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; font-size: 20px;">Freshland</h2>
              <p style="font-size: 15px; line-height: 1.6;">Hello ${guestName},</p>
              <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
                ${broadcastBody.replace(/\{\{guest_name\}\}/g, guestName).replace(/\n/g, '<br/>')}
              </div>
              <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
                <p>This is a broadcast message from Freshland.</p>
                <p>${contactInfo.address} | Phone: ${contactInfo.phone}</p>
              </div>
            </div>
          `;
          
          res = await sendResendEmail({
            to: guest.email,
            subject: broadcastSubject,
            from: 'info@Freshlandhotels.com',
            html: emailHtml
          });
        } else {
          if (!guest.phone) throw new Error("Missing phone number");
          res = await sendSMSNotification({
            to: guest.phone,
            message: broadcastBody.replace(/\{\{guest_name\}\}/g, guestName)
          });
        }

        if (res.success) {
          successCount++;
          await supabase.from('communication_logs').insert([{
            crm_guest_id: guest.id,
            type: broadcastChannel,
            category: 'broadcast',
            content: broadcastBody.replace(/\{\{guest_name\}\}/g, guestName),
            status: 'sent'
          }]);
          setBroadcastConsoleLogs(prev => [...prev, `  ✓ Sent successfully to ${guest.email || guest.phone}`]);
        } else {
          throw new Error(res.error || 'Dispatch error');
        }
      } catch (err) {
        failCount++;
        await supabase.from('communication_logs').insert([{
          crm_guest_id: guest.id,
          type: broadcastChannel,
          category: 'broadcast',
          content: broadcastBody.replace(/\{\{guest_name\}\}/g, guestName),
          status: 'failed'
        }]);
        setBroadcastConsoleLogs(prev => [...prev, `  ❌ Failed for ${guest.email || guest.phone || guestName}: ${err.message}`]);
      }

      setBroadcastProgress(prev => ({ ...prev, current: i + 1 }));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setBroadcastConsoleLogs(prev => [...prev, `Broadcast completed! Sent: ${successCount}, Failed: ${failCount}`]);
    setBroadcastSending(false);
    toast.success(`Broadcast finished! Successfully dispatched ${successCount} messages.`);
  };

  const handleSaveLoyaltySettings = async (e) => {
    e.preventDefault();
    setSavingLoyalty(true);
    const toastId = toast.loading('Saving loyalty program settings...');
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'loyalty_settings',
          setting_value: loyaltySettings
        }, { onConflict: 'setting_key' });
      if (error) throw error;
      toast.success('Loyalty settings updated successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save settings: ${err.message}`, { id: toastId });
    } finally {
      setSavingLoyalty(false);
    }
  };

  const handleRedeemPoints = async (e) => {
    e.preventDefault();
    if (!selectedGuest) return toast.error("No guest selected");
    const pointsToRedeem = Number(redeemPointsAmount);
    if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
      return toast.error("Please enter a valid points amount");
    }
    if (pointsToRedeem < loyaltySettings.min_points_to_redeem) {
      return toast.error(`Minimum redemption threshold is ${loyaltySettings.min_points_to_redeem} points`);
    }
    if (pointsToRedeem > (selectedGuest.loyalty_points || 0)) {
      return toast.error("Insufficient loyalty points");
    }

    setIsProcessingRedeem(true);
    const creditAmount = pointsToRedeem * loyaltySettings.redemption_rate;
    const toastId = toast.loading(`Redeeming ${pointsToRedeem} points for ₦${creditAmount.toLocaleString()}...`);

    try {
      const newPoints = (selectedGuest.loyalty_points || 0) - pointsToRedeem;
      const currentWalletBalance = selectedGuest.wallet_balance !== null && selectedGuest.wallet_balance !== undefined
        ? Number(selectedGuest.wallet_balance)
        : 0;
      const newWalletBalance = currentWalletBalance + creditAmount;

      const { error: crmErr } = await supabase
        .from('crm_guests')
        .update({
          loyalty_points: newPoints,
          wallet_balance: newWalletBalance
        })
        .eq('id', selectedGuest.id);
      if (crmErr) throw crmErr;

      const arAcc = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
      const targetWallet = {
        id: arAcc ? arAcc.id : ('ar_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        guest_id: selectedGuest.id,
        guest_name: `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim() || selectedGuest.guest_name || 'Unnamed Guest',
        guest_email: selectedGuest.email || 'N/A',
        balance: newWalletBalance,
        status: 'active',
        created_at: arAcc ? arAcc.created_at : new Date().toISOString()
      };

      const updatedAR = arAcc 
        ? arAccounts.map(acc => acc.guest_id === selectedGuest.id ? targetWallet : acc)
        : [...arAccounts, targetWallet];

      try {
        const { error: arErr } = await supabase.from('ar_accounts').upsert([targetWallet]);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts update/insert fallback on redemption:", arErr.message);
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings on redemption:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      const transactionRef = `AR-DEP-LOY-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`;
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: null,
          amount: creditAmount,
          currency: 'NGN',
          method: 'ar_prepayment_wallet',
          status: 'completed',
          is_refund: false,
          transaction_ref: transactionRef,
          notes: `Loyalty Points Redemption: Redeemed ${pointsToRedeem} points at 1 Pt = ₦${loyaltySettings.redemption_rate} for guest: ${selectedGuest.first_name} ${selectedGuest.last_name}`
        }]);

      if (payErr) {
        console.warn("Failed to log loyalty redemption payment entry:", payErr.message);
      }

      toast.success(`Successfully redeemed ${pointsToRedeem} points for ₦${creditAmount.toLocaleString()} credit!`, { id: toastId });
      setIsRedeemModalOpen(false);
      setRedeemPointsAmount('');

      setSelectedGuest(prev => ({
        ...prev,
        loyalty_points: newPoints,
        wallet_balance: newWalletBalance
      }));

      fetchGuests();
      fetchARAccounts();
    } catch (err) {
      console.error(err);
      toast.error(`Redemption failed: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingRedeem(false);
    }
  };

  const filteredGuests = guests.filter(g => 
    g.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groupAccounts.filter(g => 
    g.name?.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
    g.group_type?.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
    g.contact_name?.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );

  const paginatedGuests = useMemo(() => {
    const start = (currentPageGuests - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [filteredGuests, currentPageGuests]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPageGroups - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, currentPageGroups]);

  const paginatedARStatement = useMemo(() => {
    const start = (currentPageAR - 1) * pageSize;
    return arStatement.slice(start, start + pageSize);
  }, [arStatement, currentPageAR]);

  return (
    <div className="text-white pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM & Guest Directory</h1>
          <p className="text-gray-200 mt-1">Manage standard guests, loyalty rewards, and corporate group ledgers.</p>
        </div>
        {parentTab === 'standard' ? (
          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary py-2 px-4 flex items-center gap-2"><Plus size={18}/> New Guest</button>
        ) : parentTab === 'corporate' ? (
          <button onClick={() => setIsAddGroupOpen(true)} className="btn-primary py-2 px-4 flex items-center gap-2"><Plus size={18}/> New Group Account</button>
        ) : null}
      </div>

      {/* Parent Tab Selectors */}
      <div className="flex flex-wrap border border-dark-700 bg-dark-900/50 p-1 rounded-lg w-full md:w-fit mb-8 gap-1">
        <button 
          onClick={() => setParentTab('standard')} 
          className={`flex-1 md:flex-none px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${parentTab === 'standard' ? 'bg-brand-500 text-dark-900 shadow-md font-black' : 'text-gray-200 hover:text-white'}`}
        >
          👤 Standard Guests
        </button>
        <button 
          onClick={() => setParentTab('corporate')} 
          className={`flex-1 md:flex-none px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${parentTab === 'corporate' ? 'bg-brand-500 text-dark-900 shadow-md font-black' : 'text-gray-200 hover:text-white'}`}
        >
          🏢 Group & Corporate Accounts
        </button>
        <button 
          onClick={() => setParentTab('loyalty')} 
          className={`flex-1 md:flex-none px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${parentTab === 'loyalty' ? 'bg-brand-500 text-dark-900 shadow-md font-black' : 'text-gray-200 hover:text-white'}`}
        >
          ⭐ Loyalty Rewards Program
        </button>
        <button 
          onClick={() => setParentTab('broadcast')} 
          className={`flex-1 md:flex-none px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${parentTab === 'broadcast' ? 'bg-brand-500 text-dark-900 shadow-md font-black' : 'text-gray-200 hover:text-white'}`}
        >
          💬 Customer Broadcast
        </button>
      </div>

      {parentTab === 'standard' ? (
        <>
          <div className="bg-dark-800 border border-dark-700 p-6 mb-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200" size={18} />
                <input 
                  type="text" 
                  placeholder="Search guests by name or email..." 
                  className="w-full bg-dark-900 border border-dark-700 text-white pl-10 pr-4 py-2 focus:border-brand-500 outline-none rounded transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-dark-900 p-1 border border-dark-700 rounded self-end md:self-auto">
                <button 
                  onClick={() => setViewMode('card')} 
                  className={`p-2 rounded transition-colors ${viewMode === 'card' ? 'bg-brand-500 text-dark-900' : 'text-gray-200 hover:text-white'}`}
                  title="Card View"
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-brand-500 text-dark-900' : 'text-gray-200 hover:text-white'}`}
                  title="List View"
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">Loading CRM data...</div>
          ) : filteredGuests.length === 0 ? (
            <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">No guests found.</div>
          ) : viewMode === 'card' ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedGuests.map((guest) => (
                  <div key={guest.id} className="bg-dark-800 border border-dark-700 p-6 rounded-lg hover:border-brand-500 transition-colors group relative cursor-pointer" onClick={() => { setSelectedGuest(guest); setActiveTab('overview'); }}>
                    
                    {guest.vip_status && (
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-dark-900 shadow-lg" title="VIP Guest">
                        <Crown size={16} />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center text-xl font-bold text-brand-500 uppercase">
                        {guest.first_name?.charAt(0) || 'G'}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{guest.first_name} {guest.last_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded capitalize">{guest.segment}</span>
                          {guest.loyalty_points > 0 && <span className="text-xs text-brand-500 font-medium">{guest.loyalty_points} pts</span>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-sm text-gray-200">
                        <Mail size={16} className="text-gray-300"/> {guest.email || 'No email'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-200">
                        <Phone size={16} className="text-gray-300"/> {guest.phone || 'No phone'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-200">
                        <MapPin size={16} className="text-gray-300"/> {guest.nationality || 'Unspecified'}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-dark-700/50 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-gray-200">
                        <Wallet size={16} className="text-gray-300"/> 
                        {guest.wallet_balance !== null && guest.wallet_balance !== undefined ? (
                          <span>₦{Number(guest.wallet_balance || 0).toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-300 text-xs italic">Inactive</span>
                        )}
                      </div>
                      <span className="text-brand-500 text-sm font-medium group-hover:underline">View 360° Profile →</span>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControl
                currentPage={currentPageGuests}
                totalItems={filteredGuests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPageGuests}
              />
            </div>
          ) : (
            <div>
              <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-dark-900/80 text-gray-200 border-b border-dark-700">
                      <tr>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider">Guest Profile</th>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider">Segment & Loyalty</th>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider">Contact</th>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider">Nationality</th>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider">Wallet Balance</th>
                        <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/50">
                      {paginatedGuests.map((guest) => (
                        <tr 
                          key={guest.id} 
                          onClick={() => { setSelectedGuest(guest); setActiveTab('overview'); }} 
                          className="hover:bg-dark-700/35 cursor-pointer transition-all duration-200 group"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-sm font-bold text-brand-500 uppercase border border-dark-600">
                                {guest.first_name?.charAt(0) || 'G'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                                    {guest.first_name} {guest.last_name}
                                  </span>
                                  {guest.vip_status && (
                                    <span className="bg-brand-500/10 text-brand-500 p-0.5 rounded-full" title="VIP Guest">
                                      <Crown size={12} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded capitalize w-fit">
                                {guest.segment}
                              </span>
                              {guest.loyalty_points > 0 ? (
                                <span className="text-xs text-brand-500 font-medium">{guest.loyalty_points} pts</span>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-gray-200 text-xs">
                              <span className="flex items-center gap-1.5"><Mail size={12} className="text-gray-300"/> {guest.email || 'No email'}</span>
                              <span className="flex items-center gap-1.5"><Phone size={12} className="text-gray-300"/> {guest.phone || 'No phone'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1.5 text-gray-200 text-xs">
                              <MapPin size={12} className="text-gray-300"/> {guest.nationality || 'Unspecified'}
                            </span>
                          </td>
                          <td className="p-4">
                            {guest.wallet_balance !== null && guest.wallet_balance !== undefined ? (
                              <span className="flex items-center gap-1.5 text-white font-medium text-xs">
                                <Wallet size={12} className="text-brand-500"/> ₦{Number(guest.wallet_balance || 0).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs italic">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-brand-500 text-xs font-semibold group-hover:underline inline-flex items-center gap-1">
                              View 360° Profile →
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <PaginationControl
                currentPage={currentPageGuests}
                totalItems={filteredGuests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPageGuests}
              />
            </div>
          )}

          {/* Add Guest Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-lg relative rounded-xl animate-in zoom-in-95">
                <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-300 hover:text-white"><X size={24}/></button>
                <h2 className="text-xl font-bold text-white mb-6">Add New CRM Record</h2>
                <form onSubmit={handleAddGuest} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">First Name</label>
                      <input required type="text" value={newGuest.firstName} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Last Name</label>
                      <input required type="text" value={newGuest.lastName} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Email</label>
                      <input type="email" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Phone</label>
                      <input type="text" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Nationality</label>
                      <input type="text" value={newGuest.nationality} onChange={e => setNewGuest({...newGuest, nationality: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Segment</label>
                      <select value={newGuest.segment} onChange={e => setNewGuest({...newGuest, segment: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500">
                        <option value="standard">Standard</option>
                        <option value="corporate">Corporate</option>
                        <option value="frequent">Frequent Stayer</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-dark-900 p-4 border border-dark-700 rounded mt-2">
                    <input type="checkbox" id="vipToggle" checked={newGuest.vipStatus} onChange={e => setNewGuest({...newGuest, vipStatus: e.target.checked})} className="w-5 h-5 accent-brand-500" />
                    <label htmlFor="vipToggle" className="font-medium text-white flex items-center gap-2">Mark as VIP <Crown size={16} className="text-brand-500"/></label>
                  </div>
                  <button type="submit" className="w-full btn-primary py-3 mt-4">Save Guest Record</button>
                </form>
              </div>
            </div>
          )}
        </>
      ) : parentTab === 'corporate' ? (
        /* Corporate Groups Section */
        <>
          {/* Telemetry Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-in fade-in duration-300">
            <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-brand-500 shadow-lg">
              <p className="text-xs text-gray-200 font-bold uppercase tracking-wider">Active Corporate Groups</p>
              <h3 className="text-3xl font-bold text-white mt-1">{groupAccounts.length}</h3>
            </div>
            <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-red-500 shadow-lg">
              <p className="text-xs text-gray-200 font-bold uppercase tracking-wider">Total Outstanding Group Debt</p>
              <h3 className="text-3xl font-bold text-red-400 mt-1">₦{groupAccounts.reduce((sum, g) => sum + Number(g.outstanding_balance || 0), 0).toLocaleString()}</h3>
            </div>
            <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-green-500 shadow-lg">
              <p className="text-xs text-gray-200 font-bold uppercase tracking-wider">Total Approved Credit Pool</p>
              <h3 className="text-3xl font-bold text-green-400 mt-1">₦{groupAccounts.reduce((sum, g) => sum + Number(g.credit_limit || 0), 0).toLocaleString()}</h3>
            </div>
          </div>

          {/* Search Box */}
          <div className="bg-dark-800 border border-dark-700 p-6 mb-6 rounded-lg animate-in fade-in duration-300">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200" size={18} />
              <input 
                type="text" 
                placeholder="Search companies, agencies, churches..." 
                className="w-full bg-dark-900 border border-dark-700 text-white pl-10 pr-4 py-2 focus:border-brand-500 outline-none rounded transition-colors"
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {groupLoading ? (
            <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">Loading corporate directory...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">No group accounts found.</div>
          ) : (
            <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-dark-900/80 text-gray-200 border-b border-dark-700">
                    <tr>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Group Name & Type</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Contact Person</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Outstanding Balance</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Approved Credit</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Available Credit</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider">Account Status</th>
                      <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/50">
                    {paginatedGroups.map((group) => {
                      const availableCredit = Number(group.credit_limit || 0) - Number(group.outstanding_balance || 0);
                      const isExhausted = availableCredit <= 0;
                      const isClosed = closedGroupAccounts.includes(group.id);
                      const isDeactivated = deactivatedGroupAccounts.includes(group.id);
                      const groupStatus = isClosed ? 'closed' : isDeactivated ? 'inactive' : 'active';
                      
                      return (
                        <tr key={group.id} className="hover:bg-dark-700/35 transition-all duration-200">
                          <td className="p-4 font-bold text-white">
                            <span className="block text-sm">{group.name}</span>
                            <span className="text-xs bg-dark-700 text-brand-400 px-2 py-0.5 rounded mt-1 inline-block capitalize font-bold">{group.group_type}</span>
                          </td>
                          <td className="p-4">
                            {group.contact_name ? (
                              <div className="flex flex-col text-xs text-gray-200">
                                <span className="font-semibold text-white">{group.contact_name}</span>
                                <span>{group.contact_email}</span>
                                <span>{group.contact_phone}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">No contact assigned</span>
                            )}
                          </td>
                          <td className="p-4 font-mono font-bold text-red-400">
                            ₦{Number(group.outstanding_balance || 0).toLocaleString()}
                          </td>
                          <td className="p-4 font-mono font-bold text-gray-300">
                            ₦{Number(group.credit_limit || 0).toLocaleString()}
                          </td>
                          <td className={`p-4 font-mono font-bold ${isExhausted ? 'text-red-500' : 'text-green-400'}`}>
                            ₦{availableCredit.toLocaleString()}
                          </td>
                          <td className="p-4 text-sm">
                            {groupStatus === 'inactive' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                Inactive
                              </span>
                            ) : groupStatus === 'closed' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                Closed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button 
                              onClick={() => { setActivePaymentGroup(group); setGroupPaymentAmount(group.outstanding_balance.toString()); }}
                              className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold text-xs py-1.5 px-3 rounded shadow transition-all hover:scale-105 inline-block"
                            >
                              Record Payment
                            </button>
                            
                            {groupStatus === 'active' && (
                              <>
                                <button 
                                  onClick={() => handleUpdateGroupStatus(group.id, 'inactive')}
                                  className="bg-yellow-500/10 hover:bg-yellow-500 hover:text-dark-900 font-bold text-xs py-1.5 px-3 rounded transition-all inline-block border border-yellow-500/30"
                                >
                                  Deactivate
                                </button>
                                <button 
                                  onClick={() => handleUpdateGroupStatus(group.id, 'closed')}
                                  className="bg-red-500/10 hover:bg-red-500 hover:text-white font-bold text-xs py-1.5 px-3 rounded transition-all inline-block border border-red-500/30"
                                >
                                  Close
                                </button>
                              </>
                            )}

                            {groupStatus === 'inactive' && (
                              <>
                                <button 
                                  onClick={() => handleUpdateGroupStatus(group.id, 'active')}
                                  className="bg-green-500/10 hover:bg-green-500 hover:text-dark-900 font-bold text-xs py-1.5 px-3 rounded transition-all inline-block border border-green-500/30"
                                >
                                  Reopen
                                </button>
                                <button 
                                  onClick={() => handleUpdateGroupStatus(group.id, 'closed')}
                                  className="bg-red-500/10 hover:bg-red-500 hover:text-white font-bold text-xs py-1.5 px-3 rounded transition-all inline-block border border-red-500/30"
                                >
                                  Close
                                </button>
                              </>
                            )}

                            {groupStatus === 'closed' && (
                              <button 
                                onClick={() => handleUpdateGroupStatus(group.id, 'active')}
                                className="bg-green-500/10 hover:bg-green-500 hover:text-dark-900 font-bold text-xs py-1.5 px-3 rounded transition-all inline-block border border-green-500/30"
                              >
                                Reopen
                              </button>
                            )}

                            <button 
                              onClick={async () => {
                                if (Number(group.outstanding_balance) > 0) {
                                  return toast.error("Cannot delete a group account with an outstanding balance! Please settle all outstanding debts first.");
                                }
                                if (!window.confirm(`⚠️ WARNING: Are you absolutely sure you want to delete corporate group account "${group.name}"? This action is irreversible.`)) return;
                                
                                const toastId = toast.loading('Deleting group account...');
                                try {
                                  const { error } = await supabase.from('group_accounts').delete().eq('id', group.id);
                                  if (error) throw error;
                                  
                                  toast.success(`Group "${group.name}" deleted successfully!`, { id: toastId });
                                  fetchGroupAccounts();
                                } catch (err) {
                                  console.error(err);
                                  toast.error(`Deletion failed: ${err.message}`, { id: toastId });
                                }
                              }}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 font-bold text-xs py-1.5 px-3 rounded transition-all inline-block"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControl
                currentPage={currentPageGroups}
                totalItems={filteredGroups.length}
                pageSize={pageSize}
                onPageChange={setCurrentPageGroups}
              />
            </div>
          )}

          {/* Add Corporate Group Modal */}
          {isAddGroupOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-lg relative rounded-xl animate-in zoom-in-95">
                <button onClick={() => setIsAddGroupOpen(false)} className="absolute top-4 right-4 text-gray-300 hover:text-white"><X size={24}/></button>
                <h2 className="text-xl font-bold text-white mb-6">Create Corporate / Group Account</h2>
                <form onSubmit={handleAddGroupAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-200 mb-1">Company / Group Name *</label>
                    <input required type="text" value={newGroupForm.name} onChange={e => setNewGroupForm({...newGroupForm, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" placeholder="e.g. Chevron Nigeria Ltd" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Group Type</label>
                      <select value={newGroupForm.group_type} onChange={e => setNewGroupForm({...newGroupForm, group_type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500">
                        <option value="Company">Company</option>
                        <option value="Government Agency">Government Agency</option>
                        <option value="Church">Church</option>
                        <option value="Group">Group</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">Credit Limit (₦) *</label>
                      <input required type="number" value={newGroupForm.credit_limit} onChange={e => setNewGroupForm({...newGroupForm, credit_limit: parseFloat(e.target.value) || 0})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div className="border-t border-dark-700/50 pt-4 mt-2">
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Primary Contact Representative</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-300 mb-1">Full Name</label>
                        <input type="text" value={newGroupForm.contact_name} onChange={e => setNewGroupForm({...newGroupForm, contact_name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="e.g. Grace Udemba" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Email Address</label>
                          <input type="email" value={newGroupForm.contact_email} onChange={e => setNewGroupForm({...newGroupForm, contact_email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="grace@company.com" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-300 mb-1">Phone Number</label>
                          <input type="text" value={newGroupForm.contact_phone} onChange={e => setNewGroupForm({...newGroupForm, contact_phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="+234..." />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full btn-primary py-3 mt-4">Save Group Account</button>
                </form>
              </div>
            </div>
          )}

          {/* Record Group Payment Modal */}
          {activePaymentGroup && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md shadow-2xl relative rounded-xl animate-in zoom-in-95">
                <button onClick={() => !isProcessingGroupPayment && setActivePaymentGroup(null)} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Wallet className="text-brand-500"/> Record Corporate Payment</h2>
                <p className="text-sm text-gray-200 mb-6">{activePaymentGroup.name}</p>
                
                <form onSubmit={handleRecordGroupPayment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Payment Method</label>
                    <select disabled={isProcessingGroupPayment} value={groupPaymentMethod} onChange={e => setGroupPaymentMethod(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors">
                      <option value="bank_transfer">Bank Transfer (Manual)</option>
                      <option value="pos">POS Terminal (Manual)</option>
                      <option value="cash">Cash (Manual)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Payment Amount (₦)</label>
                    <input 
                      disabled={isProcessingGroupPayment}
                      required 
                      type="number" 
                      max={activePaymentGroup.outstanding_balance} 
                      min="1" 
                      value={groupPaymentAmount} 
                      onChange={e => setGroupPaymentAmount(e.target.value)} 
                      className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors" 
                    />
                    <p className="text-xs text-gray-300 mt-1 flex justify-between">
                      <span>Outstanding Debt: ₦{Number(activePaymentGroup.outstanding_balance || 0).toLocaleString()}</span>
                      <span className="text-brand-500 cursor-pointer hover:underline" onClick={() => setGroupPaymentAmount(activePaymentGroup.outstanding_balance.toString())}>Pay Full Debt</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Reference Number / Check #</label>
                    <input 
                      disabled={isProcessingGroupPayment}
                      type="text" 
                      value={groupPaymentRef} 
                      onChange={e => setGroupPaymentRef(e.target.value)} 
                      placeholder="e.g. TXN-18937402"
                      className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors" 
                    />
                  </div>

                  <button type="submit" disabled={isProcessingGroupPayment || !groupPaymentAmount} className={`w-full py-3 mt-4 rounded font-bold transition-all flex items-center justify-center gap-2 ${isProcessingGroupPayment || !groupPaymentAmount ? 'bg-dark-700 text-gray-300 cursor-not-allowed' : 'bg-brand-500 text-dark-900 hover:bg-brand-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]'}`}>
                    {isProcessingGroupPayment ? <><RefreshCcw size={18} className="animate-spin" /> Processing Payment...</> : `Record Direct Credit ₦${Number(groupPaymentAmount).toLocaleString()}`}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      ) : parentTab === 'broadcast' ? (
        <div className="bg-dark-800 border border-dark-700 p-8 rounded-lg animate-in fade-in duration-300">
          <div className="mb-6 pb-4 border-b border-dark-700">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="text-brand-500" size={22} />
              <span>Customer Broadcast Dispatch Console</span>
            </h2>
            <p className="text-xs text-gray-200 mt-1">Send bulk personalized Email (via Resend API) or SMS announcements to your targeted guest segments.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Composition Panel */}
            <form onSubmit={handleStartBroadcast} className="lg:col-span-3 space-y-6">
              <div className="bg-dark-900 p-5 border border-dark-750 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-brand-400">1. Target Audience</h3>
                
                <div>
                  <label className="block text-xs text-gray-450 mb-1.5 font-semibold">Select Target Segment</label>
                  <select 
                    value={broadcastSegment} 
                    onChange={e => setBroadcastSegment(e.target.value)}
                    disabled={broadcastSending}
                    className="w-full bg-dark-800 border border-dark-700 p-3 rounded-lg text-white text-sm outline-none focus:border-brand-500 font-semibold"
                  >
                    <option value="all">All Registered Guests ({guests.length} matches)</option>
                    <option value="standard">Standard Segment Only ({guests.filter(g => g.segment === 'standard').length} matches)</option>
                    <option value="corporate">Corporate CRM Contacts ({guests.filter(g => g.segment === 'corporate').length} matches)</option>
                    <option value="vip">VIP Guest List ({guests.filter(g => g.vip_status || g.segment === 'vip').length} matches)</option>
                  </select>
                </div>
              </div>

              <div className="bg-dark-900 p-5 border border-dark-750 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-brand-400">2. Delivery Channel</h3>
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    disabled={broadcastSending}
                    onClick={() => setBroadcastChannel('email')}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      broadcastChannel === 'email'
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-md'
                        : 'bg-dark-800 text-gray-200 border-dark-700 hover:text-white'
                    }`}
                  >
                    <Mail size={16} /> Email via Resend
                  </button>
                  <button
                    type="button"
                    disabled={broadcastSending}
                    onClick={() => setBroadcastChannel('sms')}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      broadcastChannel === 'sms'
                        ? 'bg-brand-500/10 text-brand-500 border-brand-500/30 shadow-md'
                        : 'bg-dark-800 text-gray-200 border-dark-700 hover:text-white'
                    }`}
                  >
                    <Phone size={16} /> SMS via Gateway
                  </button>
                </div>
              </div>

              <div className="bg-dark-900 p-5 border border-dark-750 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-brand-400">3. Template Content</h3>
                
                {broadcastChannel === 'email' && (
                  <div>
                    <label className="block text-xs text-gray-455 mb-1.5 font-semibold">Email Subject Line *</label>
                    <input
                      type="text"
                      required
                      disabled={broadcastSending}
                      value={broadcastSubject}
                      onChange={e => setBroadcastSubject(e.target.value)}
                      placeholder="e.g. Exclusive Weekend Treat at Freshland"
                      className="w-full bg-dark-800 border border-dark-700 p-3 rounded-lg text-white text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs text-gray-455 font-semibold">Message Body *</label>
                    <span className="text-[10px] text-gray-555 font-bold uppercase">Variable: {"{{guest_name}}"}</span>
                  </div>
                  <textarea
                    required
                    rows="6"
                    disabled={broadcastSending}
                    value={broadcastBody}
                    onChange={e => setBroadcastBody(e.target.value)}
                    placeholder={
                      broadcastChannel === 'email'
                        ? "Dear {{guest_name}},\n\nWrite your email newsletter content here..."
                        : "Hello {{guest_name}}, write your SMS broadcast update here..."
                    }
                    className="w-full bg-dark-800 border border-dark-700 p-3 rounded-lg text-white text-sm outline-none focus:border-brand-500 font-sans resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={broadcastSending || !broadcastBody.trim() || (broadcastChannel === 'email' && !broadcastSubject.trim())}
                  className={`flex-1 py-3.5 rounded-xl font-extrabold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                    broadcastSending
                      ? 'bg-dark-700 text-gray-550 cursor-not-allowed border border-dark-650'
                      : 'bg-brand-500 hover:bg-brand-400 text-dark-950 font-black cursor-pointer shadow-lg active:scale-95'
                  }`}
                >
                  {broadcastSending ? (
                    <>
                      <RefreshCcw size={16} className="animate-spin" /> Dispatching Broadcast...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send Broadcast to {
                        (() => {
                          if (broadcastSegment === 'all') return guests.length;
                          if (broadcastSegment === 'vip') return guests.filter(g => g.vip_status || g.segment === 'vip').length;
                          return guests.filter(g => g.segment === broadcastSegment).length;
                        })()
                      } Guests
                    </>
                  )}
                </button>

                {broadcastSending && (
                  <button
                    type="button"
                    onClick={() => {
                      broadcastActiveRef.current = false;
                      setBroadcastSending(false);
                      setBroadcastConsoleLogs(prev => [...prev, "⚠️ Dispatch process aborted manually by operator."]);
                      toast.error("Broadcast transmission cancelled.");
                    }}
                    className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-bold px-6 rounded-xl border border-red-500/30 transition-all text-xs uppercase"
                  >
                    Abort
                  </button>
                )}
              </div>
            </form>

            {/* Tracker Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <div className="bg-dark-900 p-5 border border-dark-750 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-brand-400">Transmission Progress</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-200">Sent Rate:</span>
                    <span className="font-mono font-bold text-white">
                      {broadcastProgress.current} / {broadcastProgress.total} processed
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-dark-800 rounded-full overflow-hidden border border-dark-700">
                    <div 
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ 
                        width: `${broadcastProgress.total > 0 ? Math.round((broadcastProgress.current / broadcastProgress.total) * 100) : 0}%` 
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-300 font-bold">
                    <span>0%</span>
                    <span className="text-brand-450 font-black">
                      {broadcastProgress.total > 0 ? Math.round((broadcastProgress.current / broadcastProgress.total) * 100) : 0}% Complete
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Console Logs Card */}
              <div className="bg-dark-900 p-5 border border-dark-750 rounded-xl space-y-3 flex flex-col h-[325px]">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-brand-400">Live Delivery Console</h3>
                
                <div className="flex-1 bg-dark-950 font-mono text-[10px] p-4 rounded-lg border border-dark-750 overflow-y-auto space-y-1 text-gray-200 leading-relaxed scrollbar-thin scrollbar-thumb-dark-700">
                  {broadcastConsoleLogs.length === 0 ? (
                    <div className="text-center text-gray-600 py-16">
                      Waiting for broadcast trigger...
                    </div>
                  ) : (
                    broadcastConsoleLogs.map((log, index) => (
                      <div 
                        key={index}
                        className={
                          log.includes('❌') 
                            ? 'text-red-400' 
                            : log.includes('✓') 
                              ? 'text-green-400' 
                              : log.includes('completed') || log.includes('finished')
                                ? 'text-brand-500 font-bold'
                                : 'text-gray-200'
                        }
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Loyalty Rewards Program Configuration Settings */
        <div className="bg-dark-800 border border-dark-700 p-8 rounded-lg animate-in fade-in duration-300">
          <div className="mb-6 pb-4 border-b border-dark-700 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Star className="text-yellow-500 fill-yellow-500" size={22} />
                <span>Loyalty Points Settings & Program Rules</span>
              </h2>
              <p className="text-xs text-gray-200 mt-1">Configure points accrual multipliers, redemption exchange rates, and guest segment thresholds.</p>
            </div>
          </div>

          <form onSubmit={handleSaveLoyaltySettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Earning Rules */}
              <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg space-y-4 shadow-lg">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide border-b border-dark-750 pb-2 flex items-center gap-2 text-brand-400">
                  <span>1. Earning Rules</span>
                </h3>
                
                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Points Per Booking</label>
                  <input 
                    type="number"
                    min="0"
                    value={loyaltySettings.points_per_booking}
                    onChange={e => setLoyaltySettings({ ...loyaltySettings, points_per_booking: Number(e.target.value) || 0 })}
                    className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-300 mt-1">Flat points awarded for making any confirmed booking.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Points Per Night Stayed</label>
                  <input 
                    type="number"
                    min="0"
                    value={loyaltySettings.points_per_night}
                    onChange={e => setLoyaltySettings({ ...loyaltySettings, points_per_night: Number(e.target.value) || 0 })}
                    className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-300 mt-1">Points awarded for each actual night of accommodation stayed.</p>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-200 mb-1 font-semibold">Points Per Spend</label>
                      <input 
                        type="number"
                        min="0"
                        value={loyaltySettings.points_per_spend_amount}
                        onChange={e => setLoyaltySettings({ ...loyaltySettings, points_per_spend_amount: Number(e.target.value) || 0 })}
                        className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-200 mb-1 font-semibold">Per Spend Unit (₦)</label>
                      <input 
                        type="number"
                        min="1"
                        value={loyaltySettings.spend_unit_amount}
                        onChange={e => setLoyaltySettings({ ...loyaltySettings, spend_unit_amount: Number(e.target.value) || 1 })}
                        className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1">Earn X points for every Y Naira spent on booking and folio services combined.</p>
                </div>
              </div>

              {/* Redemption Rules */}
              <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg space-y-4 shadow-lg">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide border-b border-dark-750 pb-2 flex items-center gap-2 text-brand-400">
                  <span>2. Redemption Rules</span>
                </h3>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Exchange Rate (₦ Credit Per Point)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200 text-xs font-bold font-mono">1 Pt = ₦</span>
                    <input 
                      type="number"
                      min="1"
                      value={loyaltySettings.redemption_rate}
                      onChange={e => setLoyaltySettings({ ...loyaltySettings, redemption_rate: Number(e.target.value) || 1 })}
                      className="w-full bg-dark-800 border border-dark-700 py-2.5 pl-14 pr-3 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1">Naira conversion value credited to guest's prepayment wallet per 1 point redeemed.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Minimum Points to Redeem</label>
                  <input 
                    type="number"
                    min="1"
                    value={loyaltySettings.min_points_to_redeem}
                    onChange={e => setLoyaltySettings({ ...loyaltySettings, min_points_to_redeem: Number(e.target.value) || 1 })}
                    className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-550 mt-1">Minimum point balance required to initiate a redemption transaction.</p>
                </div>
              </div>

              {/* Tier Thresholds */}
              <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg space-y-4 shadow-lg">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide border-b border-dark-750 pb-2 flex items-center gap-2 text-brand-400">
                  <span>3. Tier Thresholds</span>
                </h3>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Frequent Stayer Threshold (Points)</label>
                  <input 
                    type="number"
                    min="1"
                    value={loyaltySettings.frequent_tier_threshold}
                    onChange={e => setLoyaltySettings({ ...loyaltySettings, frequent_tier_threshold: Number(e.target.value) || 1 })}
                    className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-550 mt-1">Point balance needed to graduate from Standard to Frequent Stayer segment.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">VIP Tier Threshold (Points)</label>
                  <input 
                    type="number"
                    min="1"
                    value={loyaltySettings.vip_tier_threshold}
                    onChange={e => setLoyaltySettings({ ...loyaltySettings, vip_tier_threshold: Number(e.target.value) || 1 })}
                    className="w-full bg-dark-800 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-550 mt-1">Point balance needed to graduate to the elite VIP segment.</p>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-dark-700 flex justify-end">
              <button 
                type="submit"
                disabled={savingLoyalty}
                className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-extrabold px-8 py-3 rounded-lg text-sm transition-all shadow-md flex items-center gap-2 uppercase tracking-wider"
              >
                {savingLoyalty ? "Saving Rules..." : "Save Program Rules"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 360 Guest Profile Modal (Global to CRM) */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-4xl h-[85vh] flex flex-col relative rounded-xl animate-in zoom-in-95 overflow-hidden">
            <button onClick={() => setSelectedGuest(null)} className="absolute top-4 right-4 text-gray-200 hover:text-white z-10"><X size={24}/></button>
            
            {/* Modal Header */}
            <div className="bg-dark-900 border-b border-dark-700 p-6 flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center text-3xl font-bold text-brand-500 uppercase border border-dark-600">
                {selectedGuest.first_name?.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {selectedGuest.first_name} {selectedGuest.last_name}
                  {selectedGuest.vip_status && <Crown size={20} className="text-brand-500"/>}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-200">
                  <span className="flex items-center gap-1"><Mail size={14}/> {selectedGuest.email || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Phone size={14}/> {selectedGuest.phone || 'N/A'}</span>
                  <span className="flex items-center gap-1"><MapPin size={14}/> {selectedGuest.nationality || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-dark-700 px-6 pt-4 bg-dark-900">
              {['overview', 'bookings', 'financials', 'communications', 'account'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-dark-800 custom-scrollbar">
              
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="bg-dark-900 p-5 rounded-lg border border-dark-700">
                      <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Star size={18} className="text-brand-500"/> CRM Metrics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-300">Segment</p>
                          <p className="font-medium text-white capitalize">{selectedGuest.segment}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-300">Record Created</p>
                          <p className="font-medium text-white">{new Date(selectedGuest.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    {selectedGuest.wallet_balance === null || selectedGuest.wallet_balance === undefined ? (
                      <div className="bg-dark-900 p-5 rounded-lg border border-dark-700 flex flex-col items-center justify-center text-center">
                        <Wallet size={36} className="text-gray-300 mb-2" />
                        <h4 className="font-bold text-white text-sm mb-1">Prepayment Wallet Inactive</h4>
                        <p className="text-xs text-gray-300 mb-4 leading-normal">Activate to allow prepayments, log deposits, and pay using digital wallet.</p>
                        <button 
                          onClick={async () => {
                            const initBal = 0;
                            const toastId = toast.loading('Activating guest AR wallet...');
                            try {
                              const { error } = await supabase.from('crm_guests').update({ wallet_balance: initBal }).eq('id', selectedGuest.id);
                              if (error) throw error;
                              
                              const newWallet = {
                                id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                                guest_id: selectedGuest.id,
                                guest_name: `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim() || selectedGuest.guest_name || 'Unnamed Guest',
                                guest_email: selectedGuest.email || 'N/A',
                                balance: initBal,
                                status: 'active',
                                created_at: new Date().toISOString()
                              };
                              try {
                                const { error: arErr } = await supabase.from('ar_accounts').insert([newWallet]);
                                if (arErr) throw arErr;
                              } catch (arErr) {
                                console.warn("ar_accounts insert fallback or skip:", arErr.message);
                                const updatedAR = [...arAccounts, newWallet];
                                try {
                                  await supabase.from('system_settings').upsert({
                                    setting_key: 'ar_accounts',
                                    setting_value: updatedAR
                                  }, { onConflict: 'setting_key' });
                                } catch (sysErr) {
                                  console.warn("Failed to update system_settings on activation:", sysErr);
                                }
                                localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
                              }

                              toast.success(`AR Prepayment Wallet successfully activated!`, { id: toastId });
                              setSelectedGuest(prev => ({ ...prev, wallet_balance: initBal }));
                              fetchGuests();
                              fetchARAccounts();
                            } catch (err) {
                              console.error(err);
                              toast.error(`Activation failed: ${err.message}`, { id: toastId });
                            }
                          }}
                          className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-extrabold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all"
                        >
                          Activate AR Account
                        </button>
                      </div>
                    ) : (
                      <div className="bg-dark-900 p-5 rounded-lg border border-dark-700 flex flex-col justify-between gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wallet className="text-brand-500" size={24} />
                            <div>
                              <p className="text-xs text-gray-300">Wallet Balance</p>
                              <p className="font-bold text-white">₦{Number(selectedGuest.wallet_balance || 0).toLocaleString()}</p>
                              {(() => {
                                const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                                const status = wallet?.status || 'active';
                                if (status === 'inactive' || status === 'deactivated') {
                                  return (
                                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
                                      Prepayment Wallet Inactive
                                    </span>
                                  );
                                } else if (status === 'closed') {
                                  return (
                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
                                      Prepayment Wallet Closed
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
                                      Prepayment Wallet Active
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Status Control Actions */}
                        {(() => {
                          const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                          const status = wallet?.status || 'active';
                          return (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                {(status === 'inactive' || status === 'deactivated') && (
                                  <>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'active')}
                                      className="flex-1 bg-green-500/10 hover:bg-green-500 hover:text-dark-900 text-green-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-green-500/20 text-center"
                                    >
                                      Reopen Wallet
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'closed')}
                                      className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-red-500/20 text-center"
                                    >
                                      Close Wallet
                                    </button>
                                  </>
                                )}
                                
                                {status === 'closed' && (
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'active')}
                                    className="w-full bg-green-500/10 hover:bg-green-500 hover:text-dark-900 text-green-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-green-500/20 text-center"
                                  >
                                    Reopen Wallet
                                  </button>
                                )}
                                
                                {status === 'active' && (
                                  <>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'inactive')}
                                      className="flex-1 bg-yellow-500/10 hover:bg-yellow-500 hover:text-dark-900 text-yellow-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-yellow-500/20 text-center"
                                    >
                                      Deactivate
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'closed')}
                                      className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-red-500/20 text-center"
                                    >
                                      Close Wallet
                                    </button>
                                  </>
                                )}
                              </div>

                              <button 
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm("Are you sure you want to archive/delete this guest's AR prepayment wallet? This will archive their prepayment ledger, clear their balance to null, and delete the wallet record.")) return;
                                  const toastId = toast.loading('Archiving guest AR wallet...');
                                  try {
                                    const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: null }).eq('id', selectedGuest.id);
                                    if (crmErr) throw crmErr;
                                    
                                    try {
                                      const { error: arErr } = await supabase.from('ar_accounts').delete().eq('guest_id', selectedGuest.id);
                                      if (arErr) throw arErr;
                                    } catch (arErr) {
                                      console.warn("ar_accounts delete fallback, table missing:", arErr.message);
                                      const updatedAR = arAccounts.filter(acc => acc.guest_id !== selectedGuest.id);
                                      try {
                                        await supabase.from('system_settings').upsert({
                                          setting_key: 'ar_accounts',
                                          setting_value: updatedAR
                                        }, { onConflict: 'setting_key' });
                                      } catch (sysErr) {
                                        console.warn("Failed to update system_settings on deactivation:", sysErr);
                                      }
                                      localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
                                    }

                                    toast.success(`AR Prepayment Wallet successfully archived!`, { id: toastId });
                                    setSelectedGuest(prev => ({ ...prev, wallet_balance: null }));
                                    fetchGuests();
                                    fetchARAccounts();
                                  } catch (err) {
                                    console.error(err);
                                    toast.error(`Archiving failed: ${err.message}`, { id: toastId });
                                  }
                                }}
                                className="w-full bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 border border-dark-600/30 hover:border-red-500/20 py-1.5 rounded text-[11px] transition-all text-center"
                              >
                                Archive / Delete Wallet
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="bg-dark-900 p-5 rounded-lg border border-dark-700">
                      <h3 className="font-bold text-white mb-4">Saved Preferences</h3>
                      <form onSubmit={savePreferences}>
                        <textarea name="prefs" rows="4" className="w-full bg-dark-800 border border-dark-700 p-3 rounded text-sm text-gray-300 font-mono outline-none focus:border-brand-500 mb-3" defaultValue={JSON.stringify(selectedGuest.preferences, null, 2)}></textarea>
                        <button type="submit" className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded text-sm w-full transition-colors">Update Preferences (JSON)</button>
                      </form>
                    </div>
                  </div>

                  <div className="bg-dark-900 p-5 rounded-lg border border-dark-700">
                    <h3 className="font-bold text-white mb-4">Identification</h3>
                    <input 
                      type="file" 
                      id="id-doc-uploader" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      onChange={handleUploadIDDocument} 
                    />
                    {selectedGuest.id_document_url ? (
                      <div className="text-center p-8 bg-dark-800 rounded border border-dark-700">
                        <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-medium">ID Document Uploaded</p>
                        <div className="flex gap-4 justify-center mt-4">
                          <button 
                            type="button" 
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) {
                                newWindow.document.write(`<iframe src="${selectedGuest.id_document_url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                              } else {
                                toast.error("Popup blocked! Enable popups to view document.");
                              }
                            }}
                            className="text-brand-500 text-xs hover:underline font-bold"
                          >
                            View Document
                          </button>
                          <span className="text-gray-600">|</span>
                          <label 
                            htmlFor="id-doc-uploader" 
                            className="text-gray-200 text-xs hover:text-white cursor-pointer hover:underline"
                          >
                            Replace
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 bg-dark-800 rounded border border-dashed border-dark-600">
                        <p className="text-sm text-gray-300 mb-3">No ID Document on file</p>
                        <label 
                          htmlFor="id-doc-uploader" 
                          className="inline-block bg-dark-700 text-white px-4 py-2 rounded text-sm hover:bg-dark-600 cursor-pointer transition-colors font-bold"
                        >
                          Upload ID / Passport
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'financials' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedGuest.wallet_balance === null || selectedGuest.wallet_balance === undefined ? (
                      <div className="bg-dark-900/60 p-6 rounded-lg border border-dashed border-dark-600 flex flex-col items-center justify-center text-center">
                        <Wallet size={48} className="text-gray-300 mb-4" />
                        <p className="text-gray-200 mb-1 text-xs uppercase tracking-wider font-semibold">AR Prepayment Wallet</p>
                        <h3 className="text-lg font-bold text-white mb-2">Account Inactive</h3>
                        <p className="text-xs text-gray-300 mb-6 max-w-xs">Activate this guest's AR account to let them make prepayments, log cash deposits, and pay using their digital wallet.</p>
                        <button 
                          onClick={async () => {
                            const initBal = 0;
                            const toastId = toast.loading('Activating guest AR wallet...');
                            try {
                              const { error } = await supabase.from('crm_guests').update({ wallet_balance: initBal }).eq('id', selectedGuest.id);
                              if (error) throw error;
                              
                              const newWallet = {
                                id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                                guest_id: selectedGuest.id,
                                guest_name: `${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim() || selectedGuest.guest_name || 'Unnamed Guest',
                                guest_email: selectedGuest.email || 'N/A',
                                balance: initBal,
                                status: 'active',
                                created_at: new Date().toISOString()
                              };
                              try {
                                const { error: arErr } = await supabase.from('ar_accounts').insert([newWallet]);
                                if (arErr) throw arErr;
                              } catch (arErr) {
                                console.warn("ar_accounts insert fallback or skip:", arErr.message);
                                const updatedAR = [...arAccounts, newWallet];
                                try {
                                  await supabase.from('system_settings').upsert({
                                    setting_key: 'ar_accounts',
                                    setting_value: updatedAR
                                  }, { onConflict: 'setting_key' });
                                } catch (sysErr) {
                                  console.warn("Failed to update system_settings on activation:", sysErr);
                                }
                                localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
                              }

                              toast.success(`AR Prepayment Wallet successfully activated!`, { id: toastId });
                              setSelectedGuest(prev => ({ ...prev, wallet_balance: initBal }));
                              fetchGuests();
                              fetchARAccounts();
                            } catch (err) {
                              console.error(err);
                              toast.error(`Activation failed: ${err.message}`, { id: toastId });
                            }
                          }}
                          className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-extrabold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                        >
                          Activate AR Prepayment Wallet
                        </button>
                      </div>
                    ) : (
                      <div className="bg-dark-900 p-6 rounded-lg border border-dark-700 flex flex-col justify-between gap-4">
                        <div className="flex items-center justify-between border-b border-dark-750 pb-3">
                          <div className="flex items-center gap-3">
                            <Wallet className="text-brand-500" size={24} />
                            <span className="text-xs text-gray-200 font-bold uppercase tracking-wider">AR Prepayment Wallet</span>
                          </div>
                          {(() => {
                            const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                            const status = wallet?.status || 'active';
                            if (status === 'inactive' || status === 'deactivated') {
                              return (
                                <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wide">
                                  Prepayment Wallet Inactive
                                </span>
                              );
                            } else if (status === 'closed') {
                              return (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wide">
                                  Prepayment Wallet Closed
                                </span>
                              );
                            } else {
                              return (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wide">
                                  Prepayment Wallet Active
                                </span>
                              );
                            }
                          })()}
                        </div>
                        
                        <div className="text-center py-2">
                          <p className="text-xs text-gray-300">Current Wallet Balance</p>
                          <h3 className="text-4xl font-extrabold text-white mt-1">₦{Number(selectedGuest.wallet_balance || 0).toLocaleString()}</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 w-full mb-2">
                          <button 
                            onClick={() => {
                              const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                              const status = wallet?.status || 'active';
                              if (status !== 'active') {
                                toast.error("Add funds is blocked on inactive or closed wallets.");
                                return;
                              }
                              setAddFundsAmount('');
                              setAddFundsRef('');
                              setAddFundsMethod('cash');
                              setIsAddFundsOpen(true);
                            }}
                            className={`${(() => {
                              const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                              const status = wallet?.status || 'active';
                              return status === 'active' 
                                ? 'bg-brand-500 hover:bg-brand-400 text-dark-900 cursor-pointer' 
                                : 'bg-gray-500/5 text-gray-300 border-gray-700/30 cursor-not-allowed opacity-50 border';
                            })()} font-extrabold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 text-center flex items-center justify-center gap-1.5`}
                          >
                            Add Funds
                          </button>
                          <button 
                            onClick={() => {
                              const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                              const status = wallet?.status || 'active';
                              if (status !== 'active') {
                                toast.error("Deduct funds is blocked on inactive or closed wallets.");
                                return;
                              }
                              const amt = window.prompt("Enter amount to deduct from wallet (₦):");
                              if (amt && Number(amt) > 0) updateWallet(-Number(amt));
                            }}
                            className={`${(() => {
                              const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                              const status = wallet?.status || 'active';
                              return status === 'active' 
                                ? 'bg-dark-700 hover:bg-dark-600 text-white cursor-pointer border border-dark-600' 
                                : 'bg-gray-500/5 text-gray-300 border-gray-700/30 cursor-not-allowed opacity-50 border';
                            })()} py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5`}
                          >
                            Deduct Funds
                          </button>
                        </div>

                        {/* Status Control Actions */}
                        {(() => {
                          const wallet = arAccounts.find(acc => acc.guest_id === selectedGuest.id);
                          const status = wallet?.status || 'active';
                          return (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                {(status === 'inactive' || status === 'deactivated') && (
                                  <>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'active')}
                                      className="flex-1 bg-green-500/10 hover:bg-green-500 hover:text-dark-900 text-green-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-green-500/20 text-center"
                                    >
                                      Reopen Wallet
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'closed')}
                                      className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-red-500/20 text-center"
                                    >
                                      Close Wallet
                                    </button>
                                  </>
                                )}
                                
                                {status === 'closed' && (
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'active')}
                                    className="w-full bg-green-500/10 hover:bg-green-500 hover:text-dark-900 text-green-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-green-500/20 text-center"
                                  >
                                    Reopen Wallet
                                  </button>
                                )}
                                
                                {status === 'active' && (
                                  <>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'inactive')}
                                      className="flex-1 bg-yellow-500/10 hover:bg-yellow-500 hover:text-dark-900 text-yellow-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-yellow-500/20 text-center"
                                    >
                                      Deactivate
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateGuestARStatus(selectedGuest.id, 'closed')}
                                      className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 py-1.5 px-3 rounded text-xs font-bold transition-all border border-red-500/20 text-center"
                                    >
                                      Close Wallet
                                    </button>
                                  </>
                                )}
                              </div>

                              <button 
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm("Are you sure you want to archive/delete this guest's AR prepayment wallet? This will archive their prepayment ledger, clear their balance to null, and delete the wallet record.")) return;
                                  const toastId = toast.loading('Archiving guest AR wallet...');
                                  try {
                                    const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: null }).eq('id', selectedGuest.id);
                                    if (crmErr) throw crmErr;
                                    
                                    try {
                                      const { error: arErr } = await supabase.from('ar_accounts').delete().eq('guest_id', selectedGuest.id);
                                      if (arErr) throw arErr;
                                    } catch (arErr) {
                                      console.warn("ar_accounts delete fallback, table missing:", arErr.message);
                                      const updatedAR = arAccounts.filter(acc => acc.guest_id !== selectedGuest.id);
                                      try {
                                        await supabase.from('system_settings').upsert({
                                          setting_key: 'ar_accounts',
                                          setting_value: updatedAR
                                        }, { onConflict: 'setting_key' });
                                      } catch (sysErr) {
                                        console.warn("Failed to update system_settings on deactivation:", sysErr);
                                      }
                                      localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
                                    }

                                    toast.success(`AR Prepayment Wallet successfully archived!`, { id: toastId });
                                    setSelectedGuest(prev => ({ ...prev, wallet_balance: null }));
                                    fetchGuests();
                                    fetchARAccounts();
                                  } catch (err) {
                                    console.error(err);
                                    toast.error(`Archiving failed: ${err.message}`, { id: toastId });
                                  }
                                }}
                                className="w-full bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 border border-dark-600/30 hover:border-red-500/20 py-1.5 rounded text-[11px] transition-all text-center"
                              >
                                Archive / Delete Wallet
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="bg-dark-900 p-6 rounded-lg border border-dark-700 flex flex-col items-center justify-center text-center">
                      <Star size={48} className="text-yellow-500 mb-4" />
                      <p className="text-gray-200 mb-1">Loyalty Points</p>
                      <h3 className="text-4xl font-bold text-white mb-6">{selectedGuest.loyalty_points || 0} pts</h3>
                      <button 
                        onClick={() => {
                          if (!selectedGuest) return;
                          if ((selectedGuest.loyalty_points || 0) < loyaltySettings.min_points_to_redeem) {
                            toast.error(`You need at least ${loyaltySettings.min_points_to_redeem} points to redeem. Current balance is ${selectedGuest.loyalty_points || 0} pts.`);
                            return;
                          }
                          setRedeemPointsAmount(selectedGuest.loyalty_points.toString());
                          setIsRedeemModalOpen(true);
                        }}
                        className="w-full bg-dark-700 hover:bg-dark-600 text-white py-2 rounded text-sm transition-colors font-bold"
                      >
                        Redeem Points
                      </button>
                    </div>
                  </div>

                  {selectedGuest.wallet_balance !== null && selectedGuest.wallet_balance !== undefined && (
                    <div className="bg-dark-900 p-6 rounded-lg border border-dark-700 space-y-4">
                      <div className="flex justify-between items-center border-b border-dark-750 pb-4">
                        <div>
                          <h4 className="text-md font-bold text-white flex items-center gap-2">
                            💼 Prepayment Account Statement
                          </h4>
                          <p className="text-xs text-gray-300 mt-1">Chronological ledger of cash deposits and checkout room charge deductions.</p>
                        </div>
                        <button 
                          onClick={() => handlePrintStatement(selectedGuest, arStatement)}
                          className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold text-xs py-2 px-4 rounded shadow flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          Printer/Download PDF
                        </button>
                      </div>

                      {loadingARStatement ? (
                        <div className="text-center p-8 text-gray-300 text-xs">Loading ledger transactions...</div>
                      ) : arStatement.length === 0 ? (
                        <div className="text-center p-8 text-gray-300 text-xs bg-dark-800 rounded border border-dark-700/50">
                          No prepayment transactions logged for this guest yet.
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto rounded border border-dark-700/60">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-dark-950 text-gray-200 border-b border-dark-700">
                                <tr>
                                  <th className="p-3 font-semibold uppercase tracking-wider">Date / Time</th>
                                  <th className="p-3 font-semibold uppercase tracking-wider">Description</th>
                                  <th className="p-3 font-semibold uppercase tracking-wider">Method</th>
                                  <th className="p-3 font-semibold uppercase tracking-wider">Type</th>
                                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Amount</th>
                                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Running Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-dark-750">
                                {paginatedARStatement.map(rec => (
                                  <tr key={rec.id} className="hover:bg-dark-800/40">
                                    <td className="p-3 text-gray-200 font-mono text-[10px]">
                                      {new Date(rec.date).toLocaleString()}
                                    </td>
                                    <td className="p-3">
                                      <span className="font-semibold text-white block">{rec.description}</span>
                                      {rec.notes && <span className="text-[10px] text-gray-300 font-mono block mt-0.5">{rec.notes}</span>}
                                    </td>
                                    <td className="p-3 text-gray-200 uppercase font-mono text-[10px]">
                                      {rec.method?.replace('_', ' ')}
                                    </td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${rec.type === 'credit' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {rec.type === 'credit' ? 'DEPOSIT' : 'CHARGE'}
                                      </span>
                                    </td>
                                    <td className={`p-3 font-mono font-bold text-right text-[11px] ${rec.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                      {rec.type === 'credit' ? '+' : '-'}₦{rec.amount.toLocaleString()}
                                    </td>
                                    <td className="p-3 font-mono font-bold text-white text-right text-[11px]">
                                      ₦{rec.running_balance.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <PaginationControl
                            currentPage={currentPageAR}
                            totalItems={arStatement.length}
                            pageSize={pageSize}
                            onPageChange={setCurrentPageAR}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bookings' && (
                <div>
                  {guestBookings.length === 0 ? (
                    <div className="text-center p-8 text-gray-300 bg-dark-900 rounded border border-dark-700">No booking history for this guest.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-dark-900 text-gray-200 border-b border-dark-700">
                        <tr>
                          <th className="p-3 font-medium">Ref</th>
                          <th className="p-3 font-medium">Room</th>
                          <th className="p-3 font-medium">Dates</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700">
                        {guestBookings.map(b => (
                          <tr key={b.id} className="hover:bg-dark-700/30">
                            <td className="p-3 font-medium text-white">{b.booking_reference}</td>
                            <td className="p-3">{b.rooms?.name}</td>
                            <td className="p-3 text-gray-200">{b.check_in_date} to {b.check_out_date}</td>
                            <td className="p-3 capitalize">{b.status.replace('_', ' ')}</td>
                            <td className="p-3 text-brand-500">₦{Number(b.total_amount_ngn).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'communications' && (
                <div className="grid grid-cols-5 gap-6">
                  <div className="col-span-2 bg-dark-900 p-5 rounded-lg border border-dark-700 h-fit">
                    <h3 className="font-bold text-white mb-4">Send Message</h3>
                    <form onSubmit={sendCommunication} className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-300 mb-1">Channel</label>
                        <select value={commType} onChange={e => setCommType(e.target.value)} className="w-full bg-dark-800 border border-dark-700 p-2 text-white outline-none focus:border-brand-500 rounded">
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-300 mb-1">Message Content</label>
                        <textarea required value={commMessage} onChange={e => setCommMessage(e.target.value)} rows="5" className="w-full bg-dark-800 border border-dark-700 p-2 text-white outline-none focus:border-brand-500 rounded resize-none" placeholder="Type message..."></textarea>
                      </div>
                      <button type="submit" className="w-full btn-primary py-2 flex justify-center items-center gap-2"><Send size={16}/> Send via {commType}</button>
                    </form>
                    
                    <div className="mt-6 border-t border-dark-700 pt-4">
                      <p className="text-xs text-gray-300 mb-2">Automated Triggers (Mock)</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => {setCommType('email'); setCommMessage('Friendly reminder: Your upcoming stay is confirmed.');}} className="bg-dark-700 text-xs px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-brand-500">Booking Reminder</button>
                        <button onClick={() => {setCommType('whatsapp'); setCommMessage('Please complete your pending payment of...');}} className="bg-dark-700 text-xs px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-brand-500">Payment Reminder</button>
                        <button onClick={() => {setCommType('email'); setCommMessage('How was your stay? Leave a review!');}} className="bg-dark-700 text-xs px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-brand-500">Review Request</button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-3 bg-dark-900 rounded-lg border border-dark-700 p-5">
                    <h3 className="font-bold text-white mb-4">Communication Log</h3>
                    <div className="space-y-4">
                      {commsLogs.length === 0 ? (
                        <p className="text-gray-300 text-sm">No communications logged yet.</p>
                      ) : (
                        commsLogs.map(log => (
                          <div key={log.id} className="bg-dark-800 p-4 rounded border border-dark-700 flex gap-4">
                            <div className="mt-1">
                              {log.type === 'email' ? <Mail size={18} className="text-blue-400"/> : 
                               log.type === 'whatsapp' ? <MessageSquare size={18} className="text-green-400"/> : 
                               <Phone size={18} className="text-brand-500"/>}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-bold text-white uppercase">{log.type} - {log.category}</span>
                                <span className="text-xs text-gray-300">{new Date(log.sent_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-300">{log.content}</p>
                              <span className="text-[10px] uppercase font-bold text-green-500 mt-2 block tracking-wider flex items-center gap-1"><CheckCircle size={10}/> {log.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg space-y-6">
                  {profileLoading ? (
                    <div className="text-gray-200 py-10 text-center">Loading account details...</div>
                  ) : guestProfile ? (
                    <form onSubmit={handleUpdateGuestCredentials} className="space-y-6">
                      <div className="flex justify-between items-center border-b border-dark-700 pb-4">
                        <div>
                          <h3 className="font-bold text-white text-lg">🔑 Portal Access Account</h3>
                          <p className="text-xs text-gray-200 mt-1">This guest has an active login account in the system.</p>
                        </div>
                        <span className="bg-brand-500/10 text-brand-500 border border-brand-500/20 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                          Guest Role
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs text-gray-200 font-bold uppercase tracking-wider mb-2">Username / Login Email *</label>
                          <input 
                            type="email" 
                            required
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white rounded p-3 text-sm focus:border-brand-500 outline-none font-semibold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-200 font-bold uppercase tracking-wider mb-2">Reset Password (Leave blank to keep current)</label>
                          <div className="relative">
                            <input 
                              type={showResetPassword ? 'text' : 'password'} 
                              value={resetPassword}
                              onChange={e => setResetPassword(e.target.value)}
                              className="w-full bg-dark-800 border border-dark-700 text-white rounded p-3 pr-12 text-sm focus:border-brand-500 outline-none font-semibold font-mono"
                              placeholder="Type new password (min. 6 chars)"
                              minLength={6}
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetPassword(!showResetPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 hover:text-white transition-colors"
                            >
                              {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-dark-950 p-4 rounded border border-dark-700">
                        <div>
                          <p className="text-sm font-semibold text-white">Guest Account ID</p>
                          <p className="text-xs text-gray-300 font-mono mt-1">{guestProfile.id}</p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-200 font-bold uppercase tracking-wider mb-2">Portal Access Status</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              id="resetActiveToggle" 
                              checked={resetActive}
                              onChange={e => setResetActive(e.target.checked)}
                              className="w-5 h-5 accent-brand-500"
                            />
                            <label htmlFor="resetActiveToggle" className="text-sm font-bold text-white">
                              {resetActive ? 'Active / Allowed' : 'Deactivated / Banned'}
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-dark-700">
                        <button 
                          type="submit"
                          className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold px-8 py-3 rounded-lg text-sm shadow-md transition-colors"
                        >
                          Save Credentials Changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6 max-w-xl mx-auto py-6">
                      <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded text-sm">
                        💡 <strong>Guest Account Not Found:</strong> This guest record does not have a linked login profile for the online Guest Portal. They will not be able to log in to track reservations or request services.
                      </div>

                      <div className="bg-dark-900 border border-dark-700 rounded-lg p-6 space-y-4">
                        <h4 className="font-bold text-white text-base">Provision New Guest Login</h4>
                        <p className="text-xs text-gray-200 leading-relaxed">
                          Enter a temporary password to create a portal account for this guest. Sharing these credentials with the guest directly allows them to log in instantly:
                        </p>
                        
                        <div className="space-y-3 font-mono text-sm">
                          <div className="flex justify-between border-b border-dark-700/50 pb-2">
                            <span className="text-gray-300">Email (Username):</span>
                            <span className="text-white font-bold">{selectedGuest.email || 'N/A'}</span>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-200 font-bold uppercase tracking-wider mb-2 font-sans">Temporary Password *</label>
                            <div className="relative">
                              <input 
                                type={showProvisionPassword ? 'text' : 'password'} 
                                required
                                value={provisionPassword}
                                onChange={e => setProvisionPassword(e.target.value)}
                                className="w-full bg-dark-800 border border-dark-700 text-white rounded p-3 pr-12 text-sm focus:border-brand-500 outline-none font-semibold font-mono"
                                placeholder="Minimum 6 characters"
                                minLength={6}
                              />
                              <button
                                type="button"
                                onClick={() => setShowProvisionPassword(!showProvisionPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 hover:text-white transition-colors"
                              >
                                {showProvisionPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={handleProvisionGuestAccount}
                          disabled={!selectedGuest.email}
                          className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-950 font-bold py-3 rounded-lg text-sm shadow-md transition-colors uppercase tracking-wider"
                        >
                          Provision Portal Account
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Danger Zone */}
                  <div className="mt-8 bg-red-500/5 border border-red-500/20 p-5 rounded-lg space-y-4">
                    <div>
                      <h4 className="font-bold text-red-400 text-sm flex items-center gap-2">⚠️ Danger Zone</h4>
                      <p className="text-xs text-gray-200 mt-1">Permanently delete this guest's CRM profile, all their booking histories, prepayment wallets, and their online portal account. This action is irreversible.</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`⚠️ WARNING: Are you absolutely sure you want to PERMANENTLY delete guest "${selectedGuest.first_name} ${selectedGuest.last_name}"? All associated bookings, payments, and accounts will be deleted. This cannot be undone.`)) return;
                        const verifyName = window.prompt(`Type the guest's last name "${selectedGuest.last_name}" to confirm deletion:`);
                        if (verifyName !== selectedGuest.last_name) {
                          return toast.error("Verification failed. Guest deletion aborted.");
                        }
                        
                        const toastId = toast.loading('Deleting guest records and profile...');
                        try {
                          // 1. Delete associated ar_accounts (with fallback)
                          try {
                            const { error: arErr } = await supabase.from('ar_accounts').delete().eq('guest_id', selectedGuest.id);
                            if (arErr) throw arErr;
                          } catch (arErr) {
                            console.warn("ar_accounts delete fallback, table missing:", arErr.message);
                            const updatedAR = arAccounts.filter(acc => acc.guest_id !== selectedGuest.id);
                            try {
                              await supabase.from('system_settings').upsert({
                                setting_key: 'ar_accounts',
                                setting_value: updatedAR
                              }, { onConflict: 'setting_key' });
                            } catch (sysErr) {
                              console.warn("Failed to update system_settings on guest deletion:", sysErr);
                            }
                            localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
                          }

                          // 2. Delete linked profiles record if any
                          if (guestProfile?.id) {
                            await supabase.from('profiles').delete().eq('id', guestProfile.id);
                          }

                          // 3. Delete from crm_guests
                          const { error } = await supabase.from('crm_guests').delete().eq('id', selectedGuest.id);
                          if (error) throw error;

                          toast.success('Guest account and CRM profile deleted successfully!', { id: toastId });
                          setSelectedGuest(null);
                          fetchGuests();
                          fetchARAccounts();
                        } catch (err) {
                          console.error(err);
                          toast.error(`Deletion failed: ${err.message}`, { id: toastId });
                        }
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all"
                    >
                      Delete Guest Profile & Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Prepayment Funds Modal */}
      {isAddFundsOpen && selectedGuest && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md relative rounded-xl animate-in zoom-in-95 flex flex-col shadow-2xl">
            <button onClick={() => setIsAddFundsOpen(false)} className="absolute top-4 right-4 text-gray-450 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Wallet className="text-brand-500" />
              <span>Add Prepayment Funds</span>
            </h2>
            <p className="text-xs text-gray-200 mb-6 uppercase tracking-wider font-bold">
              Guest: {`${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim()}
            </p>
            
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Payment Amount (₦) *</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={addFundsAmount}
                  onChange={e => setAddFundsAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Payment Method *</label>
                <select 
                  required
                  value={addFundsMethod}
                  onChange={e => setAddFundsMethod(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                >
                  <option value="cash" className="bg-dark-900 text-white">Cash Payment</option>
                  <option value="pos" className="bg-dark-900 text-white">POS Terminal</option>
                  <option value="bank_transfer" className="bg-dark-900 text-white">Bank Transfer / Electronic Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Reference Number (Optional)</label>
                <input 
                  type="text" 
                  value={addFundsRef}
                  onChange={e => setAddFundsRef(e.target.value)}
                  placeholder="e.g. TXN-91827364"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setIsAddFundsOpen(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isProcessingAddFunds || !addFundsAmount}
                  className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isProcessingAddFunds ? "Processing..." : "Confirm & Add Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redeem Loyalty Points Modal */}
      {isRedeemModalOpen && selectedGuest && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md relative rounded-xl animate-in zoom-in-95 flex flex-col shadow-2xl">
            <button onClick={() => setIsRedeemModalOpen(false)} className="absolute top-4 right-4 text-gray-450 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Star className="text-yellow-500" />
              <span>Redeem Loyalty Points</span>
            </h2>
            <p className="text-xs text-gray-450 mb-6 uppercase tracking-wider font-bold">
              Guest: {`${selectedGuest.first_name || ''} ${selectedGuest.last_name || ''}`.trim()}
            </p>
            
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-700 mb-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-300">Available Points</p>
                <p className="text-lg font-bold text-white">{selectedGuest.loyalty_points || 0} pts</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-300">Conversion Rate</p>
                <p className="text-sm font-semibold text-brand-500 font-mono">1 Pt = ₦{loyaltySettings.redemption_rate.toLocaleString()}</p>
              </div>
            </div>

            <form onSubmit={handleRedeemPoints} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Points to Redeem *</label>
                <input 
                  required
                  type="number" 
                  min={loyaltySettings.min_points_to_redeem}
                  max={selectedGuest.loyalty_points || 0}
                  value={redeemPointsAmount}
                  onChange={e => setRedeemPointsAmount(e.target.value)}
                  placeholder={`Min ${loyaltySettings.min_points_to_redeem} pts`}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono font-bold"
                />
              </div>

              {Number(redeemPointsAmount) > 0 && (
                <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700/50 flex justify-between items-center">
                  <span className="text-xs text-gray-200">Resulting Prepayment Credit:</span>
                  <span className="text-base font-extrabold text-green-400 font-mono">₦{(Number(redeemPointsAmount) * loyaltySettings.redemption_rate).toLocaleString()}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setIsRedeemModalOpen(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isProcessingRedeem || !redeemPointsAmount || Number(redeemPointsAmount) < loyaltySettings.min_points_to_redeem || Number(redeemPointsAmount) > (selectedGuest.loyalty_points || 0)}
                  className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isProcessingRedeem ? "Redeeming..." : "Confirm & Redeem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminGuests;
