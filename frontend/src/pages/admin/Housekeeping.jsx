import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync, forceTableRefresh } from '../../lib/useRealtimeSync';
import toast from 'react-hot-toast';
import { Sparkles, Wrench, CheckCircle, Clock, AlertTriangle, Plus, X, ListChecks, Calendar as CalendarIcon, User, LayoutGrid, List, Archive } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import StoreRequisitionModal from '../../components/admin/StoreRequisitionModal';

const AdminHousekeeping = () => {
  const [activeTab, setActiveTab] = useState('housekeeping'); // 'housekeeping' or 'maintenance'
  const [viewMode, setViewMode] = useState('list'); // 'card' or 'list'
  const [tasks, setTasks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { profile, hasAccess } = useAuth();
  const isManager = hasAccess('Housekeeping - Inspect & Approve Clean Rooms') || hasAccess('Housekeeping - Assign Tasks to Staff');
  const canManageMaintenance = hasAccess('Maintenance - Manage Tickets & Fixes');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeAssignTask, setActiveAssignTask] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isRequisitionOpen, setIsRequisitionOpen] = useState(false);
  const [activeInspection, setActiveInspection] = useState(null); // stores task id
  const [activeResolution, setActiveResolution] = useState(null); // stores ticket id
  
  // Forms
  const [newTask, setNewTask] = useState({ room_id: '', task_type: 'checkout_cleaning', assigned_date: format(new Date(), 'yyyy-MM-dd'), housekeeper_id: '', notes: '' });
  const [newTicket, setNewTicket] = useState({ room_id: '', issue_category: 'Plumbing', priority: 'medium', description: '' });
  
  // Inspection Checklist State
  const [checklist, setChecklist] = useState({
    bed: false,
    bathroom: false,
    trash: false,
    floors: false,
    restock: false
  });

  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Real-time synchronization for housekeeping tasks, maintenance tickets, and room changes
  useRealtimeSync(['housekeeping_tasks', 'maintenance_tickets', 'rooms'], () => {
    fetchData(false);
  });

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      // Pre-declare queries as concurrent parallel promises
      const roomsPromise = supabase.from('rooms').select('id, room_number, name').order('room_number');
      
      const staffPromise = supabase.from('profiles')
        .select('id, first_name, last_name, role, is_on_shift')
        .neq('role', 'guest')
        .order('first_name');

      const dataPromise = activeTab === 'housekeeping'
        ? supabase.from('housekeeping_tasks').select('*, rooms(room_number, name), profiles(first_name, last_name)').order('assigned_date', { ascending: false })
        : supabase.from('maintenance_tickets').select('*, rooms(room_number, name)').order('created_at', { ascending: false });

      // Execute all three database queries in parallel concurrently
      const [roomsResult, staffResult, dataResult] = await Promise.all([
        roomsPromise,
        staffPromise,
        dataPromise
      ]);

      if (roomsResult.error) throw roomsResult.error;
      if (staffResult.error) throw staffResult.error;
      if (dataResult.error) throw dataResult.error;

      setRooms(roomsResult.data || []);
      setStaff(staffResult.data || []);
      
      if (activeTab === 'housekeeping') {
        setTasks(dataResult.data || []);
      } else {
        setTickets(dataResult.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch housekeeping data: ' + error.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('housekeeping_tasks').insert([{
      ...newTask,
      housekeeper_id: newTask.housekeeper_id || null
    }]);
    if (error) toast.error(error.message);
    else {
      toast.success('Task Scheduled');
      setIsTaskModalOpen(false);
      fetchData();
    }
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('maintenance_tickets').insert([{
      ...newTicket,
      reported_by: session?.user?.id || null
    }]);
    if (error) toast.error(error.message);
    else {
      toast.success('Ticket Submitted');
      setIsTicketModalOpen(false);
      fetchData();
    }
  };

  const updateTaskStatus = async (id, status) => {
    const payload = { status };
    if (status === 'inspected') payload.completed_at = new Date().toISOString();
    const { error } = await supabase.from('housekeeping_tasks').update(payload).eq('id', id);
    if (!error) {
      if (status === 'inspected') {
        const task = tasks.find(t => t.id === id);
        if (task && task.room_id) {
          const { data: roomData } = await supabase.from('rooms').select('status').eq('id', task.room_id).single();
          if (roomData && roomData.status === 'dirty') {
            await supabase.from('rooms').update({ status: 'available' }).eq('id', task.room_id);
          }
        }
      }
      toast.success('Status updated');
      fetchData();
      forceTableRefresh('housekeeping_tasks');
      forceTableRefresh('rooms');
    } else {
      console.error(error);
      toast.error('Failed to update status: ' + error.message);
    }
  };

  const handleSubmitInspection = async () => {
    if(!checklist.bed || !checklist.bathroom || !checklist.trash || !checklist.floors || !checklist.restock) {
      return toast.error("All checklist items must be verified before approving inspection.");
    }

    const { error } = await supabase.from('housekeeping_tasks').update({
      status: 'inspected',
      completed_at: new Date().toISOString(),
      inspection_checklist: checklist
    }).eq('id', activeInspection);

    if (!error) {
      const task = tasks.find(t => t.id === activeInspection);
      if (task && task.room_id) {
        const { data: roomData } = await supabase.from('rooms').select('status').eq('id', task.room_id).single();
        if (roomData && roomData.status === 'dirty') {
          await supabase.from('rooms').update({ status: 'available' }).eq('id', task.room_id);
        }
      }
      toast.success('Room marked as Inspected and Ready!');
      setActiveInspection(null);
      setChecklist({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
      fetchData();
      forceTableRefresh('housekeeping_tasks');
      forceTableRefresh('rooms');
    } else {
      toast.error('Failed to update status: ' + error.message);
    }
  };

  const handleRejectInspection = async () => {
    // If not approved, send back to 'failed' (which will let them restart)
    const { error } = await supabase.from('housekeeping_tasks').update({
      status: 'failed',
      notes: 'Inspection Failed - Please clean again.'
    }).eq('id', activeInspection);

    if (!error) {
      toast.error('Room marked as Not Approved. Sent back to Housekeeping.');
      setActiveInspection(null);
      setChecklist({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
      fetchData();
    } else {
      toast.error('Failed to update status: ' + error.message);
    }
  };

  const handleAssignTask = async (taskId, housekeeperId) => {
    const { error } = await supabase.from('housekeeping_tasks').update({
      housekeeper_id: housekeeperId || null
    }).eq('id', taskId);

    if (!error) {
      toast.success('Task Assigned');
      setIsAssignModalOpen(false);
      setActiveAssignTask(null);
      fetchData();
    } else {
      toast.error('Failed to assign task');
    }
  };

  const handleResolveTicket = async () => {
    const { error } = await supabase.from('maintenance_tickets').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_notes: resolutionNotes
    }).eq('id', activeResolution);

    if (!error) {
      toast.success('Ticket Resolved');
      setActiveResolution(null);
      setResolutionNotes('');
      fetchData();
    }
  };

  const updateTicketStatus = async (id, status) => {
    const { error } = await supabase.from('maintenance_tickets').update({ status }).eq('id', id);
    if (!error) {
      toast.success('Ticket updated');
      fetchData();
    }
  };

  const handleScheduleDeepClean = () => {
    setNewTask({ ...newTask, task_type: 'deep_cleaning' });
    setIsTaskModalOpen(true);
  };

  const getSLAWarning = (createdAt, status) => {
    if (status === 'resolved' || status === 'closed') return null;
    const hours = differenceInHours(new Date(), new Date(createdAt));
    if (hours > 24) return <span className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded ml-2 font-bold animate-pulse">SLA BREACH ({hours}h)</span>;
    if (hours > 12) return <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded ml-2 font-bold">WARNING ({hours}h)</span>;
    return null;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'cleaning': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'cleaned': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'inspected': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'reported': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'resolved': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'closed': return 'bg-dark-700 text-gray-200 border border-dark-600';
      default: return 'bg-dark-700 text-gray-200';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-lg border border-dark-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="text-brand-500"/> Housekeeping & Maintenance
          </h1>
          <p className="text-gray-200 mt-1">Manage cleaning schedules, assign staff, and track maintenance issues.</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          {hasAccess('Store Keeping - Log Requisitions') && (
            <button onClick={() => setIsRequisitionOpen(true)} className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 rounded font-medium flex items-center gap-2 transition-all">
              <Archive size={18} /> Store Requisition
            </button>
          )}
          <div className="flex bg-dark-700 rounded p-1 mr-2">
            <button onClick={() => setViewMode('card')} className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-dark-600 text-white' : 'text-gray-200 hover:text-white'}`}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-dark-600 text-white' : 'text-gray-200 hover:text-white'}`}>
              <List size={18} />
            </button>
          </div>
          {activeTab === 'housekeeping' ? (
            isManager && (
              <>
                <button onClick={handleScheduleDeepClean} className="bg-dark-700 hover:bg-dark-600 text-white py-2 px-4 rounded font-medium transition-colors">
                  Deep Clean
                </button>
                <button onClick={() => { setNewTask({...newTask, task_type: 'daily_refresh'}); setIsTaskModalOpen(true); }} className="btn-primary py-2 px-4 flex items-center gap-2">
                  <Plus size={18} /> Assign Task
                </button>
              </>
            )
          ) : (
            <button onClick={() => setIsTicketModalOpen(true)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded font-medium flex items-center gap-2">
              <Plus size={18} /> Report Issue
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-dark-700">
        <button 
          onClick={() => setActiveTab('housekeeping')} 
          className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'housekeeping' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <Sparkles size={18} /> Cleaning Schedules
        </button>
        <button 
          onClick={() => setActiveTab('maintenance')} 
          className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'maintenance' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <Wrench size={18} /> Maintenance Board
        </button>
      </div>

      <div className="bg-dark-900 border border-dark-700 shadow-sm rounded-lg min-h-[500px]">
        {loading ? (
          <div className="p-12 text-center text-gray-300 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading schedules...
          </div>
        ) : activeTab === 'housekeeping' ? (
            <div className="p-6">
              {viewMode === 'list' ? (
                <div className="overflow-x-auto rounded-lg border border-dark-700">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-dark-800 border-b border-dark-700">
                        <th className="p-4 text-gray-200 font-medium">Room</th>
                        <th className="p-4 text-gray-200 font-medium">Task Type</th>
                        <th className="p-4 text-gray-200 font-medium">Assigned To</th>
                        <th className="p-4 text-gray-200 font-medium">Date</th>
                        <th className="p-4 text-gray-200 font-medium">Status</th>
                        <th className="p-4 text-gray-200 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-300">No cleaning tasks scheduled.</td></tr>}
                      {tasks.map(task => (
                        <tr key={task.id} className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors">
                          <td className="p-4 font-bold text-white">Room {task.rooms?.room_number} <span className="text-gray-300 font-normal ml-1">- {task.rooms?.name}</span></td>
                          <td className="p-4 text-sm text-gray-300 capitalize">{task.task_type.replace('_', ' ')}</td>
                          <td className="p-4 text-sm">
                            {task.profiles ? `${task.profiles.first_name} ${task.profiles.last_name}` : <span className="text-yellow-500/70 italic">Unassigned</span>}
                            {(task.status === 'pending' || task.status === 'failed') && isManager && (
                              <button onClick={() => { setActiveAssignTask(task); setIsAssignModalOpen(true); }} className="ml-3 text-xs text-brand-500 hover:text-brand-400 font-medium">Change</button>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-200">{task.assigned_date}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs rounded uppercase font-bold tracking-wider ${getStatusColor(task.status)}`}>{task.status}</span>
                            {task.status === 'failed' && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">NOT APPROVED</span>}
                          </td>
                          <td className="p-4 text-sm text-right">
                            {(task.status === 'pending' || task.status === 'failed') && (
                              <button 
                                onClick={() => {
                                  if (!task.housekeeper_id) {
                                    toast.error("Please assign a staff member before starting the task.");
                                    return;
                                  }
                                  updateTaskStatus(task.id, 'cleaning');
                                }} 
                                disabled={!task.housekeeper_id}
                                className={`font-medium ${!task.housekeeper_id ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-brand-500 hover:text-brand-400'}`}
                                title={!task.housekeeper_id ? "Assign staff first" : ""}
                              >
                                {task.status === 'failed' ? 'Restart' : 'Start'}
                              </button>
                            )}
                            {task.status === 'cleaning' && <button onClick={() => updateTaskStatus(task.id, 'cleaned')} className="text-brand-500 hover:text-brand-400 font-medium ml-3">Mark Cleaned</button>}
                            {task.status === 'cleaned' && isManager && <button onClick={() => setActiveInspection(task.id)} className="text-green-500 hover:text-green-400 font-medium flex items-center gap-1 justify-end ml-auto"><ListChecks size={14}/> Inspect</button>}
                            {task.status === 'cleaned' && !isManager && <span className="text-purple-400 italic flex items-center gap-1 justify-end"><Clock size={14}/> Awaiting Manager</span>}
                            {task.status === 'inspected' && <span className="text-green-500 flex items-center gap-1 justify-end"><CheckCircle size={14}/> Done</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.length === 0 && <div className="col-span-3 text-center text-gray-300 py-12">No cleaning tasks scheduled.</div>}
                  {tasks.map(task => (
                    <div key={task.id} className="bg-dark-800 border border-dark-700 rounded-lg p-5 flex flex-col justify-between hover:border-gray-600 transition-colors">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            Room {task.rooms?.room_number} <span className="text-sm text-gray-200 font-normal truncate max-w-[120px]">- {task.rooms?.name}</span>
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded uppercase font-bold tracking-wider ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 mb-2 capitalize bg-dark-900 inline-block px-2 py-1 rounded border border-dark-700">
                          {task.task_type.replace('_', ' ')}
                        </p>
                        <div className="space-y-1 mt-4 text-sm text-gray-200">
                          <p className="flex items-center gap-2"><CalendarIcon size={14}/> {task.assigned_date}</p>
                          <p className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2"><User size={14}/> {task.profiles ? `${task.profiles.first_name} ${task.profiles.last_name}` : <span className="text-yellow-500/70 italic">Unassigned</span>}</span>
                            {task.status === 'failed' && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">NOT APPROVED</span>}
                            {(task.status === 'pending' || task.status === 'failed') && isManager && (
                              <button onClick={() => { setActiveAssignTask(task); setIsAssignModalOpen(true); }} className="text-xs text-brand-500 hover:text-brand-400">
                                Change
                              </button>
                            )}
                          </p>
                        </div>
                        {task.notes && (
                          <div className="mt-3 text-xs bg-brand-500/10 border border-brand-500/20 text-brand-400 p-2 rounded italic">
                            {task.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-dark-700">
                        {(task.status === 'pending' || task.status === 'failed') && (
                          <button 
                            onClick={() => {
                              if (!task.housekeeper_id) {
                                toast.error("Please assign a staff member before starting the task.");
                                return;
                              }
                              updateTaskStatus(task.id, 'cleaning');
                            }}
                            disabled={!task.housekeeper_id}
                            className={`w-full py-2 text-sm rounded transition-all ${
                              !task.housekeeper_id 
                                ? 'bg-dark-750 text-gray-300 cursor-not-allowed opacity-50 border border-dark-700' 
                                : 'btn-primary'
                            }`}
                            title={!task.housekeeper_id ? "Assign staff first" : ""}
                          >
                            {task.status === 'failed' ? 'Restart Cleaning' : 'Start Cleaning'}
                          </button>
                        )}
                        {task.status === 'cleaning' && <button onClick={() => updateTaskStatus(task.id, 'cleaned')} className="w-full btn-primary py-2 text-sm mt-2">Mark as Cleaned</button>}
                        {task.status === 'cleaned' && isManager && <button onClick={() => setActiveInspection(task.id)} className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"><ListChecks size={16}/> Perform Inspection</button>}
                        {task.status === 'cleaned' && !isManager && <p className="text-center text-gray-300 text-sm font-medium flex items-center justify-center gap-2"><Clock size={16} className="text-purple-400"/> Awaiting Manager Inspection</p>}
                        {task.status === 'inspected' && <p className="text-center text-gray-300 text-sm font-medium flex items-center justify-center gap-2"><CheckCircle size={16} className="text-green-500"/> Completed & Ready</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        ) : (
          <div className="p-6">
            {viewMode === 'list' ? (
              <div className="overflow-x-auto rounded-lg border border-dark-700">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-dark-800 border-b border-dark-700">
                      <th className="p-4 text-gray-200 font-medium">Room</th>
                      <th className="p-4 text-gray-200 font-medium">Priority</th>
                      <th className="p-4 text-gray-200 font-medium">Category / Issue</th>
                      <th className="p-4 text-gray-200 font-medium">Reported</th>
                      <th className="p-4 text-gray-200 font-medium">Status</th>
                      <th className="p-4 text-gray-200 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-300">All systems green. No open tickets.</td></tr>}
                    {tickets.map(ticket => (
                      <tr key={ticket.id} className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors">
                        <td className="p-4 font-bold text-white">RM {ticket.rooms?.room_number} <span className="text-gray-300 font-normal ml-1">- {ticket.rooms?.name}</span></td>
                        <td className="p-4">
                          <span className={`flex w-fit items-center gap-1 text-xs font-bold uppercase px-2 py-1 rounded ${ticket.priority === 'critical' ? 'bg-red-500/20 text-red-500' : ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                            <AlertTriangle size={12} /> {ticket.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="text-gray-300 font-medium mb-1">{ticket.issue_category}</p>
                          <p className="text-xs text-gray-300 truncate max-w-[200px]">{ticket.description}</p>
                        </td>
                        <td className="p-4 text-sm text-gray-200">
                          {new Date(ticket.created_at).toLocaleString()}
                          {getSLAWarning(ticket.created_at, ticket.status)}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs rounded uppercase font-bold tracking-wider ${getStatusColor(ticket.status)}`}>{ticket.status.replace('_', ' ')}</span>
                        </td>
                        <td className="p-4 text-right">
                          {canManageMaintenance ? (
                            <>
                              {ticket.status === 'reported' && <button onClick={() => updateTicketStatus(ticket.id, 'in_progress')} className="text-brand-500 hover:text-brand-400 font-medium text-sm">Start Fix</button>}
                              {ticket.status === 'in_progress' && <button onClick={() => setActiveResolution(ticket.id)} className="text-green-500 hover:text-green-400 font-medium text-sm">Mark Resolved</button>}
                            </>
                          ) : (
                            <span className="text-xs text-gray-300 italic">Awaiting Tech Dispatch</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tickets.length === 0 && <div className="col-span-2 text-center text-gray-300 py-12">All systems green. No open tickets.</div>}
                {tickets.map(ticket => (
                  <div key={ticket.id} className="bg-dark-800 border border-dark-700 rounded-lg p-5 flex flex-col justify-between hover:border-gray-600 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-dark-900 border border-dark-700 text-white px-2 py-1 rounded text-sm font-bold">RM {ticket.rooms?.room_number} <span className="text-gray-200 font-normal ml-1">- {ticket.rooms?.name}</span></span>
                          <span className={`flex items-center gap-1 text-xs font-bold uppercase px-2 py-1 rounded ${ticket.priority === 'critical' ? 'bg-red-500/20 text-red-500' : ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                            <AlertTriangle size={14} /> {ticket.priority}
                          </span>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded uppercase font-bold tracking-wider ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-gray-300 font-medium mb-1 mt-3 flex items-center">
                        {ticket.issue_category} 
                        {getSLAWarning(ticket.created_at, ticket.status)}
                      </p>
                      <p className="text-sm text-gray-300">{ticket.description}</p>
                      
                      <div className="text-xs text-gray-300 mt-4 flex items-center gap-1">
                        <Clock size={12}/> Reported: {new Date(ticket.created_at).toLocaleString()}
                      </div>

                      {ticket.resolution_notes && (
                        <div className="mt-3 text-sm bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded">
                          <span className="font-bold block mb-1">Resolution Notes:</span>
                          {ticket.resolution_notes}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-dark-700 flex justify-end gap-2">
                      {canManageMaintenance ? (
                        <>
                          {ticket.status === 'reported' && <button onClick={() => updateTicketStatus(ticket.id, 'in_progress')} className="btn-primary py-1.5 px-4 text-sm">Start Fix</button>}
                          {ticket.status === 'in_progress' && <button onClick={() => setActiveResolution(ticket.id)} className="bg-green-500 hover:bg-green-600 text-white py-1.5 px-4 rounded text-sm font-medium transition-colors">Mark Resolved</button>}
                        </>
                      ) : (
                        <span className="text-xs text-gray-300 font-semibold italic flex items-center gap-1">
                          <Clock size={12} /> Awaiting Technical Repair
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Inspection Checklist Modal --- */}
      {activeInspection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setActiveInspection(null)} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ListChecks className="text-brand-500"/> Manager Inspection</h2>
            <p className="text-sm text-gray-200 mb-6">Verify the room meets all cleanliness standards before making it available.</p>
            
            <div className="space-y-3 mb-8">
              {Object.keys(checklist).map(key => (
                <label key={key} className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${checklist[key] ? 'border-brand-500 bg-brand-500/10' : 'border-dark-700 bg-dark-900 hover:bg-dark-800'}`}>
                  <input type="checkbox" checked={checklist[key]} onChange={(e) => setChecklist({...checklist, [key]: e.target.checked})} className="w-5 h-5 accent-brand-500" />
                  <span className={`font-medium capitalize ${checklist[key] ? 'text-brand-500' : 'text-gray-300'}`}>
                    {key === 'restock' ? 'Amenities Restocked' : `${key} Sanitized & Arranged`}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-4">
              <button onClick={handleRejectInspection} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 py-3 rounded font-bold transition-colors">
                Not Approved
              </button>
              <button onClick={handleSubmitInspection} className="flex-1 btn-primary py-3 flex justify-center items-center gap-2">
                <CheckCircle size={18}/> Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Ticket Resolution Modal --- */}
      {activeResolution && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setActiveResolution(null)} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Wrench className="text-green-500"/> Resolve Ticket</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Resolution Notes</label>
                <textarea required rows="4" value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors" placeholder="What was fixed? (e.g., Replaced AC filter and recharged freon)"></textarea>
              </div>
              <button onClick={handleResolveTicket} disabled={!resolutionNotes} className={`w-full py-3 rounded font-bold transition-colors ${resolutionNotes ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-dark-700 text-gray-300 cursor-not-allowed'}`}>
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}


      {/* --- Schedule Task Modal --- */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-sm shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Sparkles className="text-brand-500"/> {newTask.task_type === 'deep_cleaning' ? 'Schedule Deep Clean' : 'Assign Task'}</h2>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Room</label>
                <select required value={newTask.room_id} onChange={e => setNewTask({...newTask, room_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number} - {r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Task Type</label>
                <select value={newTask.task_type} onChange={e => setNewTask({...newTask, task_type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="checkout_cleaning">Checkout Cleaning</option>
                  <option value="daily_refresh">Daily Refresh</option>
                  <option value="deep_cleaning">Deep Cleaning</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Assign To (Optional)</label>
                <select value={newTask.housekeeper_id} onChange={e => setNewTask({...newTask, housekeeper_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="">Unassigned</option>
                  {(() => {
                    const hkStaff = staff.filter(s => (s.role || '').toLowerCase().trim() === 'housekeeping');
                    const onShift = hkStaff.filter(s => s.is_on_shift === true);
                    const offShift = hkStaff.filter(s => s.is_on_shift !== true);
                    return (
                      <>
                        {onShift.length > 0 && (
                          <optgroup label="🟢 On Shift (Clocked-In)">
                            {onShift.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                          </optgroup>
                        )}
                        {offShift.length > 0 && (
                          <optgroup label="🔴 Off Shift">
                            {offShift.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>
              <button type="submit" className="w-full btn-primary py-3 mt-6">Schedule Task</button>
            </form>
          </div>
        </div>
      )}

      {/* --- Assign Task Modal --- */}
      {isAssignModalOpen && activeAssignTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-sm shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => {setIsAssignModalOpen(false); setActiveAssignTask(null);}} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><User className="text-brand-500"/> Assign Staff</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Select Housekeeper</label>
                <select 
                  defaultValue={activeAssignTask.housekeeper_id || ''}
                  onChange={e => handleAssignTask(activeAssignTask.id, e.target.value)} 
                  className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="">Unassigned</option>
                  {(() => {
                    const hkStaff = staff.filter(s => (s.role || '').toLowerCase().trim() === 'housekeeping');
                    const onShift = hkStaff.filter(s => s.is_on_shift === true);
                    const offShift = hkStaff.filter(s => s.is_on_shift !== true);
                    return (
                      <>
                        {onShift.length > 0 && (
                          <optgroup label="🟢 On Shift (Clocked-In)">
                            {onShift.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                          </optgroup>
                        )}
                        {offShift.length > 0 && (
                          <optgroup label="🔴 Off Shift">
                            {offShift.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Report Issue Modal --- */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-sm shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setIsTicketModalOpen(false)} className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Wrench className="text-red-500"/> Report Issue</h2>
            <form onSubmit={handleSaveTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Room</label>
                <select required value={newTicket.room_id} onChange={e => setNewTicket({...newTicket, room_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Issue Category</label>
                <select value={newTicket.issue_category} onChange={e => setNewTicket({...newTicket, issue_category: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC (AC/Heating)</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Priority</label>
                <select value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Description</label>
                <textarea required rows="3" value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="Describe the issue..."></textarea>
              </div>
              <button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded mt-6 transition-colors">Submit Ticket</button>
            </form>
          </div>
        </div>
      )}

      {/* --- Store Requisition Modal --- */}
      <StoreRequisitionModal 
        isOpen={isRequisitionOpen} 
        onClose={() => setIsRequisitionOpen(false)} 
        department="housekeeping"
      />
    </div>
  );
};

export default AdminHousekeeping;
