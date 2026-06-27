import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Strong password validator (minimum 6 characters including uppercase, lowercase, numbers, and symbols)
export const validateStrongPassword = (password) => {
  if (!password) return "Password cannot be empty.";
  if (password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[!@#$%^&*(),.?":{}|<>\-_]/.test(password)) return "Password must contain at least one special symbol (e.g. !, @, #, $, %, etc.).";
  return null;
};

// Generate and persist unique browser device signature for concurrent device gates
export const getOrCreateDeviceId = () => {
  let id = localStorage.getItem('luxe_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('luxe_device_id', id);
  }
  return id;
};

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const lastDbUpdateRef = useRef(0);

  // Global Theme Syncing Loader (propagate theme-slate-dark, theme-luxe-gold, etc.)
  useEffect(() => {
    const applyTheme = async () => {
      // 1. Instant load from localStorage
      const localTheme = localStorage.getItem('system_theme');
      if (localTheme) {
        const isSlateDark = localTheme === 'theme-slate-dark';
        document.documentElement.className = isSlateDark ? `dark ${localTheme}` : localTheme;
        if (localTheme === 'theme-custom') {
          const localHue = localStorage.getItem('theme_hue') || '24';
          document.documentElement.style.setProperty('--brand-400', `hsl(${localHue}, 80%, 65%)`);
          document.documentElement.style.setProperty('--brand-500', `hsl(${localHue}, 70%, 50%)`);
          document.documentElement.style.setProperty('--brand-600', `hsl(${localHue}, 70%, 40%)`);
        }
      }
      
      // 2. Async check from system_settings
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'system_theme')
          .maybeSingle();
          
        if (!error && data?.setting_value) {
          const dbTheme = data.setting_value;
          const isSlateDark = dbTheme === 'theme-slate-dark';
          document.documentElement.className = isSlateDark ? `dark ${dbTheme}` : dbTheme;
          localStorage.setItem('system_theme', dbTheme);
          
          if (dbTheme === 'theme-custom') {
            const { data: hueData } = await supabase
              .from('system_settings')
              .select('setting_value')
              .eq('setting_key', 'theme_hue')
              .maybeSingle();
              
            if (hueData?.setting_value) {
              const dbHue = hueData.setting_value;
              localStorage.setItem('theme_hue', dbHue);
              document.documentElement.style.setProperty('--brand-400', `hsl(${dbHue}, 80%, 65%)`);
              document.documentElement.style.setProperty('--brand-500', `hsl(${dbHue}, 70%, 50%)`);
              document.documentElement.style.setProperty('--brand-600', `hsl(${dbHue}, 70%, 40%)`);
            }
          } else {
            document.documentElement.style.removeProperty('--brand-400');
            document.documentElement.style.removeProperty('--brand-500');
            document.documentElement.style.removeProperty('--brand-600');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch system theme on startup:", err);
      }
    };

    applyTheme();
  }, []);

  // Touch/Heartbeat database entry for user session (rate-limited)
  const touchSession = async (userId) => {
    try {
      const deviceId = getOrCreateDeviceId();
      lastDbUpdateRef.current = Date.now();
      
      const { error } = await supabase
        .from('user_active_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_id', deviceId);

      if (error && error.code !== 'PGRST116') {
        console.warn("Session touch warning (table may not exist):", error);
      }
    } catch (e) {
      console.warn("Session touch error caught:", e);
    }
  };

  // Enforce maximum 2 concurrent active device sessions (self-healing eviction policy)
  const checkDeviceSessions = async (userId) => {
    const deviceId = getOrCreateDeviceId();
    const deviceInfo = navigator.userAgent;
    
    try {
      // 1. Delete expired sessions older than 30 minutes (self-cleaning)
      const idleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      try {
        await supabase
          .from('user_active_sessions')
          .delete()
          .lt('last_active_at', idleThreshold);
      } catch (e) {
        console.warn("Active session cleanup skipped:", e);
      }

      // 2. Query active sessions for the user
      const { data: sessions, error } = await supabase
        .from('user_active_sessions')
        .select('*')
        .eq('user_id', userId);
        
      if (error) {
        // Handle gracefully if the table doesn't exist in Supabase yet (code 42P01 or PGRST204)
        if (error.code === 'PGRST204' || error.code === '42P01' || error.message.includes('relation "user_active_sessions" does not exist')) {
          console.warn("Table user_active_sessions is offline. Bypass Concurrent Device Gate.");
          return true;
        }
        throw error;
      }

      const activeOtherSessions = (sessions || []).filter(s => s.device_id !== deviceId);
      
      if (activeOtherSessions.length >= 2) {
        // Self-Healing Eviction: Sort sessions by last_active_at ascending (oldest first)
        const sortedOthers = [...activeOtherSessions].sort((a, b) => new Date(a.last_active_at) - new Date(b.last_active_at));
        
        // Evict oldest sessions to ensure exactly 1 other session remains (making slot for current session)
        const sessionsToEvict = sortedOthers.slice(0, activeOtherSessions.length - 1);
        
        for (const sessionToEvict of sessionsToEvict) {
          try {
            await supabase
              .from('user_active_sessions')
              .delete()
              .eq('id', sessionToEvict.id);
            console.log("Evicted oldest active concurrent session slot:", sessionToEvict.id);
          } catch (e) {
            console.warn("Failed to evict stale session:", e);
          }
        }
        
        toast('Device limit reached. Automatically signed out oldest active device to grant access.', { icon: 'ℹ️' });
      }

      // 3. Upsert current session
      const { error: upsertErr } = await supabase
        .from('user_active_sessions')
        .upsert({
          user_id: userId,
          device_id: deviceId,
          device_info: deviceInfo,
          last_active_at: new Date().toISOString()
        }, { onConflict: 'user_id,device_id' });

      if (upsertErr) {
        console.warn("Failed to register/upsert current device session:", upsertErr);
      }
      
      lastDbUpdateRef.current = Date.now();
      return true;
    } catch (err) {
      console.warn("Concurrent session limit bypass active (fail-safe enabled):", err);
      return true; // Let user access if database has minor connectivity issues
    }
  };

  useEffect(() => {
    // Failsafe to prevent infinite loading if Supabase auth completely hangs
    const timeoutId = setTimeout(() => {
      console.warn("AuthContext initialization timed out after 5 seconds");
      setLoading(false);
    }, 5000);

    // Supabase v2 guarantees an 'INITIAL_SESSION' event on load.
    // This perfectly handles initial load without race conditions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeoutId); // We got a response, clear the failsafe
      
      if (session?.user) {
        // Run fetchProfile asynchronously to prevent Supabase auth lock deadlocks
        setTimeout(() => {
          fetchProfile(session.user);
        }, 10);
      } else {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Background gate to verify concurrent device limit without blocking initial loading
  useEffect(() => {
    if (!user) return;

    const verifyConcurrentLimit = async () => {
      const isAllowed = await checkDeviceSessions(user.id);
      if (!isAllowed) {
        setUser(null);
        setProfile(null);
        setPermissions([]);
      }
    };

    verifyConcurrentLimit();
  }, [user]);

  // Session Inactivity Auto-Logout Timer
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!user) return;

    // Reset last activity timestamp upon successful mounting of user context
    lastActivityRef.current = Date.now();

    // Check inactivity periodically every 10 seconds (ultra-lightweight comparison)
    const checkInterval = setInterval(() => {
      // Automatic log out for all other access levels except super_admin, admin, hotel_owner, hotel_manager, manager
      const isOtherAccessLevel = !['super_admin', 'admin', 'hotel_owner', 'hotel_manager', 'manager'].includes(user.role);
      
      if (isOtherAccessLevel) {
        const localTimeout = localStorage.getItem('session_timeout_minutes');
        const timeoutMinutes = localTimeout ? parseInt(localTimeout, 10) : 30;
        const timeoutMs = timeoutMinutes * 60 * 1000;
        
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= timeoutMs) {
          logout();
          toast.error(`Session expired due to ${timeoutMinutes} minutes of inactivity. Please log in again.`);
          return;
        }
      }

      // High-Load Mitigation: Touch active database session at most once every 60 seconds
      if (Date.now() - lastDbUpdateRef.current >= 60 * 1000) {
        touchSession(user.id);
      }
    }, 10000);

    // Activity tracking handler (updates in-memory timestamp, zero timer reallocation thrashing)
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Comprehensive list of user interaction indicators
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Attach listeners using CAPTURE phase (true) to intercept even stopped propagation events
    activityEvents.forEach(evt => {
      window.addEventListener(evt, handleActivity, true);
    });

    return () => {
      clearInterval(checkInterval);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, handleActivity, true);
      });
    };
  }, [user]);

  // Real-time synchronization for profile and permissions updates
  useEffect(() => {
    if (!user?.id) return;
    const profileChannel = supabase.channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          console.log('[AuthContext] Real-time profile update detected:', payload);
          fetchProfile(user);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'role_permissions' },
        (payload) => {
          console.log('[AuthContext] Real-time permissions update detected:', payload);
          fetchProfile(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  const fetchProfile = async (authUser) => {
    try {
      let profileData = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.warn("Profile fetch warning:", error);
        } else {
          profileData = data;
        }
      } catch (err) {
        console.warn("Profile fetch error caught:", err);
      }
      
      if (profileData && (profileData.is_active === false || profileData.status === 'suspended' || profileData.status === 'sacked')) {
        toast.error(`Access Denied: Your account is inactive or has been suspended/withdrawn from service.`);
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setLoading(false);
        return;
      }
      
      const mergedUser = {
        ...authUser,
        ...(profileData || {}),
        name: profileData ? `${profileData.first_name} ${profileData.last_name}` : authUser.email,
        role: profileData?.role || 'guest'
      };
      
      setUser(mergedUser);
      setProfile(profileData);

      if (profileData && profileData.role !== 'super_admin') {
        try {
          const roleVal = profileData.role;
          const normalizedRole = roleVal ? roleVal.toLowerCase().trim().replace(/[-\s]+/g, '_') : '';
          const { data: perms } = await supabase
            .from('role_permissions')
            .select('*')
            .in('role', [roleVal, normalizedRole].filter(Boolean));
          if (perms) setPermissions(perms);
        } catch (permErr) {
          console.warn("Permissions fetch error caught:", permErr);
        }
      }
    } catch (e) {
      console.error("Critical error in fetchProfile execution", e);
      // Fallback: at least set the auth user so they can get to the dashboard
      setUser(authUser);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (allowedRoles) => {
    if (!user || !user.role) return false;
    if (user.role === 'super_admin') return true; 
    return allowedRoles.includes(user.role);
  };

  const getRolePermissionDefault = (roleId, permissionName) => {
    roleId = roleId ? roleId.toLowerCase().trim().replace(/[-\s]+/g, '_') : '';
    // Global override bypass roles
    if (['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'manager'].includes(roleId)) return true;
    
    switch (permissionName) {
      case 'Dashboard':
      case 'Dashboard - View Room Grid Matrix':
      case 'Dashboard - View Operations Statistics':
      case 'CRM & Guests':
      case 'CRM & Guests - Manage Profiles':
      case 'CRM & Guests - View Guest History':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support', 'laundry_manager', 'laundry_staff'].includes(roleId);
      
      case 'Reservations':
      case 'Reservations - Manage Bookings':
      case 'Reservations - Handle Room Assignments':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support'].includes(roleId);
      
      case 'Front Desk':
      case 'Front Desk - Create Booking & Check-in':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);
      
      case 'Front Desk - Override Room Rates & Invoicing':
        return ['front_desk_lead', 'receptionist_manager'].includes(roleId);
      
      case 'Housekeeping':
      case 'Housekeeping - Perform Room Cleaning':
        return ['head_housekeeper', 'housekeeping_manager', 'housekeeping'].includes(roleId);
      
      case 'Housekeeping - Assign Tasks to Staff':
      case 'Housekeeping - Inspect & Approve Clean Rooms':
        return ['head_housekeeper', 'housekeeping_manager'].includes(roleId);
      
      case 'POS':
      case 'POS - Process Sales & Suite Charging':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'pos_operator'].includes(roleId);
      
      case 'POS - Manage Menu Items & Custom Pricing':
        return ['receptionist_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);
      
      case 'Restaurant & Kitchen':
      case 'Restaurant Desk':
        return ['restaurant_manager', 'restaurant_staff', 'front_desk_lead', 'receptionist_manager', 'pos_operator'].includes(roleId);
      
      case 'Kitchen Desk':
        return ['head_chef', 'kitchen_manager', 'kitchen_staff'].includes(roleId);
      
      case 'Order History':
        return ['restaurant_manager', 'restaurant_staff', 'head_chef', 'kitchen_manager', 'kitchen_staff', 'pos_operator', 'front_desk_lead', 'receptionist_manager'].includes(roleId);
      
      case 'Guest Services':
      case 'Guest Services - Request Amenities':
      case 'Guest Services - Verify Active Orders':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
      
      case 'Laundry':
        return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
      
      case 'Laundry - Process Laundry Orders':
        return ['laundry_manager', 'laundry_staff'].includes(roleId);
      
      case 'Laundry - Post Folio Charges':
        return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'finance_manager'].includes(roleId);
      
      case 'Laundry - Register Walk-in Sales':
        return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
      
      case 'Store Keeping':
        return ['storekeeper', 'front_desk_lead', 'receptionist_manager', 'finance_manager', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'head_housekeeper', 'housekeeping_manager', 'maintenance_manager', 'head_maintenance', 'laundry_manager'].includes(roleId);
      
      case 'Store Keeping - Log Requisitions':
        return [
          'storekeeper', 'front_desk_lead', 'receptionist_manager', 'receptionist',
          'head_chef', 'kitchen_manager', 'kitchen_staff', 'bar_manager',
          'head_bartender', 'bar_staff', 'restaurant_manager', 'restaurant_staff',
          'pos_operator', 'finance_manager', 'accountant', 'head_housekeeper',
          'housekeeping_manager', 'housekeeping', 'maintenance_manager',
          'head_maintenance', 'maintenance', 'laundry_manager', 'laundry_staff'
        ].includes(roleId);
      
      case 'Store Keeping - Register & Restock Items':
        return ['storekeeper'].includes(roleId);
      
      case 'Store Keeping - Approve Outgoing Material Releases':
        return ['front_desk_lead', 'receptionist_manager', 'finance_manager', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'head_housekeeper', 'housekeeping_manager', 'maintenance_manager', 'head_maintenance'].includes(roleId);
      
      case 'Finance & Billing':
      case 'Accounting':
      case 'Accounting - Settle Ledger':
      case 'Accounting - View General Ledger Logs':
      case 'Finance - Manage General Ledgers & Payroll':
        return ['finance_manager', 'accountant'].includes(roleId);
      
      case 'Leave & Absences':
      case 'Leave & Absences - Request Leave of Absence':
        return !['guest'].includes(roleId);
      
      case 'Leave & Absences - Review Leave Applications':
        return ['front_desk_lead', 'receptionist_manager', 'finance_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);

      case 'Duty Logs':
      case 'Duty Logs - Submit Shift Handover':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

      case 'Duty Logs - Review Historical Logs':
        return ['front_desk_lead', 'receptionist_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

      case 'Lost & Found':
        return ['head_housekeeper', 'housekeeping_manager', 'housekeeping', 'front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);
      
      case 'Lost & Found - Register Found Items':
        return ['head_housekeeper', 'housekeeping_manager', 'housekeeping', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'maintenance_manager', 'head_maintenance', 'maintenance'].includes(roleId);

      case 'Lost & Found - Notify Guest & Settle Claims':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);

      case 'Lost & Found - Dispose Items':
        return ['head_housekeeper', 'housekeeping_manager', 'front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);

      case 'Finance - Process Refunds & Adjustments':
        return ['finance_manager', 'accountant'].includes(roleId);

      case 'Reminders':
        return ['finance_manager', 'accountant', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'maintenance_manager', 'head_maintenance'].includes(roleId);
      
      case 'Reminders - Create & Edit Schedules':
        return ['finance_manager', 'accountant', 'front_desk_lead', 'receptionist_manager'].includes(roleId);

      case 'Reminders - Settle Payments & Sync Ledger':
        return ['finance_manager', 'accountant'].includes(roleId);

      case 'Internal Messaging':
      case 'Internal Messaging - Send Direct Messages':
        return !['guest'].includes(roleId);
      
      case 'Internal Messaging - Broadcast Announcements':
        return ['front_desk_lead', 'receptionist_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);

      case 'Monthly Reports':
        return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager'].includes(roleId);
      
      case 'Monthly Reports - Submit Departmental Report':
        return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager', 'head_chef', 'head_housekeeper', 'head_maintenance', 'head_bartender'].includes(roleId);

      case 'Monthly Reports - View Performance Analytics':
        return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager'].includes(roleId);
      
      case 'Maintenance':
        return ['maintenance_manager', 'head_maintenance', 'maintenance', 'front_desk_lead', 'receptionist_manager', 'finance_manager'].includes(roleId);
      case 'Maintenance - Manage Tickets & Fixes':
        return ['maintenance_manager', 'head_maintenance', 'maintenance'].includes(roleId);
      case 'Maintenance - Manage Professionals':
        return ['maintenance_manager', 'head_maintenance'].includes(roleId);
      case 'Maintenance - Manage Purchases & Payments':
        return ['maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

      case 'Service Portals':
      case 'Service Portals - Airport Pickup Service':
      case 'Service Portals - Spa & Massage':
      case 'Service Portals - Swimming Pool':
      case 'Service Portals - Walk-in Direct Register':
      case 'Service Portals - Close of Day Compiler':
        return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support'].includes(roleId);

      default:
        return false;
    }
  };

  const hasAccess = (moduleName) => {
    if (!user || !user.role) return false;
    const roleId = user.role.toLowerCase().trim().replace(/[-\s]+/g, '_');
    if (roleId === 'super_admin' || roleId === 'hotel_owner') return true; 
    
    const perm = permissions.find(p => {
      const pRole = p.role ? p.role.toLowerCase().trim().replace(/[-\s]+/g, '_') : '';
      return p.module === moduleName && pRole === roleId;
    });
    if (perm !== undefined) return perm.has_access;
    
    return getRolePermissionDefault(roleId, moduleName);
  };

  const login = async ({ email, password }) => {
    const sanitizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: sanitizedEmail, password });
    if (error) throw error;
    
    // Log login activity
    try {
      await supabase.from('system_logs').insert([{
        user_id: data.user.id,
        email: data.user.email,
        log_type: 'login',
        action: 'Login Attempt',
        ip_address: '127.0.0.1 (Local)',
        metadata: {
          device_info: navigator.userAgent,
          status: 'success'
        }
      }]);
    } catch (e) {
      console.error("Failed to log login activity", e);
    }
    
    return data;
  };
  
  const register = async ({ email, password, firstName, lastName }) => {
    // 1. Enforce strong password rules
    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    // 2. Preemptively check if email already exists in profiles
    const { data: existingProf } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingProf) {
      throw new Error('This email address is already registered. Please sign in instead.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      if (user) {
        const deviceId = getOrCreateDeviceId();
        await supabase
          .from('user_active_sessions')
          .delete()
          .eq('user_id', user.id)
          .eq('device_id', deviceId);
      }
    } catch (e) {
      console.warn("Failed to release session slot on logout:", e);
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider value={{ user, profile, login, register, logout, hasRole, hasAccess, loading }}>
      {loading ? (
        <div className="flex flex-col h-screen w-full items-center justify-center bg-dark-900">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-500 mb-4"></div>
          <p className="text-gray-400">Authenticating session...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
