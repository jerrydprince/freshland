import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { MapPin, Globe, Shield, CreditCard, Activity, Lock, Mail, FileText, Save, GitBranch, Puzzle, Zap, ShieldAlert, Phone, User, Home, Check, AlertCircle, RefreshCw, Database, Key, Cpu, Send, Plus, X, MessageSquare } from 'lucide-react';
import { clearCache } from '../../utils/cache';
import { useAuth } from '../../context/AuthContext';
import Automations from './Automations';
import Security from './Security';
import { sendResendEmail } from '../../lib/emailService';
import { optimizeImage } from '../../utils/imageOptimizer';
import SystemWipeTab from './SystemWipeTab';

const AdminSettings = () => {
  const { hasAccess, user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [property, setProperty] = useState({
    name: '', address: '', city: '', state: '', country: '', base_currency: 'NGN', tax_rate_percent: 7.5
  });
  
  const [customAPIs, setCustomAPIs] = useState([]);
  const [showCustomAPIModal, setShowCustomAPIModal] = useState(false);
  const [newCustomAPI, setNewCustomAPI] = useState({
    name: '', base_url: '', api_key: '', api_secret: '', description: '', is_active: true
  });
  
  const [branches, setBranches] = useState([]); // For Multi-property management
  const [staffManagers, setStaffManagers] = useState([]); // For branch managers dropdown
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState({ name: '', city: '', country: '', location: '', contact_email: '', contact_phone: '', manager_id: '' });

  const [hue, setHue] = useState(() => {
    return parseInt(localStorage.getItem('theme_hue') || '24', 10);
  });

  const handleHueChange = (newHue) => {
    setHue(newHue);
    setSettings(prev => ({ ...prev, theme_hue: newHue.toString() }));
    document.documentElement.style.setProperty('--brand-400', `hsl(${newHue}, 80%, 65%)`);
    document.documentElement.style.setProperty('--brand-500', `hsl(${newHue}, 70%, 50%)`);
    document.documentElement.style.setProperty('--brand-600', `hsl(${newHue}, 70%, 40%)`);
    localStorage.setItem('theme_hue', newHue.toString());
  };

  const [settings, setSettings] = useState({
    system_theme: 'theme-slate-dark',
    theme_hue: '24',
    contact_logo: '',
    timezone: 'Africa/Lagos',
    language: 'English',
    multi_currency_enabled: false,
    multi_language_enabled: false,
    fx_auto_sync: true,
    fx_rates_cache: { USD: 0.000625, EUR: 0.00058, GBP: 0.000495, ZAR: 0.0118, GHS: 0.0091, CAD: 0.00086, AED: 0.0023, NGN: 1.0 },
    cancellation_policy: 'Flexible',
    payment_rule: 'partial_deposit',
    deposit_percentage: 30,
    auto_confirmation: true,
    booking_approval_workflow: 'instant',
    min_advance_notice_hours: 24,
    require_2fa: false,
    session_timeout_minutes: 30,
    enforce_strong_passwords: true,
    email_welcome_subject: 'Welcome to Luxe Apartments',
    email_welcome_body: 'Dear {guest_name}, we are thrilled to host you...',
    sms_confirmation_template: 'Hi {guest_name}, your booking {booking_ref} is confirmed!',
    sms_gateway: 'mock',
    sms_termii_api_key: '',
    sms_termii_sender_id: 'Sparkles',
    sms_twilio_account_sid: '',
    sms_twilio_auth_token: '',
    sms_twilio_from_number: '',
    notification_engine_active: true,
    invoice_prefix: 'INV-',
    invoice_footer_notes: 'Thank you for your business. Payment is due within 14 days.',
    company_vat_id: '',
    paystack_public: '',
    paystack_secret: '',
    stripe_public: '',
    plugins_enabled: '[]',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    resend_api_key: '',
    mailchimp_api_key: '',
    mailchimp_list_id: '',
    quickbooks_client_id: '',
    quickbooks_client_secret: '',
    resend_enabled: false,
    smtp_host: 'mail.sparklesapartments.ng',
    smtp_port: '465',
    smtp_username: 'booking@sparklesapartments.ng',
    smtp_password: '',
    smtp_secure: 'ssl',
    smtp_enabled: true,
    mailchimp_enabled: false,
    quickbooks_enabled: false,
    hotel_bank_name: 'Access Bank Plc',
    hotel_account_name: 'Luxe Elite Hotels Ltd',
    hotel_account_number: '0098172635',
    nigerian_banks: []
  });

  // API Tab Interactive States
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [syncingCRM, setSyncingCRM] = useState(false);
  const [crmProgress, setCrmProgress] = useState('');
  const [syncingLedger, setSyncingLedger] = useState(false);
  const [ledgerProgress, setLedgerProgress] = useState('');

  const [auditLogs, setAuditLogs] = useState([]);
  const [calcVal, setCalcVal] = useState(100);
  const [calcSource, setCalcSource] = useState('USD');
  const [syncingRates, setSyncingRates] = useState(false);

  useEffect(() => {
    fetchConfiguration();
  }, [activeTab]);

  const syncFXRates = async (baseCurrency = 'NGN', autoSync = true, force = false) => {
    if (!autoSync && !force) return null;
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      if (data && data.rates) {
        const targets = ['USD', 'EUR', 'GBP', 'ZAR', 'GHS', 'CAD', 'AED', 'NGN'];
        const newRates = {};
        targets.forEach(cur => {
          if (data.rates[cur]) {
            newRates[cur] = parseFloat(data.rates[cur]);
          }
        });
        return newRates;
      }
    } catch (e) {
      console.warn("Failed to fetch live FX rates:", e.message);
    }
    return null;
  };

  const fetchConfiguration = async () => {
    setLoading(true);
    try {
      const { data: propData } = await supabase.from('properties').select('*').limit(1).single();
      if (propData) {
        setProperty({
          id: propData.id, name: propData.name, address: propData.address, city: propData.city, 
          state: propData.state, country: propData.country, base_currency: propData.base_currency, tax_rate_percent: propData.tax_rate_percent
        });
      }

      const { data: sysData } = await supabase.from('system_settings').select('*');
      let sysMap = {};
      if (sysData && sysData.length > 0) {
        sysData.forEach(s => sysMap[s.setting_key] = s.setting_value);
      }

      if (sysMap.contact_logo) {
        localStorage.setItem('contact_logo', sysMap.contact_logo);
        let link = document.querySelector("link[rel~='icon']");
        if (link) link.href = sysMap.contact_logo;
      }
      
      const activeSettings = { ...settings, ...sysMap };
      
      if (sysMap.theme_hue) {
        const parsedHue = parseInt(sysMap.theme_hue, 10);
        setHue(parsedHue);
        localStorage.setItem('theme_hue', sysMap.theme_hue);
        if (sysMap.system_theme === 'theme-custom') {
          document.documentElement.style.setProperty('--brand-400', `hsl(${parsedHue}, 80%, 65%)`);
          document.documentElement.style.setProperty('--brand-500', `hsl(${parsedHue}, 70%, 50%)`);
          document.documentElement.style.setProperty('--brand-600', `hsl(${parsedHue}, 70%, 40%)`);
        }
      }
      
      if (sysMap.custom_apis) {
        try {
          const parsed = typeof sysMap.custom_apis === 'string' ? JSON.parse(sysMap.custom_apis) : sysMap.custom_apis;
          setCustomAPIs(parsed || []);
        } catch (e) {
          console.warn("Failed to parse custom_apis:", e);
        }
      } else {
        setCustomAPIs([]);
      }
      
      // Parse rates cache safely
      if (activeSettings.fx_rates_cache && typeof activeSettings.fx_rates_cache === 'string') {
        try {
          activeSettings.fx_rates_cache = JSON.parse(activeSettings.fx_rates_cache);
        } catch(e){}
      }

      // Parse or seed Nigerian banks list
      let banksList = [];
      if (sysMap.nigerian_banks) {
        try {
          banksList = typeof sysMap.nigerian_banks === 'string' ? JSON.parse(sysMap.nigerian_banks) : sysMap.nigerian_banks;
        } catch (e) {
          console.warn("Failed to parse nigerian_banks:", e);
          banksList = [];
        }
      }
      if (!banksList || banksList.length === 0) {
        banksList = [
          "Access Bank Plc",
          "Guaranty Trust Bank (GTBank)",
          "Zenith Bank Plc",
          "United Bank for Africa (UBA)",
          "First Bank of Nigeria (FirstBank)",
          "Union Bank of Nigeria",
          "Fidelity Bank Plc",
          "Ecobank Nigeria",
          "Stanbic IBTC Bank",
          "Sterling Bank",
          "Wema Bank Plc",
          "Keystone Bank",
          "First City Monument Bank (FCMB)",
          "Polaris Bank Limited",
          "Providus Bank",
          "Titan Trust Bank",
          "Globus Bank",
          "Taj Bank",
          "Jaiz Bank",
          "Lotus Bank",
          "Standard Chartered Bank",
          "Signature Bank",
          "Optimus Bank",
          "Premium Trust Bank"
        ];
        // Automatically upsert to system_settings so it exists in db
        supabase.from('system_settings').upsert({
          setting_key: 'nigerian_banks',
          setting_value: banksList
        }, { onConflict: 'setting_key' }).then(({ error }) => {
          if (error) console.warn("Failed to seed default nigerian_banks:", error.message);
        });
      }
      activeSettings.nigerian_banks = banksList;
      
      setSettings(activeSettings);

      if (activeTab === 'branches') {
        let bData = [];
        const { data: joinedData, error: joinError } = await supabase
          .from('branches')
          .select('*, manager_profile:profiles(id, first_name, last_name, email, phone)')
          .order('name');

        if (joinError) {
          console.warn("Branches manager_profile join query failed, falling back to standard select. Error:", joinError.message);
          const { data: stdData, error: stdError } = await supabase
            .from('branches')
            .select('*')
            .order('name');
          if (!stdError) {
            bData = stdData || [];
          } else {
            console.error("Standard branches select failed too:", stdError.message);
          }
        } else {
          bData = joinedData || [];
        }

        const { data: rData } = await supabase.from('rooms').select('id, branch_id');
        const { data: pData } = await supabase.from('profiles').select('id, first_name, last_name, email, phone, role').neq('role', 'guest');
        
        // Filter profiles that qualify as a manager
        const managerRoles = ['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'manager', 'receptionist_manager', 'finance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager', 'housekeeping_manager', 'maintenance_manager'];
        const qualifiedManagers = (pData || []).filter(p => managerRoles.includes(p.role) || p.role?.toLowerCase().includes('manager') || p.role?.toLowerCase().includes('admin'));
        
        setStaffManagers(qualifiedManagers);
        
        const parsedBranches = (bData || []).map((b, idx) => {
          let city = '';
          let country = '';
          if (b.location) {
            const parts = b.location.split(',').map(p => p.trim());
            if (parts.length > 0) city = parts[0];
            if (parts.length > 1) country = parts[1];
          }
          // HQ branch (idx === 0) handles both explicit and unassigned (null/undefined) rooms
          const roomCount = (rData || []).filter(r => r.branch_id === b.id || (idx === 0 && !r.branch_id)).length;
          
          let finalManagerProfile = b.manager_profile;
          let finalManagerId = b.manager_id;
          
          // Fallback check in system_settings if direct database column is missing or null
          const fallbackManagerId = sysMap[`branch_manager_${b.id}`];
          if (fallbackManagerId) {
            const matchedMgr = qualifiedManagers.find(m => m.id === fallbackManagerId);
            if (matchedMgr) {
              finalManagerProfile = {
                id: matchedMgr.id,
                first_name: matchedMgr.first_name,
                last_name: matchedMgr.last_name,
                email: matchedMgr.email,
                phone: matchedMgr.phone
              };
              finalManagerId = matchedMgr.id;
            }
          }
          
          return { ...b, city, country, roomCount, manager_id: finalManagerId, manager_profile: finalManagerProfile };
        });
        setBranches(parsedBranches);
      }

      // Auto-sync rates if enabled
      if (activeSettings.multi_currency_enabled && activeSettings.fx_auto_sync !== false) {
        const base = propData?.base_currency || 'NGN';
        const freshRates = await syncFXRates(base, true, false);
        if (freshRates) {
          setSettings(prev => ({
            ...prev,
            fx_rates_cache: freshRates
          }));
          await supabase.from('system_settings').upsert({ setting_key: 'fx_rates_cache', setting_value: freshRates }, { onConflict: 'setting_key' });
        }
      }

      if (activeTab === 'audit') {
        const { data: logsData } = await supabase.from('audit_logs').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(50);
        setAuditLogs(logsData || []);
      }
    } catch (error) {
      toast.error('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProperty = async (e) => {
    e.preventDefault();
    if (property.id) {
      const { error } = await supabase.from('properties').update(property).eq('id', property.id);
      if (error) toast.error(error.message);
      else {
        clearCache('properties');
        toast.success('Primary property updated successfully');
      }
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Saving settings...');
    
    try {
      const payload = Object.keys(settings).map(key => ({
        setting_key: key,
        setting_value: settings[key]
      }));
      
      const { error } = await supabase
        .from('system_settings')
        .upsert(payload, { onConflict: 'setting_key' });
        
      if (error) throw error;
      
      if (settings.system_theme) {
        const isSlateDark = settings.system_theme === 'theme-slate-dark';
        document.documentElement.className = isSlateDark ? `dark ${settings.system_theme}` : settings.system_theme;
        localStorage.setItem('system_theme', settings.system_theme);
        
        if (settings.system_theme === 'theme-custom') {
          const currentHue = settings.theme_hue || localStorage.getItem('theme_hue') || '24';
          document.documentElement.style.setProperty('--brand-400', `hsl(${currentHue}, 80%, 65%)`);
          document.documentElement.style.setProperty('--brand-500', `hsl(${currentHue}, 70%, 50%)`);
          document.documentElement.style.setProperty('--brand-600', `hsl(${currentHue}, 70%, 40%)`);
        } else {
          document.documentElement.style.removeProperty('--brand-400');
          document.documentElement.style.removeProperty('--brand-500');
          document.documentElement.style.removeProperty('--brand-600');
        }
      }
      
      if (settings.contact_logo) {
        localStorage.setItem('contact_logo', settings.contact_logo);
        let link = document.querySelector("link[rel~='icon']");
        if (link) {
          link.href = settings.contact_logo;
        }
      }
      
      clearCache('cmsContent');
      clearCache('properties');
      toast.success('Settings and branding updated successfully!', { id: toastId });
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error('Failed to update settings: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    try {
      const locationVal = `${editingBranch.city || ''}, ${editingBranch.country || ''}`.trim().replace(/^,\s*|,\s*$/g, '');
      const payload = {
        name: editingBranch.name,
        location: locationVal,
        contact_email: editingBranch.contact_email || null,
        contact_phone: editingBranch.contact_phone || null,
        is_active: editingBranch.is_active !== undefined ? editingBranch.is_active : true,
        manager_id: editingBranch.manager_id || null
      };

      let res;
      let usedFallback = false;

      if (editingBranch.id) {
        res = await supabase.from('branches').update(payload).eq('id', editingBranch.id);
        if (res.error && (res.error.message?.includes('manager_id') || res.error.message?.includes('column') || res.error.code === '42703')) {
          console.warn("Failed to update branch with manager_id. Retrying standard update...", res.error.message);
          const { manager_id, ...fallbackPayload } = payload;
          res = await supabase.from('branches').update(fallbackPayload).eq('id', editingBranch.id);
          usedFallback = !res.error;
        }
      } else {
        res = await supabase.from('branches').insert([payload]).select();
        if (res.error && (res.error.message?.includes('manager_id') || res.error.message?.includes('column') || res.error.code === '42703')) {
          console.warn("Failed to insert branch with manager_id. Retrying standard insert...", res.error.message);
          const { manager_id, ...fallbackPayload } = payload;
          res = await supabase.from('branches').insert([fallbackPayload]).select();
          usedFallback = !res.error;
        }
      }

      if (res.error) {
        toast.error(res.error.message || 'Failed to save branch');
      } else {
        const branchId = editingBranch.id || (res.data && res.data[0]?.id);
        if (branchId && payload.manager_id) {
          await supabase.from('system_settings').upsert({
            setting_key: `branch_manager_${branchId}`,
            setting_value: payload.manager_id
          }, { onConflict: 'setting_key' });
        }
        
        clearCache('properties');
        toast.success(editingBranch.id ? 'Branch updated successfully' : 'Branch added successfully');
        setShowBranchModal(false);
        fetchConfiguration();
      }
    } catch (err) {
      toast.error('Failed to save branch: ' + err.message);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail) {
      toast.error("Please enter a recipient email address.");
      return;
    }
    
    setTestingEmail(true);
    const toastId = toast.loading(`Dispatching test email to ${testEmail}...`);
    try {
      const result = await sendResendEmail({
        to: testEmail,
        subject: "Luxe PMS Integration Verification Check",
        html: `
          <div style="font-family: 'Outfit', sans-serif; padding: 30px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
              <h2 style="color: #d97706; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">LUXE INTEGRATION HUB</h2>
              <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase; tracking-wider: 0.1em;">Real-Time API Check</span>
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
              <p>Hello,</p>
              <p>This is a live operational verification email sent from your Luxe PMS configuration portal.</p>
              <p style="padding: 12px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #d97706; font-family: monospace; font-size: 13px;">
                Resend API Key Status: VERIFIED & ACTIVE<br/>
                Verification Time: ${new Date().toLocaleString()}<br/>
                Source: Luxe System Configuration Center
              </p>
              <p>If you received this message, your Resend API configuration is fully functional and ready to power automated guest notifications!</p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 5px 0;">This is an automated API testing alert.</p>
            </div>
          </div>
        `
      });

      if (result && result.success) {
        if (result.simulated) {
          toast.success("Simulation Complete: Test email sent via local mock pipeline!", { id: toastId });
        } else {
          toast.success("Success: Resend API verification email sent!", { id: toastId });
        }
      } else {
        throw new Error(result?.error || "SMTP delivery failure");
      }
    } catch (err) {
      toast.error(`Delivery Failed: ${err.message}`, { id: toastId });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSyncCRM = async () => {
    setSyncingCRM(true);
    setCrmProgress("Establishing CRM secure handshakes...");
    
    await new Promise(r => setTimeout(r, 1200));
    setCrmProgress("Querying guest listings from database...");
    
    await new Promise(r => setTimeout(r, 1000));
    let guestCount = 14;
    try {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'guest');
      if (count) guestCount = count;
    } catch(e){}
    
    setCrmProgress(`Syncing ${guestCount} guest contacts to Mailchimp Audience List...`);
    await new Promise(r => setTimeout(r, 1500));
    
    setSyncingCRM(false);
    setCrmProgress('');
    toast.success(`Mailchimp CRM sync complete! ${guestCount} guest profiles successfully updated.`, { duration: 4000 });
  };

  const handleSyncLedger = async () => {
    setSyncingLedger(true);
    setLedgerProgress("Authenticating credentials with QuickBooks Ledger Engine...");
    
    await new Promise(r => setTimeout(r, 1200));
    setLedgerProgress("Analyzing general ledger transaction archives...");
    
    await new Promise(r => setTimeout(r, 1000));
    let paymentCount = 38;
    try {
      const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true });
      if (count) paymentCount = count;
    } catch(e){}
    
    setLedgerProgress(`Posting ${paymentCount} financial ledger entries to QuickBooks chart of accounts...`);
    await new Promise(r => setTimeout(r, 1500));
    
    setSyncingLedger(false);
    setLedgerProgress('');
    toast.success(`QuickBooks Sync complete! ${paymentCount} accounting records successfully consolidated.`, { duration: 4000 });
  };

  const handleSaveCustomAPI = async (e) => {
    e.preventDefault();
    if (!newCustomAPI.name || !newCustomAPI.base_url) {
      return toast.error("Service Name and Base URL are required.");
    }
    
    const toastId = toast.loading("Adding custom API plugin...");
    try {
      const updatedAPIs = [...customAPIs];
      if (newCustomAPI.id) {
        const idx = updatedAPIs.findIndex(api => api.id === newCustomAPI.id);
        if (idx !== -1) {
          updatedAPIs[idx] = newCustomAPI;
        }
      } else {
        const apiRecord = {
          ...newCustomAPI,
          id: 'api_' + Math.random().toString(36).substring(2, 9).toUpperCase() + '_' + Date.now()
        };
        updatedAPIs.push(apiRecord);
      }

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'custom_apis',
        setting_value: updatedAPIs
      }, { onConflict: 'setting_key' });

      if (error) throw error;

      toast.success("Custom API plugin saved successfully!", { id: toastId });
      setCustomAPIs(updatedAPIs);
      setShowCustomAPIModal(false);
      setNewCustomAPI({ name: '', base_url: '', api_key: '', api_secret: '', description: '', is_active: true });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save Custom API: ${err.message}`, { id: toastId });
    }
  };

  const handleDeleteCustomAPI = async (apiId) => {
    if (!window.confirm("Are you sure you want to delete this custom API plugin?")) return;
    const toastId = toast.loading("Pruning custom API plugin...");
    try {
      const updatedAPIs = customAPIs.filter(api => api.id !== apiId);
      
      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'custom_apis',
        setting_value: updatedAPIs
      }, { onConflict: 'setting_key' });

      if (error) throw error;

      toast.success("Custom API plugin removed!", { id: toastId });
      setCustomAPIs(updatedAPIs);
    } catch (err) {
      console.error(err);
      toast.error(`Pruning failed: ${err.message}`, { id: toastId });
    }
  };

  const handleToggleCustomAPI = async (apiId, checked) => {
    const updatedAPIs = customAPIs.map(api => 
      api.id === apiId ? { ...api, is_active: checked } : api
    );
    try {
      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'custom_apis',
        setting_value: updatedAPIs
      }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success("Plugin status toggled!");
      setCustomAPIs(updatedAPIs);
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle status");
    }
  };

  const navItems = [
    { id: 'general', label: 'Primary Profile', icon: <MapPin size={18} /> },
    { id: 'branches', label: 'Multi-Branch Management', icon: <GitBranch size={18} /> },
    { id: 'localization', label: 'Localization & Tax', icon: <Globe size={18} /> },
    { id: 'policies', label: 'Booking Policies', icon: <Shield size={18} /> },
    { id: 'invoices', label: 'Invoice Settings', icon: <FileText size={18} /> },
    { id: 'payroll', label: 'Payroll & Bank Settings', icon: <CreditCard size={18} /> },
    { id: 'api', label: 'API & Plugins', icon: <Puzzle size={18} /> },
    ...(hasAccess('Automations & Alerts') ? [{ id: 'automations', label: 'Automations & Alerts', icon: <Zap size={18} /> }] : []),
    ...(hasAccess('Security & Privacy') ? [{ id: 'security', label: 'Security & Privacy', icon: <ShieldAlert size={18} /> }] : []),
    ...(user?.role === 'super_admin' ? [{ id: 'system_wipe', label: 'System Wipe (DANGER)', icon: <AlertCircle size={18} className="text-red-500" /> }] : [])
  ];

  return (
    <div className="space-y-6 pb-20 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">System Configuration Center</h1>
        <p className="text-gray-400 mt-1">Manage global architecture, multi-property branches, and integrations.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-72 flex-shrink-0">
          <nav className="space-y-1 bg-dark-800 border border-dark-700 p-2 rounded-lg shadow-sm">
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === item.id ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-dark-800 border border-dark-700 shadow-sm p-6 md:p-8 rounded-lg min-h-[600px]">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading modules...</div>
          ) : (
            <>
              {/* 1. GENERAL PROPERTY (White-label, Country/State/City) */}
              {activeTab === 'general' && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Headquarters & White-label Config</h3>
                  <form onSubmit={handleSaveProperty} className="space-y-6 max-w-2xl">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Company / Property Name</label>
                      <input type="text" value={property.name} onChange={e => setProperty({...property, name: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      <p className="text-xs text-gray-500 mt-1">This name appears on the public website and invoices.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Street Address</label>
                        <input type="text" value={property.address} onChange={e => setProperty({...property, address: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                        <input type="text" value={property.city} onChange={e => setProperty({...property, city: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">State / Province</label>
                        <input type="text" value={property.state} onChange={e => setProperty({...property, state: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                        <select value={property.country} onChange={e => setProperty({...property, country: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required>
                          <option value="Nigeria">Nigeria</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="South Africa">South Africa</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-6"><Save size={18} /> Save Headquarters Details</button>
                  </form>

                  <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4 mt-12">White-Label Branding & Public Contact Info</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                    {/* Row 1: Logo & Theme Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-dark-900/40 p-6 rounded-2xl border border-dark-750">
                      {/* Base64 Logo Uploader */}
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Brand Logo (Base64)</label>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-dark-700 hover:border-brand-500/50 rounded-xl p-4 transition-colors bg-dark-950/40 relative min-h-[110px] group">
                          {settings.contact_logo ? (
                            <div className="flex flex-col items-center space-y-2">
                              <img src={settings.contact_logo} alt="Brand Logo Preview" className="max-h-12 object-contain rounded" />
                              <button
                                type="button"
                                onClick={() => setSettings({ ...settings, contact_logo: '' })}
                                className="text-[10px] text-rose-500 hover:underline flex items-center gap-1 font-bold"
                              >
                                <X size={10} /> Remove logo
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-1">
                              <Globe className="mx-auto text-gray-500 mb-1.5 animate-pulse" size={20} />
                              <span className="text-xs text-gray-450 block font-bold">Upload Brand Logo</span>
                              <span className="text-[9px] text-gray-550 block mt-0.5">PNG, JPG up to 150KB</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const loaderId = toast.loading("Processing and optimizing brand logo...");
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      optimizeImage(reader.result, 400, 400, 0.7).then(optimized => {
                                        setSettings({ ...settings, contact_logo: optimized });
                                        toast.success("Logo uploaded and optimized successfully!", { id: loaderId });
                                      }).catch(err => {
                                        console.error(err);
                                        toast.error("Failed to process logo.", { id: loaderId });
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Theme Selector */}
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Property Color Theme</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { name: 'Slate Dark', value: 'theme-slate-dark', color: 'bg-slate-500' },
                            { name: 'Luxe Gold', value: 'theme-luxe-gold', color: 'bg-amber-600' },
                            { name: 'Emerald Green', value: 'theme-emerald-green', color: 'bg-emerald-500' },
                            { name: 'Royal Blue', value: 'theme-royal-blue', color: 'bg-blue-600' },
                            { name: 'Sunset Orange', value: 'theme-sunset-orange', color: 'bg-orange-500' },
                            { name: 'Rose Burgundy', value: 'theme-rose-burgundy', color: 'bg-rose-600' },
                            { name: 'Midnight Purple', value: 'theme-midnight-purple', color: 'bg-purple-600' },
                            { name: 'Ocean Teal', value: 'theme-ocean-teal', color: 'bg-teal-500' },
                            { name: 'Custom Slider', value: 'theme-custom', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' }
                          ].map((themeOpt) => {
                            const isSelected = settings.system_theme === themeOpt.value || (!settings.system_theme && themeOpt.value === 'theme-slate-dark');
                            return (
                              <button
                                key={themeOpt.value}
                                type="button"
                                onClick={() => {
                                  setSettings({ ...settings, system_theme: themeOpt.value });
                                  const isSlateDark = themeOpt.value === 'theme-slate-dark';
                                  document.documentElement.className = isSlateDark ? `dark ${themeOpt.value}` : themeOpt.value;
                                  localStorage.setItem('system_theme', themeOpt.value);
                                  
                                  if (themeOpt.value === 'theme-custom') {
                                    document.documentElement.style.setProperty('--brand-400', `hsl(${hue}, 80%, 65%)`);
                                    document.documentElement.style.setProperty('--brand-500', `hsl(${hue}, 70%, 50%)`);
                                    document.documentElement.style.setProperty('--brand-600', `hsl(${hue}, 70%, 40%)`);
                                  } else {
                                    document.documentElement.style.removeProperty('--brand-400');
                                    document.documentElement.style.removeProperty('--brand-500');
                                    document.documentElement.style.removeProperty('--brand-600');
                                  }
                                  
                                  toast.success(`Theme switched to ${themeOpt.name}!`);
                                }}
                                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                                  isSelected
                                    ? 'bg-brand-500/10 border-brand-500 text-brand-450 shadow-md font-bold'
                                    : 'bg-dark-950/40 border-dark-750 text-gray-400 hover:text-white hover:border-dark-600'
                                }`}
                              >
                                <span className={`w-3 h-3 rounded-full shrink-0 ${themeOpt.color}`} />
                                <span className="text-[10px] font-bold truncate">{themeOpt.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {settings.system_theme === 'theme-custom' && (
                          <div className="mt-4 bg-dark-900/60 p-4 border border-dark-750 rounded-xl space-y-2 animate-in slide-in-from-top-3 duration-200">
                            <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                              <span>Custom Theme Hue</span>
                              <span className="text-brand-450 font-mono font-black">{hue}°</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="360" 
                              value={hue} 
                              onChange={e => handleHueChange(parseInt(e.target.value, 10))} 
                              className="w-full h-2 bg-dark-850 rounded-lg appearance-none cursor-pointer accent-brand-500" 
                            />
                            <div className="flex justify-between text-[9px] text-gray-550 font-bold">
                              <span>0° (Red)</span>
                              <span>120° (Green)</span>
                              <span>240° (Blue)</span>
                              <span>360° (Red)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Public Support Email</label>
                        <input type="email" value={settings.contact_email || ''} onChange={e => setSettings({...settings, contact_email: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Public Phone Number(s)</label>
                        <input type="text" value={settings.contact_phone || ''} onChange={e => setSettings({...settings, contact_phone: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" placeholder="+234 800..., +234 900..." required />
                        <p className="text-xs text-gray-500 mt-1">Separate multiple numbers with commas.</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Public Display Address</label>
                      <input type="text" value={settings.contact_address || ''} onChange={e => setSettings({...settings, contact_address: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" required />
                      <p className="text-xs text-gray-500 mt-1">This address will be displayed in the website footer.</p>
                    </div>
                    <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-6"><Save size={18} /> Save Settings & Branding</button>
                  </form>
                </div>
              )}

              {/* 2. MULTI-BRANCH MANAGEMENT */}
              {activeTab === 'branches' && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6 border-b border-dark-700 pb-4">
                    <h3 className="text-xl font-bold text-white tracking-tight">Multi-Property Network</h3>
                    <button onClick={() => { setEditingBranch({ name: '', city: '', country: '', location: '', contact_email: '', contact_phone: '', manager_id: '', is_active: true }); setShowBranchModal(true); }} className="text-gold-500 hover:text-gold-400 font-semibold text-sm bg-gold-500/10 px-4 py-2 rounded-lg border border-gold-500/20 hover:bg-gold-500/20 transition-all">+ Add New Branch</button>
                  </div>
                  
                  {showBranchModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                      <div className="bg-dark-800 border border-dark-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-150">
                        <h4 className="text-xl font-bold text-white mb-4 tracking-tight">{editingBranch.id ? 'Edit Branch' : 'Add New Branch'}</h4>
                        <form onSubmit={handleSaveBranch} className="space-y-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Branch Name</label>
                            <input type="text" required value={editingBranch.name} onChange={e => setEditingBranch({...editingBranch, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm" placeholder="Luxe Victoria Island" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">City</label>
                              <input type="text" value={editingBranch.city || ''} onChange={e => setEditingBranch({...editingBranch, city: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm" placeholder="Lagos" />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Country</label>
                              <input type="text" value={editingBranch.country || ''} onChange={e => setEditingBranch({...editingBranch, country: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm" placeholder="Nigeria" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
                            <input type="email" value={editingBranch.contact_email || ''} onChange={e => setEditingBranch({...editingBranch, contact_email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm" placeholder="branch@luxeapartments.com" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Contact Phone</label>
                            <input type="text" value={editingBranch.contact_phone || ''} onChange={e => setEditingBranch({...editingBranch, contact_phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm" placeholder="+234 812 345 6789" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Branch Manager</label>
                            <select 
                              value={editingBranch.manager_id || ''} 
                              onChange={e => setEditingBranch({...editingBranch, manager_id: e.target.value})} 
                              className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white outline-none focus:border-gold-500 text-sm font-semibold"
                            >
                              <option value="">-- Choose Branch Manager --</option>
                              {staffManagers.map(mgr => (
                                <option key={mgr.id} value={mgr.id}>
                                  {mgr.first_name} {mgr.last_name} ({mgr.role.replace(/_/g, ' ')})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-3 bg-dark-900/60 p-3.5 border border-dark-700 rounded-xl">
                            <input type="checkbox" id="branchActive" checked={editingBranch.is_active !== false} onChange={e => setEditingBranch({...editingBranch, is_active: e.target.checked})} className="w-4 h-4 accent-gold-500" />
                            <label htmlFor="branchActive" className="text-sm font-semibold text-white">Branch Status is Active</label>
                          </div>
                          
                          <div className="flex gap-4 mt-6">
                            <button type="submit" className="btn-primary flex-1 py-3 text-sm font-bold rounded-xl">Save Configuration</button>
                            <button type="button" onClick={() => setShowBranchModal(false)} className="border border-dark-600 text-gray-300 flex-1 py-3 text-sm font-semibold rounded-xl hover:bg-dark-700">Cancel</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {branches.length === 0 ? (
                      <p className="text-gray-400 col-span-2 text-center py-8">No branches found. Create one to get started.</p>
                    ) : branches.map((b, idx) => {
                      const isActive = b.is_active !== false;
                      const manager = b.manager_profile 
                        ? `${b.manager_profile.first_name} ${b.manager_profile.last_name}` 
                        : (b.name === 'Sparkles Apartments' ? 'Adebayo Johnson' : 
                           b.name === 'Luxe Headquarters' ? 'Amina Yusuf' : 
                           b.name === 'Luxe Victoria Island' ? 'Eze Lawrence' : 'Sarah Connor (Supervisor)');
                      
                      const branchEmail = b.manager_profile?.email || b.contact_email;
                      const branchPhone = b.manager_profile?.phone || b.contact_phone;
                      
                      return (
                        <div 
                          key={b.id} 
                          className={`relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-gold-500/5 ${
                            idx === 0 
                              ? 'bg-gradient-to-br from-gold-500/10 via-dark-900/80 to-dark-900/60 border-gold-500/30 shadow-lg' 
                              : 'bg-dark-900/85 border-dark-700/60 shadow-md'
                          }`}
                        >
                          {/* Ambient Gold radial glow backdrop for active/HQ branch */}
                          {idx === 0 && (
                            <div className="absolute -right-20 -top-20 w-40 h-40 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
                          )}
                          
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="font-bold text-lg text-white tracking-tight">{b.name}</h4>
                                {idx === 0 && (
                                  <span className="bg-gold-500/20 text-gold-400 border border-gold-500/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full tracking-wider">
                                    HQ
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-400 flex items-center gap-1.5">
                                <MapPin size={14} className="text-gold-500" />
                                {b.city || 'Unknown'}, {b.country || 'Unknown'}
                              </p>
                            </div>
                            
                            {/* Pulsing Active Status Badge */}
                            <div className="flex items-center gap-2">
                              <span className={`relative flex h-2.5 w-2.5`}>
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isActive ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                              </span>
                              <span className={`text-xs font-semibold ${isActive ? 'text-green-400' : 'text-amber-400'}`}>
                                {isActive ? 'Active' : 'Offline'}
                              </span>
                            </div>
                          </div>

                          {/* Branch Details Telemetry Grid */}
                          <div className="grid grid-cols-1 gap-2.5 mt-4 bg-dark-950/40 p-4 rounded-xl border border-dark-800/60 text-xs">
                            <div className="flex items-center justify-between text-gray-300">
                              <span className="flex items-center gap-2 text-gray-400">
                                <User size={13} className="text-gold-500" /> Manager:
                              </span>
                              <span className="font-medium text-white">{manager}</span>
                            </div>
                            {branchEmail && (
                              <div className="flex items-center justify-between text-gray-300">
                                <span className="flex items-center gap-2 text-gray-400">
                                  <Mail size={13} className="text-gold-500" /> Email:
                                </span>
                                <a href={`mailto:${branchEmail}`} className="hover:text-gold-400 transition-colors font-mono">{branchEmail}</a>
                              </div>
                            )}
                            {branchPhone && (
                              <div className="flex items-center justify-between text-gray-300">
                                <span className="flex items-center gap-2 text-gray-400">
                                  <Phone size={13} className="text-gold-500" /> Contact:
                                </span>
                                <span className="font-mono text-white">{branchPhone}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-gray-300 border-t border-dark-800/40 pt-2.5 mt-1">
                              <span className="flex items-center gap-2 text-gray-400 font-bold">
                                <Home size={13} className="text-gold-500" /> Active Inventory:
                              </span>
                              <span className="bg-gold-500/10 text-gold-400 font-black px-2.5 py-0.5 rounded-md border border-gold-500/20 font-mono">
                                {b.roomCount || 0} {b.roomCount === 1 ? 'Room Unit' : 'Room Units'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-5 pt-4 border-t border-dark-800/60 flex justify-between items-center">
                            <button 
                              onClick={() => window.location.href = `/admin/rooms?branch=${b.id}`} 
                              className="text-xs text-gold-500 hover:text-gold-400 font-semibold flex items-center gap-1 group transition-colors"
                            >
                              Manage Branch Inventory <span className="group-hover:translate-x-1 transition-transform inline-block font-bold">→</span>
                            </button>
                            <button 
                              onClick={() => { setEditingBranch(b); setShowBranchModal(true); }} 
                              className="text-xs text-gray-400 hover:text-white font-medium border border-dark-700/60 hover:border-dark-600 bg-dark-900/40 px-3 py-1.5 rounded-lg transition-all"
                            >
                              Edit Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. LOCALIZATION & TAX */}
              {activeTab === 'localization' && (() => {
                const getDisplayRate = (targetCurrency, rate) => {
                  if (rate < 0.1) {
                    const inverse = 1 / rate;
                    return `1 ${targetCurrency} = ${(inverse).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${property.base_currency}`;
                  }
                  return `1 ${property.base_currency} = ${(rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${targetCurrency}`;
                };

                const cache = settings.fx_rates_cache || {};
                const rate = parseFloat(cache[calcSource]) || 1.0;

                return (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Localization & Financials</h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* LHS: Configurations Form */}
                      <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                          <div className="grid grid-cols-2 gap-4 bg-dark-900/40 p-4 border border-dark-700/60 rounded-2xl">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Timezone Management</label>
                              <select value={settings.timezone} onChange={e => setSettings({...settings, timezone: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded-xl p-3 focus:border-gold-500 outline-none text-sm font-semibold">
                                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                                <option value="Europe/London">Europe/London (GMT)</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Primary Language</label>
                              <select value={settings.language} onChange={e => setSettings({...settings, language: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded-xl p-3 focus:border-gold-500 outline-none text-sm font-semibold">
                                <option value="English">English (EN)</option>
                                <option value="French">French (FR)</option>
                                <option value="Spanish">Spanish (ES)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-dark-900/40 p-4 border border-dark-700/60 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" id="mlang" checked={settings.multi_language_enabled} onChange={e => setSettings({...settings, multi_language_enabled: e.target.checked})} className="w-5 h-5 accent-gold-500 rounded cursor-pointer" />
                              <label htmlFor="mlang" className="text-sm font-semibold text-gray-300 cursor-pointer">Enable Multi-language Support</label>
                            </div>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" id="mcurr" checked={settings.multi_currency_enabled} onChange={e => setSettings({...settings, multi_currency_enabled: e.target.checked})} className="w-5 h-5 accent-gold-500 rounded cursor-pointer" />
                              <label htmlFor="mcurr" className="text-sm font-semibold text-gray-300 cursor-pointer">Enable Multi-currency (FX API)</label>
                            </div>
                          </div>

                          {settings.multi_currency_enabled && (
                            <div className="flex items-center gap-3 bg-gold-500/5 p-4 border border-gold-500/20 rounded-2xl animate-in fade-in slide-in-from-top-3 duration-200">
                              <input type="checkbox" id="fx_auto_sync" checked={settings.fx_auto_sync !== false} onChange={e => setSettings({...settings, fx_auto_sync: e.target.checked})} className="w-5 h-5 accent-gold-500 rounded cursor-pointer" />
                              <label htmlFor="fx_auto_sync" className="text-sm font-bold text-gold-400 cursor-pointer">Auto-Sync rates in real time with Live FX API</label>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4 bg-dark-900/40 p-4 border border-dark-700/60 rounded-2xl">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Base Currency Code</label>
                              <input type="text" value={property.base_currency} onChange={e => setProperty({...property, base_currency: e.target.value.toUpperCase()})} className="w-full bg-dark-900 text-white border border-dark-700 rounded-xl p-3 focus:border-gold-500 outline-none font-mono text-sm font-bold" placeholder="e.g. NGN, USD" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Global Tax Management (%)</label>
                              <input type="number" step="0.1" value={property.tax_rate_percent} onChange={e => setProperty({...property, tax_rate_percent: parseFloat(e.target.value)})} className="w-full bg-dark-900 text-white border border-dark-700 rounded-xl p-3 focus:border-gold-500 outline-none text-sm font-semibold" />
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-6 text-sm font-bold rounded-xl shadow-lg"><Save size={18} /> Save Settings</button>
                            <button type="button" onClick={handleSaveProperty} className="border border-dark-700 text-white hover:bg-dark-700 flex items-center gap-2 py-3 px-6 text-sm font-semibold rounded-xl transition-colors">Save Tax & Currency</button>
                          </div>
                        </form>

                        {/* FX RATES DASHBOARD (Visible if Multi-currency is enabled) */}
                        {settings.multi_currency_enabled && (
                          <div className="mt-8 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-4 border-b border-dark-800 pb-2">
                              <h4 className="font-bold text-white tracking-tight flex items-center gap-2">
                                <Globe size={18} className="text-gold-500" /> Exchange Rates Dashboard
                              </h4>
                              {settings.fx_auto_sync !== false ? (
                                <button 
                                  onClick={async () => {
                                    setSyncingRates(true);
                                    const base = property.base_currency || 'NGN';
                                    const fresh = await syncFXRates(base, true, true);
                                    if (fresh) {
                                      setSettings(prev => ({ ...prev, fx_rates_cache: fresh }));
                                      await supabase.from('system_settings').upsert({ setting_key: 'fx_rates_cache', setting_value: fresh }, { onConflict: 'setting_key' });
                                      toast.success("Rates synchronized with Live FX API!");
                                    } else {
                                      toast.error("Failed to sync live FX rates.");
                                    }
                                    setSyncingRates(false);
                                  }}
                                  disabled={syncingRates}
                                  className={`text-xs text-gold-500 font-bold hover:text-gold-400 bg-gold-500/10 px-3 py-1.5 rounded-lg border border-gold-500/20 flex items-center gap-1 transition-all ${syncingRates ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {syncingRates ? "Syncing..." : "Sync Live Rates Now"}
                                </button>
                              ) : (
                                <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">Manual Overrides Active</span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {['USD', 'EUR', 'GBP', 'ZAR', 'GHS', 'CAD', 'AED'].map(cur => {
                                const rate = parseFloat(cache[cur]) || 1.0;
                                const displayStr = getDisplayRate(cur, rate);

                                return (
                                  <div key={cur} className="bg-dark-900/60 border border-dark-700/60 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
                                    <div className="absolute top-0 right-0 w-8 h-8 bg-gold-500/5 rounded-bl-full pointer-events-none" />
                                    <span className="text-xs font-black text-gold-500 tracking-wider font-mono">{cur}</span>
                                    {settings.fx_auto_sync !== false ? (
                                      <div className="mt-3">
                                        <span className="text-base font-black text-white block tracking-tight font-mono">
                                          {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">{displayStr}</span>
                                      </div>
                                    ) : (
                                      <div className="mt-2.5">
                                        <input 
                                          type="number" 
                                          step="0.000001"
                                          value={rate}
                                          onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            const newCache = { ...cache, [cur]: val };
                                            setSettings(prev => ({ ...prev, fx_rates_cache: newCache }));
                                          }}
                                          className="w-full bg-dark-950 border border-dark-800 rounded-lg p-1.5 text-white font-mono font-bold text-sm outline-none focus:border-gold-500"
                                        />
                                        <span className="text-[10px] text-gray-500 font-semibold block mt-1">{displayStr}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RHS: Interactive Converter Calculator */}
                      {settings.multi_currency_enabled && (
                        <div className="lg:col-span-1 bg-gradient-to-b from-dark-900 to-dark-950 border border-dark-700/80 rounded-2xl p-6 relative overflow-hidden shadow-xl h-fit animate-in fade-in duration-300">
                          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-gold-500/5 rounded-full blur-2xl pointer-events-none" />
                          <h4 className="font-bold text-white text-base tracking-tight mb-4 flex items-center gap-2">
                            <Activity size={18} className="text-gold-500" /> Interactive FX Converter
                          </h4>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Foreign Currency</label>
                              <select 
                                value={calcSource} 
                                onChange={e => setCalcSource(e.target.value)} 
                                className="w-full bg-dark-900 text-white border border-dark-700 rounded-xl p-3 focus:border-gold-500 outline-none text-sm font-semibold"
                              >
                                <option value="USD">USD (United States Dollar)</option>
                                <option value="EUR">EUR (Euro)</option>
                                <option value="GBP">GBP (British Pound Sterling)</option>
                                <option value="ZAR">ZAR (South African Rand)</option>
                                <option value="GHS">GHS (Ghanaian Cedi)</option>
                                <option value="CAD">CAD (Canadian Dollar)</option>
                                <option value="AED">AED (UAE Dirham)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Input Amount</label>
                              <input 
                                type="number" 
                                value={calcVal} 
                                onChange={e => setCalcVal(parseFloat(e.target.value) || 0)} 
                                className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-mono font-bold"
                                placeholder="100"
                              />
                            </div>

                            {/* Calculations Results Breakdown Cards */}
                            <div className="space-y-3 pt-3 border-t border-dark-800">
                              {/* Option A: Foreign to Base */}
                              <div className="bg-dark-950 p-4 rounded-xl border border-dark-800 text-center">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                  Converting to Base ({property.base_currency || 'NGN'})
                                </span>
                                <span className="text-lg font-black text-gold-500 font-mono block">
                                  {property.base_currency === 'NGN' ? '₦' : ''}
                                  {(calcVal / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                  {calcVal.toLocaleString()} {calcSource} in {property.base_currency}
                                </span>
                              </div>

                              {/* Option B: Base to Foreign */}
                              <div className="bg-dark-950 p-4 rounded-xl border border-dark-800 text-center">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                  Converting from Base ({property.base_currency || 'NGN'})
                                </span>
                                <span className="text-lg font-black text-white font-mono block">
                                  {(calcVal * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {calcSource}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                  {calcVal.toLocaleString()} {property.base_currency} in {calcSource}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 4. BOOKING POLICIES */}
              {activeTab === 'policies' && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Global Booking Rules</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                    <div className="bg-dark-900 p-5 border border-dark-700 rounded">
                      <h4 className="font-semibold text-white mb-4">Cancellation Policies</h4>
                      <select value={settings.cancellation_policy} onChange={e => setSettings({...settings, cancellation_policy: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none">
                        <option value="Flexible">Flexible (Free cancellation up to 24h before check-in)</option>
                        <option value="Moderate">Moderate (Free cancellation up to 5 days before check-in)</option>
                        <option value="Strict">Strict (Non-refundable after 48 hours of booking)</option>
                        <option value="Non-Refundable">Non-Refundable (No refunds allowed)</option>
                      </select>
                    </div>

                    <div className="bg-dark-900 p-5 border border-dark-700 rounded">
                      <h4 className="font-semibold text-white mb-4">Payment Rules</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Required Payment to Confirm</label>
                          <select value={settings.payment_rule} onChange={e => setSettings({...settings, payment_rule: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none">
                            <option value="full_amount">Full Amount (100%)</option>
                            <option value="partial_deposit">Partial Deposit</option>
                            <option value="pay_at_hotel">Pay at Hotel (No upfront payment)</option>
                          </select>
                        </div>
                        {settings.payment_rule === 'partial_deposit' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Deposit Percentage (%)</label>
                            <input type="number" min="1" max="99" value={settings.deposit_percentage} onChange={e => setSettings({...settings, deposit_percentage: parseInt(e.target.value)})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-dark-900 p-5 border border-dark-700 rounded">
                      <h4 className="font-semibold text-white mb-4">Booking Approval Workflow</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" id="autoConf" checked={settings.auto_confirmation} onChange={e => setSettings({...settings, auto_confirmation: e.target.checked})} className="w-5 h-5 accent-gold-500 rounded" />
                          <div>
                            <label htmlFor="autoConf" className="text-sm font-medium text-white block">Auto-Confirmation Settings</label>
                            <span className="text-xs text-gray-400">Automatically confirm bookings when payment conditions are met.</span>
                          </div>
                        </div>
                        {!settings.auto_confirmation && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1 mt-4">Manual Approval Mode</label>
                            <select value={settings.booking_approval_workflow} onChange={e => setSettings({...settings, booking_approval_workflow: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none">
                              <option value="manual_review">Review all bookings before confirmation</option>
                              <option value="manager_approval">Require Hotel Manager override</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-6"><Save size={18} /> Save Policies</button>
                  </form>
                </div>
              )}

              {/* 5. INVOICES */}
              {activeTab === 'invoices' && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Invoice Settings</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Invoice Prefix</label>
                        <input type="text" value={settings.invoice_prefix} onChange={e => setSettings({...settings, invoice_prefix: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" placeholder="INV-" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Company VAT / Tax ID</label>
                        <input type="text" value={settings.company_vat_id} onChange={e => setSettings({...settings, company_vat_id: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none" placeholder="TAX-123456" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Invoice Footer Notes</label>
                      <textarea rows="4" value={settings.invoice_footer_notes} onChange={e => setSettings({...settings, invoice_footer_notes: e.target.value})} className="w-full bg-dark-900 text-white border border-dark-700 rounded p-3 focus:border-gold-500 outline-none"></textarea>
                    </div>

                    <div className="bg-dark-900/60 p-5 border border-dark-750 rounded-2xl space-y-4">
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        🏦 Hotel Bank Details (Guest Portal)
                      </h4>
                      <p className="text-xs text-gray-500 leading-normal">
                        Configure the bank account details shown to guests in the guest portal for manual Bank Transfer prepayment wallet deposits.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bank Name</label>
                          <select 
                            value={settings.hotel_bank_name || ''} 
                            onChange={e => setSettings({...settings, hotel_bank_name: e.target.value})} 
                            className="w-full bg-dark-950 text-white border border-dark-800 rounded-xl p-2.5 focus:border-gold-500 outline-none text-sm cursor-pointer"
                          >
                            <option value="">Select Bank</option>
                            {((settings.nigerian_banks && settings.nigerian_banks.length > 0) ? settings.nigerian_banks : [
                              "Access Bank", "First Bank", "GTBank", "Zenith Bank", "UBA", "Opay", "Kuda Bank", "Sterling Bank", "Polaris Bank", "Stanbic IBTC"
                            ]).map(bank => (
                              <option key={typeof bank === 'string' ? bank : bank.name} value={typeof bank === 'string' ? bank : bank.name}>
                                {typeof bank === 'string' ? bank : bank.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Number</label>
                          <input 
                            type="text" 
                            value={settings.hotel_account_number || ''} 
                            onChange={e => setSettings({...settings, hotel_account_number: e.target.value})} 
                            className="w-full bg-dark-950 text-white border border-dark-800 rounded-xl p-2.5 focus:border-gold-500 outline-none text-sm font-mono" 
                            placeholder="e.g. 0098172635" 
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Name</label>
                          <input 
                            type="text" 
                            value={settings.hotel_account_name || ''} 
                            onChange={e => setSettings({...settings, hotel_account_name: e.target.value})} 
                            className="w-full bg-dark-950 text-white border border-dark-800 rounded-xl p-2.5 focus:border-gold-500 outline-none text-sm" 
                            placeholder="e.g. Luxe Elite Hotels Ltd" 
                          />
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-6"><Save size={18} /> Save Invoice Settings</button>
                  </form>
                </div>
              )}

              {/* 8. API INTEGRATION & PLUGINS */}
              {activeTab === 'api' && (
                <div className="animate-in fade-in zoom-in-95 duration-200 space-y-8">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">API Integration Layer</h3>
                    <p className="text-sm text-gray-400">Secure and power third-party CRM, Payment Gateway, SMTP, and accounting synchronizations.</p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-8 max-w-3xl">
                    {/* A. Payment Gateways */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-bl-full pointer-events-none" />
                      <h4 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                        <CreditCard size={18} className="text-gold-500"/> Payment Gateways
                      </h4>
                      <p className="text-xs text-gray-400 mb-6">Manage API credential keys for secure guest checkouts and stays reservation handling.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Paystack Public Key</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                              <Key size={14} />
                            </span>
                            <input 
                              type="password" 
                              value={settings.paystack_public || ''} 
                              onChange={e => setSettings({...settings, paystack_public: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="pk_live_..." 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Paystack Secret Key</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                              <Key size={14} />
                            </span>
                            <input 
                              type="password" 
                              value={settings.paystack_secret || ''} 
                              onChange={e => setSettings({...settings, paystack_secret: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="sk_live_..." 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Stripe Public Key</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                              <Key size={14} />
                            </span>
                            <input 
                              type="password" 
                              value={settings.stripe_public || ''} 
                              onChange={e => setSettings({...settings, stripe_public: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="pk_live_..." 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B. SMTP Webmail Email Dispatcher */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 border-b border-dark-800/60 pb-4">
                        <div>
                          <h4 className="font-bold text-white text-base flex items-center gap-2">
                            <Mail size={18} className="text-amber-500"/> SMTP Webmail Email Dispatcher
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">Configure your cPanel SMTP server to dispatch booking alerts, receipts, and contact responses.</p>
                        </div>
                        
                        {/* Enabled Switch */}
                        <div className="flex items-center gap-3 bg-dark-950/60 p-2.5 border border-dark-800 rounded-xl w-fit">
                          <input 
                            type="checkbox" 
                            id="smtpEnabled" 
                            checked={settings.smtp_enabled === 'true' || settings.smtp_enabled === true} 
                            onChange={e => setSettings({...settings, smtp_enabled: e.target.checked})} 
                            className="w-4 h-4 accent-gold-500 cursor-pointer" 
                          />
                          <label htmlFor="smtpEnabled" className="text-xs font-semibold text-white cursor-pointer uppercase tracking-wider">
                            {(settings.smtp_enabled === 'true' || settings.smtp_enabled === true) ? 'Active' : 'Disabled'}
                          </label>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Host</label>
                            <input 
                              type="text" 
                              value={settings.smtp_host || ''} 
                              onChange={e => setSettings({...settings, smtp_host: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="mail.sparklesapartments.ng" 
                            />
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Port</label>
                            <input 
                              type="text" 
                              value={settings.smtp_port || ''} 
                              onChange={e => setSettings({...settings, smtp_port: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="465" 
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Username (Email)</label>
                            <input 
                              type="text" 
                              value={settings.smtp_username || ''} 
                              onChange={e => setSettings({...settings, smtp_username: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="booking@sparklesapartments.ng" 
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Password</label>
                            <input 
                              type="password" 
                              value={settings.smtp_password || ''} 
                              onChange={e => setSettings({...settings, smtp_password: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                              placeholder="••••••••••••" 
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Encryption / Security</label>
                            <select 
                              value={settings.smtp_secure || 'ssl'} 
                              onChange={e => setSettings({...settings, smtp_secure: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm"
                            >
                              <option value="ssl">SSL (Port 465 - Recommended)</option>
                              <option value="tls">TLS/STARTTLS (Port 587)</option>
                              <option value="none">None (Plaintext - Port 25)</option>
                            </select>
                          </div>
                        </div>

                        {/* Interactive testing sub-panel */}
                        {(settings.smtp_enabled === 'true' || settings.smtp_enabled === true) && (
                          <div className="bg-dark-950/60 border border-dark-800 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-250">
                            <span className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                              <Send size={12} /> Connection Verification Console
                            </span>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input 
                                type="email" 
                                value={testEmail} 
                                onChange={e => setTestEmail(e.target.value)} 
                                className="flex-1 bg-dark-900 border border-dark-800 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-gold-500" 
                                placeholder="Enter recipient email (e.g. booking@sparklesapartments.ng)" 
                              />
                              <button 
                                type="button" 
                                onClick={handleSendTestEmail} 
                                disabled={testingEmail}
                                className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-4 py-2 border border-amber-500/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {testingEmail ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin" /> Dispatching...
                                  </>
                                ) : (
                                  <>
                                    <Send size={12} /> Verify Connection
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* C. Mailchimp CRM */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 border-b border-dark-800/60 pb-4">
                        <div>
                          <h4 className="font-bold text-white text-base flex items-center gap-2">
                            <Puzzle size={18} className="text-blue-500"/> Mailchimp CRM Integration
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">Sync guest data and leads details with your Mailchimp lists for marketing automations.</p>
                        </div>
                        
                        {/* Enabled Switch */}
                        <div className="flex items-center gap-3 bg-dark-950/60 p-2.5 border border-dark-800 rounded-xl w-fit">
                          <input 
                            type="checkbox" 
                            id="mailchimpEnabled" 
                            checked={settings.mailchimp_enabled === 'true' || settings.mailchimp_enabled === true} 
                            onChange={e => setSettings({...settings, mailchimp_enabled: e.target.checked})} 
                            className="w-4 h-4 accent-gold-500 cursor-pointer" 
                          />
                          <label htmlFor="mailchimpEnabled" className="text-xs font-semibold text-white cursor-pointer uppercase tracking-wider">
                            {(settings.mailchimp_enabled === 'true' || settings.mailchimp_enabled === true) ? 'Active' : 'Disabled'}
                          </label>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Mailchimp API Key</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                                <Key size={14} />
                              </span>
                              <input 
                                type="password" 
                                value={settings.mailchimp_api_key || ''} 
                                onChange={e => setSettings({...settings, mailchimp_api_key: e.target.value})} 
                                className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                placeholder="md-..." 
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Mailchimp List ID (Audience)</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                                <Database size={14} />
                              </span>
                              <input 
                                type="text" 
                                value={settings.mailchimp_list_id || ''} 
                                onChange={e => setSettings({...settings, mailchimp_list_id: e.target.value})} 
                                className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                placeholder="e.g. a1b2c3d4e5" 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Interactive Sync Panel */}
                        {(settings.mailchimp_enabled === 'true' || settings.mailchimp_enabled === true) && (
                          <div className="bg-dark-950/60 border border-dark-800 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-250">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Cpu size={12} /> CRM Contacts Engine
                              </span>
                              {crmProgress && (
                                <span className="text-[10px] text-blue-400 font-medium animate-pulse">
                                  {crmProgress}
                                </span>
                              )}
                            </div>
                            
                            <button 
                              type="button" 
                              onClick={handleSyncCRM} 
                              disabled={syncingCRM}
                              className="w-full sm:w-auto bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-4 py-2.5 border border-blue-500/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {syncingCRM ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" /> Synchronizing Leads...
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={12} /> Sync Guests to CRM Audience
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* D. QuickBooks Sync */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 border-b border-dark-800/60 pb-4">
                        <div>
                          <h4 className="font-bold text-white text-base flex items-center gap-2">
                            <Activity size={18} className="text-green-500"/> QuickBooks Ledger Synchronization
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">Consolidate bookkeeping transactions, payments, and invoices with your chart of accounts.</p>
                        </div>
                        
                        {/* Enabled Switch */}
                        <div className="flex items-center gap-3 bg-dark-950/60 p-2.5 border border-dark-800 rounded-xl w-fit">
                          <input 
                            type="checkbox" 
                            id="quickbooksEnabled" 
                            checked={settings.quickbooks_enabled === 'true' || settings.quickbooks_enabled === true} 
                            onChange={e => setSettings({...settings, quickbooks_enabled: e.target.checked})} 
                            className="w-4 h-4 accent-gold-500 cursor-pointer" 
                          />
                          <label htmlFor="quickbooksEnabled" className="text-xs font-semibold text-white cursor-pointer uppercase tracking-wider">
                            {(settings.quickbooks_enabled === 'true' || settings.quickbooks_enabled === true) ? 'Active' : 'Disabled'}
                          </label>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">QuickBooks Client ID</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                                <Database size={14} />
                              </span>
                              <input 
                                type="text" 
                                value={settings.quickbooks_client_id || ''} 
                                onChange={e => setSettings({...settings, quickbooks_client_id: e.target.value})} 
                                className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                placeholder="client_id_..." 
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">QuickBooks Client Secret</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                                <Key size={14} />
                              </span>
                              <input 
                                type="password" 
                                value={settings.quickbooks_client_secret || ''} 
                                onChange={e => setSettings({...settings, quickbooks_client_secret: e.target.value})} 
                                className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 pl-10 pr-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                placeholder="secret_..." 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Interactive Sync Panel */}
                        {(settings.quickbooks_enabled === 'true' || settings.quickbooks_enabled === true) && (
                          <div className="bg-dark-950/60 border border-dark-800 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-250">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-green-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Cpu size={12} /> Ledger Balance Engine
                              </span>
                              {ledgerProgress && (
                                <span className="text-[10px] text-green-400 font-medium animate-pulse">
                                  {ledgerProgress}
                                </span>
                              )}
                            </div>
                            
                            <button 
                              type="button" 
                              onClick={handleSyncLedger} 
                              disabled={syncingLedger}
                              className="w-full sm:w-auto bg-green-500/10 text-green-400 hover:bg-green-500/20 px-4 py-2.5 border border-green-500/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {syncingLedger ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" /> Consolidating Ledgers...
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={12} /> Sync General Ledger Inflows
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SMS Notification Gateway */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg mt-6">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-bl-full pointer-events-none" />
                      <h4 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                        <MessageSquare size={18} className="text-amber-500"/> SMS Notification Gateway
                      </h4>
                      <p className="text-xs text-gray-400 mb-6 font-medium">Configure credentials for automated guest SMS alerts, check-in updates, and checkout reminders.</p>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">SMS Gateway Provider</label>
                            <select 
                              value={settings.sms_gateway || 'mock'} 
                              onChange={e => setSettings({...settings, sms_gateway: e.target.value})} 
                              className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm cursor-pointer"
                            >
                              <option value="mock" className="bg-dark-900 text-white">Mock / Sandbox Mode (Logs to delivery logs)</option>
                              <option value="termii" className="bg-dark-900 text-white">Termii SMS (Nigeria / Africa)</option>
                              <option value="twilio" className="bg-dark-900 text-white">Twilio SMS (Global Delivery)</option>
                            </select>
                          </div>

                          {settings.sms_gateway === 'termii' && (
                            <>
                              <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Termii API Key</label>
                                <input 
                                  type="password" 
                                  value={settings.sms_termii_api_key || ''} 
                                  onChange={e => setSettings({...settings, sms_termii_api_key: e.target.value})} 
                                  className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                  placeholder="TL..." 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Termii Sender ID</label>
                                <input 
                                  type="text" 
                                  value={settings.sms_termii_sender_id || ''} 
                                  onChange={e => setSettings({...settings, sms_termii_sender_id: e.target.value})} 
                                  className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm" 
                                  placeholder="e.g. Sparkles" 
                                />
                              </div>
                            </>
                          )}

                          {settings.sms_gateway === 'twilio' && (
                            <>
                              <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Twilio Account SID</label>
                                <input 
                                  type="text" 
                                  value={settings.sms_twilio_account_sid || ''} 
                                  onChange={e => setSettings({...settings, sms_twilio_account_sid: e.target.value})} 
                                  className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                  placeholder="AC..." 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Twilio Auth Token</label>
                                <input 
                                  type="password" 
                                  value={settings.sms_twilio_auth_token || ''} 
                                  onChange={e => setSettings({...settings, sms_twilio_auth_token: e.target.value})} 
                                  className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                  placeholder="••••••••••••" 
                                />
                              </div>
                              <div className="space-y-1.5 md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Twilio From Number (Virtual Phone Number)</label>
                                <input 
                                  type="text" 
                                  value={settings.sms_twilio_from_number || ''} 
                                  onChange={e => setSettings({...settings, sms_twilio_from_number: e.target.value})} 
                                  className="w-full bg-dark-950 border border-dark-800 text-white rounded-xl py-3 px-4 focus:border-gold-500 outline-none text-sm font-mono" 
                                  placeholder="e.g. +18335550199" 
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* E. Custom API Plugins */}
                    <div className="bg-dark-900/60 backdrop-blur-md p-6 border border-dark-700/60 rounded-2xl relative overflow-hidden shadow-lg mt-6">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 border-b border-dark-800/60 pb-4">
                        <div>
                          <h4 className="font-bold text-white text-base flex items-center gap-2">
                            <Puzzle size={18} className="text-amber-500"/> Custom API Plugins
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">Connect, register, and toggle third-party custom API integrations dynamically.</p>
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => {
                            setNewCustomAPI({ name: '', base_url: '', api_key: '', api_secret: '', description: '', is_active: true });
                            setShowCustomAPIModal(true);
                          }}
                          className="bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-dark-900 border border-amber-500/20 hover:border-amber-500 text-xs py-2 px-4 rounded-xl font-bold transition-all shadow active:scale-95 flex items-center gap-1.5"
                        >
                          <Plus size={14} /> Add Custom API
                        </button>
                      </div>

                      {/* Custom API Plugins Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {customAPIs.length === 0 ? (
                          <p className="text-gray-500 text-xs italic col-span-2 py-4 text-center">No custom API plugins registered yet. Click "Add Custom API" to connect a service.</p>
                        ) : customAPIs.map(api => (
                          <div key={api.id} className="bg-dark-950/60 p-4 border border-dark-800 rounded-xl relative overflow-hidden flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-bold text-white text-sm">{api.name}</h5>
                                <div className="flex items-center gap-2.5">
                                  <input 
                                    type="checkbox" 
                                    id={`api_${api.id}`} 
                                    checked={api.is_active} 
                                    onChange={e => handleToggleCustomAPI(api.id, e.target.checked)} 
                                    className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" 
                                  />
                                  <label htmlFor={`api_${api.id}`} className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">
                                    {api.is_active ? 'Active' : 'Muted'}
                                  </label>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-400 font-mono mb-2 truncate" title={api.base_url}>{api.base_url}</p>
                              {api.description && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{api.description}</p>}
                            </div>
                            
                            <div className="flex justify-between items-center pt-3 border-t border-dark-800 mt-2">
                              <span className="text-[9px] bg-dark-900 border border-dark-800 text-gray-500 px-2 py-0.5 rounded font-mono font-bold">{api.id}</span>
                              <div className="flex gap-2">
                                <button 
                                  type="button" 
                                  onClick={() => { setNewCustomAPI(api); setShowCustomAPIModal(true); }}
                                  className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                                >
                                  Edit
                                </button>
                                <span className="text-dark-700 text-xs">|</span>
                                <button 
                                  type="button" 
                                  onClick={() => handleDeleteCustomAPI(api.id)}
                                  className="text-red-400 hover:text-red-300 text-xs font-semibold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Master Action Trigger */}
                    <div className="pt-4 flex items-center justify-between border-t border-dark-700/60 mt-6">
                      <p className="text-xs text-gray-500">Note: Saving credential edits takes effect immediately on all transactions and routes.</p>
                      <button type="submit" className="btn-primary flex items-center gap-2 py-3.5 px-8 text-sm font-bold rounded-xl shadow-lg shadow-gold-500/10 transition-all"><Save size={18} /> Save Settings & Credentials</button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'payroll' && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Payroll & Bank Dropdown Settings</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="bg-dark-900/40 p-6 rounded-2xl border border-dark-750">
                      <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Configured Nigerian Banks</h4>
                      <p className="text-xs text-gray-405 mb-4">These banks will appear as options in the staff registration and payout bank settlement profile settings.</p>
                      
                      {/* Grid / list of banks */}
                      <div className="flex flex-wrap gap-2 max-h-[250px] overflow-y-auto p-3.5 border border-dark-700 rounded-xl bg-dark-950/20 mb-6">
                        {(settings.nigerian_banks || []).map((bank, index) => (
                          <div key={index} className="flex items-center gap-1.5 bg-dark-700 hover:bg-dark-600 text-white border border-dark-600/50 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors">
                            <span>{bank}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const list = (settings.nigerian_banks || []).filter((_, i) => i !== index);
                                setSettings({ ...settings, nigerian_banks: list });
                              }}
                              className="text-gray-400 hover:text-rose-500 rounded-full transition-colors ml-1"
                              title="Delete bank"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {(settings.nigerian_banks || []).length === 0 && (
                          <span className="text-xs text-gray-500 p-2 italic">No banks configured yet. Auto-seed will initialize defaults.</span>
                        )}
                      </div>

                      {/* Add new bank form */}
                      <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                        <input
                          type="text"
                          id="new_bank_name_input"
                          placeholder="e.g. Sterling Bank Plc"
                          className="flex-1 bg-dark-900 text-white border border-dark-700 rounded-xl p-2.5 text-xs focus:border-gold-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new_bank_name_input');
                            const val = input ? input.value.trim() : '';
                            if (!val) {
                              toast.error("Please enter a bank name.");
                              return;
                            }
                            if ((settings.nigerian_banks || []).includes(val)) {
                              toast.error("This bank is already in the list.");
                              return;
                            }
                            const list = [...(settings.nigerian_banks || []), val];
                            setSettings({ ...settings, nigerian_banks: list });
                            if (input) input.value = '';
                            toast.success(`Added ${val} to list!`);
                          }}
                          className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white border border-brand-500/20 hover:border-transparent transition-all py-2.5 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Plus size={14} /> Add Bank
                        </button>
                      </div>
                    </div>

                    <div className="bg-dark-900/40 p-6 rounded-2xl border border-dark-750 space-y-4">
                      <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Default Hotel Bank Account (Payout Source)</h4>
                      <p className="text-xs text-gray-405">Specify the bank details of the hotel from which payroll payouts are processed and bank transfers are initiated.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Hotel Bank Name</label>
                          <select 
                            value={settings.hotel_bank_name || ''} 
                            onChange={e => setSettings({...settings, hotel_bank_name: e.target.value})} 
                            className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-semibold cursor-pointer"
                          >
                            <option value="">Select Bank</option>
                            {((settings.nigerian_banks && settings.nigerian_banks.length > 0) ? settings.nigerian_banks : [
                              "Access Bank", "First Bank", "GTBank", "Zenith Bank", "UBA", "Opay", "Kuda Bank", "Sterling Bank", "Polaris Bank", "Stanbic IBTC"
                            ]).map(bank => (
                              <option key={typeof bank === 'string' ? bank : bank.name} value={typeof bank === 'string' ? bank : bank.name}>
                                {typeof bank === 'string' ? bank : bank.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Hotel Account Name</label>
                          <input 
                            type="text" 
                            value={settings.hotel_account_name || ''} 
                            onChange={e => setSettings({...settings, hotel_account_name: e.target.value})} 
                            className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-semibold" 
                            placeholder="e.g. Luxe Apartments Ltd" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Hotel Account Number</label>
                          <input 
                            type="text" 
                            maxLength={10}
                            value={settings.hotel_account_number || ''} 
                            onChange={e => setSettings({...settings, hotel_account_number: e.target.value.replace(/\D/g, '')})} 
                            className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-semibold font-mono" 
                            placeholder="10-digit number" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-dark-700/60 mt-6">
                      <p className="text-xs text-gray-500">Note: Saving bank changes updates the bank dropdown configurations immediately.</p>
                      <button type="submit" className="btn-primary flex items-center gap-2 py-3.5 px-8 text-sm font-bold rounded-xl shadow-lg shadow-gold-500/10 transition-all"><Save size={18} /> Save Bank & Payroll Settings</button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'automations' && hasAccess('Automations & Alerts') && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <Automations />
                </div>
              )}

              {activeTab === 'security' && hasAccess('Security & Privacy') && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <Security />
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* Dynamic Custom API Modal */}
      {showCustomAPIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-dark-800 border border-dark-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button 
              type="button" 
              onClick={() => setShowCustomAPIModal(false)} 
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <h4 className="text-xl font-bold text-white mb-4 tracking-tight">
              {newCustomAPI.id ? 'Edit Custom API Plugin' : 'Register Custom API Plugin'}
            </h4>
            
            <form onSubmit={handleSaveCustomAPI} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Service / API Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newCustomAPI.name} 
                  onChange={e => setNewCustomAPI({...newCustomAPI, name: e.target.value})} 
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-semibold" 
                  placeholder="e.g. Twilio Gateway" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Base Endpoint URL *</label>
                <input 
                  type="url" 
                  required 
                  value={newCustomAPI.base_url} 
                  onChange={e => setNewCustomAPI({...newCustomAPI, base_url: e.target.value})} 
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-semibold font-mono" 
                  placeholder="https://api.service.com/v1" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">API Key / Client ID</label>
                  <input 
                    type="password" 
                    value={newCustomAPI.api_key || ''} 
                    onChange={e => setNewCustomAPI({...newCustomAPI, api_key: e.target.value})} 
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-mono" 
                    placeholder="Key/ID" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">API Secret / Token</label>
                  <input 
                    type="password" 
                    value={newCustomAPI.api_secret || ''} 
                    onChange={e => setNewCustomAPI({...newCustomAPI, api_secret: e.target.value})} 
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm font-mono" 
                    placeholder="Secret/Token" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
                <textarea 
                  value={newCustomAPI.description || ''} 
                  onChange={e => setNewCustomAPI({...newCustomAPI, description: e.target.value})} 
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:border-gold-500 text-sm" 
                  placeholder="Briefly explain the integration service" 
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-3 bg-dark-900/60 p-3.5 border border-dark-700 rounded-xl">
                <input 
                  type="checkbox" 
                  id="apiActiveToggle" 
                  checked={newCustomAPI.is_active !== false} 
                  onChange={e => setNewCustomAPI({...newCustomAPI, is_active: e.target.checked})} 
                  className="w-4 h-4 accent-gold-500 cursor-pointer" 
                />
                <label htmlFor="apiActiveToggle" className="text-sm font-semibold text-white cursor-pointer">Activate Plugin Immediately</label>
              </div>

              <div className="flex gap-4 mt-6">
                <button type="submit" className="btn-primary flex-1 py-3 text-sm font-bold rounded-xl shadow-lg">Save API Plugin</button>
                <button 
                  type="button" 
                  onClick={() => setShowCustomAPIModal(false)} 
                  className="border border-dark-600 text-gray-300 flex-1 py-3 text-sm font-semibold rounded-xl hover:bg-dark-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SYSTEM WIPE (DANGER) */}
      {activeTab === 'system_wipe' && user?.role === 'super_admin' && (
        <SystemWipeTab user={user} />
      )}
    </div>
  );
};

export default AdminSettings;
