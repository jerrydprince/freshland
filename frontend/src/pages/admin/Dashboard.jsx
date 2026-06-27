import React, { useState, useEffect } from 'react';
import { Users, CalendarDays, DollarSign, TrendingUp, MoreHorizontal, ArrowUpRight, Clock, LogIn, LogOut, Sparkles, Shirt, Wrench, Archive, ClipboardList } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { getDefaultAdminRoute } from '../../utils/routes';

const StatCard = ({ title, value, icon, trend, delayClass, glowColor = "from-brand-500/25" }) => (
  <div 
    className={`glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both border border-white/5 hover:border-brand-500/30 ${delayClass}`}
  >
    {/* Decorative Neon Blur Tag */}
    <div className={`absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br ${glowColor} to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 opacity-60`}></div>
    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
    
    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 font-sans">{title}</p>
        <h3 className="text-3xl font-black text-white tracking-tight font-sans bg-clip-text bg-gradient-to-r from-white to-gray-200">{value}</h3>
      </div>
      <div className="w-12 h-12 bg-dark-900/90 backdrop-blur border border-white/10 flex items-center justify-center text-brand-500 rounded-xl shadow-md group-hover:scale-110 group-hover:text-white group-hover:bg-brand-500 transition-all duration-300">
        {icon}
      </div>
    </div>
    
    <div className="mt-5 flex items-center text-xs relative z-10 font-sans">
      <span className="flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
        <ArrowUpRight size={12} className="mr-0.5" />
        {trend}
      </span>
      <span className="text-gray-500 ml-2 font-medium">vs last month</span>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { profile, hasAccess } = useAuth();
  
  if (profile && !hasAccess('Dashboard') && profile.role !== 'super_admin') {
    return <Navigate to={getDefaultAdminRoute(profile.role, hasAccess)} replace />;
  }

  const safeFormatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return format(d, 'MMM dd');
    } catch (e) {
      return 'N/A';
    }
  };

  const [stats, setStats] = useState({
    revenue: 0,
    bookings: 0,
    occupancy: '0%',
    guests: 0,
    laundryCount: 0,
    maintenanceCount: 0,
    requisitionsCount: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [pulse, setPulse] = useState({ arrivals: 0, departures: 0, cleaning: 0 });
  const [loading, setLoading] = useState(true);

  // Custom states for department-specific views
  const [pendingTasks, setPendingTasks] = useState([]);
  const [activeTickets, setActiveTickets] = useState([]);
  const [shiftStatus, setShiftStatus] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time Postgres changes channel subscription for instant dashboard updates
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let arrivalsCount = 0;
    let departuresCount = 0;
    let activeGuestsCount = 0;
    let totalBookings = 0;
    let totalRevenue = 0;
    let bookingsData = [];
    let laundryCount = 0;
    let maintenanceCount = 0;
    let requisitionsCount = 0;
    let housekeepingTasksList = [];
    let maintenanceTicketsList = [];

    const maxRetries = 3;
    let success = false;

    // Define conditional promises based on permission levels to prevent unneeded database queries
    const bookingsPromise = (hasAccess('Reservations') || hasAccess('Front Desk'))
      ? supabase.from('bookings').select('*, profiles(first_name, last_name), rooms(name)').order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] });

    const totalCountPromise = (hasAccess('Reservations') || hasAccess('Front Desk'))
      ? supabase.from('bookings').select('id', { count: 'exact', head: true })
      : Promise.resolve({ count: 0 });

    const revenueDataPromise = (hasAccess('Accounting') || hasAccess('Finance & Billing'))
      ? supabase.from('bookings').select('amount_paid_ngn')
      : Promise.resolve({ data: [] });

    const arrivalsCountPromise = (hasAccess('Reservations') || hasAccess('Front Desk'))
      ? supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('check_in_date', today).in('status', ['confirmed', 'pending'])
      : Promise.resolve({ count: 0 });

    const departuresCountPromise = (hasAccess('Reservations') || hasAccess('Front Desk'))
      ? supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('check_out_date', today).eq('status', 'checked_in')
      : Promise.resolve({ count: 0 });

    const checkedInCountPromise = (hasAccess('CRM & Guests') || hasAccess('Front Desk'))
      ? supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'checked_in')
      : Promise.resolve({ count: 0 });

    const laundryPromise = hasAccess('Laundry')
      ? supabase.from('booking_services').select('id, services!inner(name, category)', { count: 'exact' }).or('category.eq.Laundry,name.ilike.%laundry%', { foreignTable: 'services' }).in('status', ['pending', 'scheduled', 'in_progress'])
      : Promise.resolve({ count: 0 });

    const maintenancePromise = hasAccess('Maintenance')
      ? supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])
      : Promise.resolve({ count: 0 });

    const storePromise = hasAccess('Store Keeping')
      ? supabase.from('store_purchase_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 });

    const housekeepingListPromise = hasAccess('Housekeeping')
      ? supabase.from('housekeeping_tasks').select('*, rooms(room_number, name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] });

    const maintenanceListPromise = hasAccess('Maintenance')
      ? supabase.from('maintenance_tickets').select('*, rooms(room_number)').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] });

    const shiftPromise = (profile?.id)
      ? supabase.from('staff_attendance').select('*').eq('staff_id', profile.id).is('clock_out', null).order('clock_in', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [
          recentBookingsRes,
          totalCountRes,
          revenueDataRes,
          arrivalsCountRes,
          departuresCountRes,
          checkedInCountRes,
          laundryRes,
          maintenanceRes,
          storeRes,
          housekeepingListRes,
          maintenanceListRes,
          shiftRes
        ] = await Promise.all([
          bookingsPromise,
          totalCountPromise,
          revenueDataPromise,
          arrivalsCountPromise,
          departuresCountPromise,
          checkedInCountPromise,
          laundryPromise,
          maintenancePromise,
          storePromise,
          housekeepingListPromise,
          maintenanceListPromise,
          shiftPromise
        ]);

        if (recentBookingsRes.error && (hasAccess('Reservations') || hasAccess('Front Desk'))) throw recentBookingsRes.error;
        if (revenueDataRes.error && (hasAccess('Accounting') || hasAccess('Finance & Billing'))) throw revenueDataRes.error;

        bookingsData = recentBookingsRes.data || [];
        totalBookings = totalCountRes.count || 0;
        arrivalsCount = arrivalsCountRes.count || 0;
        departuresCount = departuresCountRes.count || 0;
        activeGuestsCount = checkedInCountRes.count || 0;
        totalRevenue = (revenueDataRes.data || []).reduce((sum, b) => sum + Number(b.amount_paid_ngn || 0), 0);
        laundryCount = laundryRes.count || 0;
        maintenanceCount = maintenanceRes.count || 0;
        requisitionsCount = storeRes.count || 0;
        housekeepingTasksList = housekeepingListRes.data || [];
        maintenanceTicketsList = maintenanceListRes.data || [];
        setShiftStatus(shiftRes.data && shiftRes.data.length > 0 ? shiftRes.data[0] : null);

        setStats(prev => ({
          ...prev,
          revenue: totalRevenue,
          bookings: totalBookings,
          guests: activeGuestsCount,
          laundryCount,
          maintenanceCount,
          requisitionsCount
        }));
        setRecentBookings(bookingsData);
        setPendingTasks(housekeepingTasksList);
        setActiveTickets(maintenanceTicketsList);
        success = true;
        break;
      } catch (e) {
        console.warn(`Dashboard database connection attempt ${attempt} failed. Retrying...`, e);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error("Failed to load dashboard data after maximum retries:", e);
        }
      }
    }

    // Dynamic Occupancy Rate
    const { data: roomsData } = await supabase.from('rooms').select('id, status');
    if (roomsData) {
      const totalRooms = roomsData.length;
      const occupiedRooms = roomsData.filter(r => r.status === 'occupied').length;
      const occupancyPercent = totalRooms > 0 ? `${Math.round((occupiedRooms / totalRooms) * 100)}%` : '0%';
      setStats(prev => ({ ...prev, occupancy: occupancyPercent }));
    }

    // Dynamic Housekeeping Cleaning count
    let cleaningCount = 0;
    try {
      const { count } = await supabase
        .from('housekeeping_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (count !== null) cleaningCount = count;
    } catch (e) {
      console.error(e);
    }

    setPulse({
      arrivals: arrivalsCount,
      departures: departuresCount,
      cleaning: cleaningCount
    });
    
    setLoading(false);
  };

  // Build dynamic stats cards list based on permissions
  const statCards = [];

  if (hasAccess('Accounting') || hasAccess('Finance & Billing')) {
    statCards.push({
      title: "Total Revenue",
      value: `₦${stats.revenue.toLocaleString()}`,
      icon: <DollarSign size={24} />,
      trend: "12.5%",
      glowColor: "from-brand-500/20",
      delayClass: "delay-100"
    });
  }

  if (hasAccess('Reservations') || hasAccess('Front Desk')) {
    statCards.push({
      title: "Total Bookings",
      value: stats.bookings,
      icon: <CalendarDays size={24} />,
      trend: "8.2%",
      glowColor: "from-blue-500/20",
      delayClass: "delay-200"
    });
  }

  if (hasAccess('Rooms') || hasAccess('Front Desk')) {
    statCards.push({
      title: "Occupancy Rate",
      value: stats.occupancy,
      icon: <TrendingUp size={24} />,
      trend: "5.4%",
      glowColor: "from-emerald-500/20",
      delayClass: "delay-300"
    });
  }

  if (hasAccess('CRM & Guests') || hasAccess('Front Desk')) {
    statCards.push({
      title: "Active Guests",
      value: stats.guests,
      icon: <Users size={24} />,
      trend: "1.2%",
      glowColor: "from-purple-500/20",
      delayClass: "delay-500"
    });
  }

  // Inject operational stats if the user lacks financial analytics privileges
  if (hasAccess('Housekeeping') && statCards.length < 4) {
    statCards.push({
      title: "Rooms Cleaning",
      value: pulse.cleaning,
      icon: <Sparkles size={24} />,
      trend: "Pending Tasks",
      glowColor: "from-amber-500/20",
      delayClass: "delay-400"
    });
  }

  if (hasAccess('Laundry') && statCards.length < 4) {
    statCards.push({
      title: "Active Laundry",
      value: stats.laundryCount,
      icon: <Shirt size={24} />,
      trend: "Active Orders",
      glowColor: "from-sky-500/20",
      delayClass: "delay-600"
    });
  }

  if (hasAccess('Maintenance') && statCards.length < 4) {
    statCards.push({
      title: "Active Repairs",
      value: stats.maintenanceCount,
      icon: <Wrench size={24} />,
      trend: "Unresolved issues",
      glowColor: "from-orange-500/20",
      delayClass: "delay-700"
    });
  }

  if (hasAccess('Store Keeping') && statCards.length < 4) {
    statCards.push({
      title: "Store Requisitions",
      value: stats.requisitionsCount,
      icon: <Archive size={24} />,
      trend: "Pending Release",
      glowColor: "from-indigo-500/20",
      delayClass: "delay-800"
    });
  }

  // Dynamic RHS Pulse Items
  const pulseItems = [];
  
  if (hasAccess('Front Desk') || hasAccess('Reservations')) {
    pulseItems.push({
      label: "Expected Arrivals",
      value: pulse.arrivals,
      colorClass: "from-brand-600 to-brand-400",
      icon: <LogIn size={16}/>,
      maxVal: Math.max(10, pulse.arrivals, pulse.departures, pulse.cleaning)
    });
    pulseItems.push({
      label: "Departures",
      value: pulse.departures,
      colorClass: "from-blue-600 to-blue-400",
      icon: <LogOut size={16}/>,
      maxVal: Math.max(10, pulse.arrivals, pulse.departures, pulse.cleaning)
    });
  }

  if (hasAccess('Housekeeping')) {
    pulseItems.push({
      label: "Pending Cleaning",
      value: pulse.cleaning,
      colorClass: "from-amber-600 to-amber-400",
      icon: <Clock size={16}/>,
      maxVal: Math.max(10, pulse.cleaning)
    });
  }

  if (hasAccess('Laundry')) {
    pulseItems.push({
      label: "Active Laundry Orders",
      value: stats.laundryCount || 0,
      colorClass: "from-sky-600 to-sky-400",
      icon: <Shirt size={16}/>,
      maxVal: Math.max(10, stats.laundryCount || 0)
    });
  }

  if (hasAccess('Maintenance')) {
    pulseItems.push({
      label: "Open Repair Tickets",
      value: stats.maintenanceCount || 0,
      colorClass: "from-orange-600 to-orange-400",
      icon: <Wrench size={16}/>,
      maxVal: Math.max(10, stats.maintenanceCount || 0)
    });
  }

  if (hasAccess('Store Keeping')) {
    pulseItems.push({
      label: "Pending Requisitions",
      value: stats.requisitionsCount || 0,
      colorClass: "from-indigo-600 to-indigo-400",
      icon: <Archive size={16}/>,
      maxVal: Math.max(10, stats.requisitionsCount || 0)
    });
  }

  return (
    <div className="pb-12">
      <div className="mb-8 flex justify-between items-end animate-in fade-in slide-in-from-left-4 duration-700">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2 font-sans bg-clip-text bg-gradient-to-r from-white to-gray-400">
            PMS Live Operations Overview
          </h1>
          <p className="text-gray-400 mt-1 font-medium font-sans">Welcome back. Here is what's happening at your property today.</p>
        </div>
        <button className="hidden md:flex items-center gap-2 bg-dark-800 border border-dark-700 hover:border-brand-500/50 text-white px-4 py-2 rounded-lg transition-all shadow-sm font-sans font-semibold">
          <CalendarDays size={18} className="text-brand-500"/>
          <span>{format(new Date(), 'MMM dd, yyyy')}</span>
        </button>
      </div>
      
      {statCards.length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(4, statCards.length)} gap-6 mb-8`}>
          {statCards.map((card, idx) => (
            <StatCard 
              key={idx}
              delayClass={card.delayClass}
              title={card.title}
              value={card.value}
              icon={card.icon}
              trend={card.trend}
              glowColor={card.glowColor}
            />
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Dynamic LHS Column depending on primary staff permissions */}
        {(() => {
          if (hasAccess('Reservations') || hasAccess('Front Desk')) {
            return (
              <div className="lg:col-span-2 glass-panel p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
                  <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"><MoreHorizontal size={20}/></button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-dark-700/50">
                        <th className="pb-3 font-semibold px-2">Guest</th>
                        <th className="pb-3 font-semibold px-2">Room</th>
                        <th className="pb-3 font-semibold px-2">Date</th>
                        <th className="pb-3 font-semibold px-2">Status</th>
                        <th className="pb-3 font-semibold px-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loading ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-gray-400">
                            <div className="animate-pulse flex flex-col items-center">
                              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              Loading data...
                            </div>
                          </td>
                        </tr>
                      ) : (recentBookings || []).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-gray-500">No bookings yet.</td>
                        </tr>
                      ) : (
                        (recentBookings || []).map((item, i) => {
                          if (!item) return null;
                          const guestName = item.profiles 
                            ? `${item.profiles.first_name || ''} ${item.profiles.last_name || ''}`.trim() 
                            : (item.guest_name || 'Walk-in Guest');
                          const amountPaid = item.total_amount_ngn ? Number(item.total_amount_ngn).toLocaleString() : '0';
                          return (
                            <tr 
                              key={item.id || i} 
                              className="border-b border-dark-700/30 hover:bg-dark-700/20 transition-colors group animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both"
                              style={{ animationDelay: `${700 + (i * 100)}ms` }}
                            >
                              <td className="py-4 px-2">
                                <p className="font-bold text-white">{guestName}</p>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">{item.booking_reference || 'N/A'}</p>
                              </td>
                              <td className="py-4 px-2 text-gray-300">{item.rooms?.name || 'Unknown Room'}</td>
                              <td className="py-4 px-2 text-gray-400">
                                <span className="flex items-center gap-1.5">
                                  <CalendarDays size={14} className="text-gray-500"/> 
                                  {safeFormatDate(item.check_in_date)}
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  item.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                  item.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                }`}>
                                  {item.status || 'unknown'}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-right font-bold text-white">₦{amountPaid}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          
          if (hasAccess('Housekeeping')) {
            return (
              <div className="lg:col-span-2 glass-panel p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles size={20} className="text-brand-500"/> Pending Housekeeping Tasks</h3>
                  <Link to="/admin/housekeeping" className="text-xs font-semibold text-brand-400 hover:text-white transition-colors">Go to Board →</Link>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-dark-700/50">
                        <th className="pb-3 font-semibold px-2">Room</th>
                        <th className="pb-3 font-semibold px-2">Status</th>
                        <th className="pb-3 font-semibold px-2">Priority</th>
                        <th className="pb-3 font-semibold px-2">Assigned Staff</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-300">
                      {pendingTasks.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-12 text-center text-gray-500 font-medium">No pending cleaning tasks today. All rooms are clean!</td>
                        </tr>
                      ) : (
                        pendingTasks.map((task) => (
                          <tr key={task.id} className="border-b border-dark-700/30 hover:bg-dark-700/20 transition-colors">
                            <td className="py-4 px-2">
                              <span className="font-bold text-white">Room {task.rooms?.room_number || task.room_number}</span>
                            </td>
                            <td className="py-4 px-2">
                              <span className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider border border-amber-500/20">
                                {task.status}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                                task.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse' : 'bg-dark-700 text-gray-400'
                              }`}>
                                {task.priority || 'normal'}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-gray-400">
                              {task.staff_name || 'Unassigned'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          
          if (hasAccess('Maintenance')) {
            return (
              <div className="lg:col-span-2 glass-panel p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2"><Wrench size={20} className="text-brand-500"/> Active Maintenance Tickets</h3>
                  <Link to="/admin/maintenance" className="text-xs font-semibold text-brand-400 hover:text-white transition-colors">Go to Queue →</Link>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-dark-700/50">
                        <th className="pb-3 font-semibold px-2">Issue / Room</th>
                        <th className="pb-3 font-semibold px-2">Status</th>
                        <th className="pb-3 font-semibold px-2">Priority</th>
                        <th className="pb-3 font-semibold px-2">Reported Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-300">
                      {activeTickets.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-12 text-center text-gray-500 font-medium">No open maintenance tickets. Everything is operational!</td>
                        </tr>
                      ) : (
                        activeTickets.map((ticket) => (
                          <tr key={ticket.id} className="border-b border-dark-700/30 hover:bg-dark-700/20 transition-colors">
                            <td className="py-4 px-2">
                              <p className="font-bold text-white">{ticket.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Room {ticket.rooms?.room_number || 'General Area'}</p>
                            </td>
                            <td className="py-4 px-2">
                              <span className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-orange-500/20">
                                {ticket.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                ticket.priority === 'urgent' || ticket.priority === 'high' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-dark-750 text-gray-400'
                              }`}>
                                {ticket.priority}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-gray-500 font-mono text-xs">
                              {format(new Date(ticket.created_at), 'yyyy-MM-dd')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          
          // Fallback: Clock In / Shift tracker dashboard widget
          return (
            <div className="lg:col-span-2 glass-panel p-8 rounded-2xl flex flex-col justify-center items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
              <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 text-brand-500 rounded-full flex items-center justify-center mb-6">
                <ClipboardList size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">My Duty Clock Terminal</h3>
              <p className="text-gray-400 text-sm max-w-sm mb-6 leading-relaxed">
                Welcome, {profile?.first_name || 'Staff'}. Review your scheduled duties and manage your daily attendance clock inputs.
              </p>
              
              <div className="bg-dark-900 border border-dark-700/60 p-4 rounded-xl max-w-sm w-full mb-6 font-semibold flex justify-between items-center text-xs">
                <span className="text-gray-500">SHIFT STATUS:</span>
                {shiftStatus ? (
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded uppercase font-bold">ON DUTY</span>
                ) : (
                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded uppercase font-bold">OFF DUTY</span>
                )}
              </div>
              
              <Link 
                to="/admin/staff" 
                className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-black px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-sm"
              >
                Go to Security & Shift Matrix
              </Link>
            </div>
          );
        })()}

        {/* Quick Actions / Summary */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700 fill-mode-both">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Today's Pulse</h3>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
            </span>
          </div>
          
          <div className="space-y-8 flex-1">
            {pulseItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500 font-medium">
                <p className="text-xs">No active departmental alerts. Select a module from the sidebar to begin operations.</p>
              </div>
            ) : (
              pulseItems.map((item, idx) => (
                <div className="group" key={idx}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-medium flex items-center gap-2">{item.icon} {item.label}</span>
                    <span className="font-bold text-white bg-dark-700 px-2 rounded">{item.value}</span>
                  </div>
                  <div className="w-full bg-dark-900/50 h-2.5 rounded-full overflow-hidden border border-dark-700/50">
                    <div 
                      className={`bg-gradient-to-r ${item.colorClass} h-full rounded-full group-hover:scale-y-110 transition-all duration-500`}
                      style={{ width: `${item.value > 0 ? Math.min(100, (item.value / item.maxVal) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-dark-700/50">
             <Link to={getDefaultAdminRoute(profile?.role || 'staff', hasAccess)} className="w-full block text-center btn-outline border-dark-600 text-gray-300 hover:bg-dark-700 hover:border-dark-500 hover:text-white">Go to my Department</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
