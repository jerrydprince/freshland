import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendResendEmail, sendSMSNotification } from '../../lib/emailService';
import { Zap, Mail, MessageSquare, Bell, Activity, Send, FileText, CheckCircle, XCircle, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

const CHANNELS = [
  { id: 'email', name: 'Email', icon: <Mail size={16}/> },
  { id: 'sms', name: 'SMS', icon: <MessageSquare size={16}/> },
  { id: 'whatsapp', name: 'WhatsApp', icon: <MessageSquare size={16}/> },
  { id: 'push', name: 'Push', icon: <Bell size={16}/> }
];

const TRIGGERS = [
  { id: 'booking_created', name: 'On Booking Creation' },
  { id: 'check_in_1day', name: '24 Hours Before Check-in' },
  { id: 'checkout', name: 'On Checkout' },
  { id: 'check_out_1day', name: '24 Hours Before Check-out' },
  { id: 'payment_overdue', name: 'Payment Overdue' },
  { id: 'review_request', name: '3 Days After Checkout (Review)' }
];

const AdminAutomations = () => {
  const [activeTab, setActiveTab] = useState('rules');
  const [loading, setLoading] = useState(false);

  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);

  // Modal States
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  
  const [templateForm, setTemplateForm] = useState({ id: null, name: '', channel: 'email', subject: '', body: '' });
  const [ruleForm, setRuleForm] = useState({ id: null, name: '', trigger_event: 'booking_created', template_id: '', is_active: true });

  // Test Notification State
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rules') {
        const { data: rData } = await supabase.from('automation_rules').select('*, notification_templates(name, channel)');
        const { data: tData } = await supabase.from('notification_templates').select('*');
        setRules(rData || []);
        setTemplates(tData || []);
      } else if (activeTab === 'templates') {
        const { data } = await supabase.from('notification_templates').select('*');
        setTemplates(data || []);
      } else if (activeTab === 'logs') {
        const { data } = await supabase.from('notification_logs').select('*').order('sent_at', { ascending: false }).limit(50);
        setLogs(data || []);
      }
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // --- TEMPLATES ---
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      if (templateForm.id) {
        await supabase.from('notification_templates').update({
          name: templateForm.name, channel: templateForm.channel, subject: templateForm.subject, body: templateForm.body
        }).eq('id', templateForm.id);
        toast.success("Template updated");
      } else {
        await supabase.from('notification_templates').insert([{
          name: templateForm.name, channel: templateForm.channel, subject: templateForm.subject, body: templateForm.body
        }]);
        toast.success("Template created");
      }
      setShowTemplateModal(false);
      fetchData();
    } catch (e) { toast.error("Save failed"); }
  };

  const deleteTemplate = async (id) => {
    await supabase.from('notification_templates').delete().eq('id', id);
    toast.success("Template deleted");
    fetchData();
  };

  // --- RULES ---
  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.template_id) return toast.error("Please select a template");
    try {
      if (ruleForm.id) {
        await supabase.from('automation_rules').update({
          name: ruleForm.name, trigger_event: ruleForm.trigger_event, template_id: ruleForm.template_id, is_active: ruleForm.is_active
        }).eq('id', ruleForm.id);
        toast.success("Rule updated");
      } else {
        await supabase.from('automation_rules').insert([{
          name: ruleForm.name, trigger_event: ruleForm.trigger_event, template_id: ruleForm.template_id, is_active: ruleForm.is_active
        }]);
        toast.success("Rule created");
      }
      setShowRuleModal(false);
      fetchData();
    } catch (e) { toast.error("Save failed"); }
  };

  const toggleRuleActive = async (id, currentVal) => {
    await supabase.from('automation_rules').update({ is_active: !currentVal }).eq('id', id);
    fetchData();
  };

  const deleteRule = async (id) => {
    await supabase.from('automation_rules').delete().eq('id', id);
    toast.success("Rule deleted");
    fetchData();
  };

  // --- TESTING EMAILS/SMS ---
  const sendTestNotification = async (template) => {
    if (!testEmail) return toast.error("Please enter a recipient email address or phone number for testing");
    if (template.channel !== 'email' && template.channel !== 'sms') {
      return toast.error("Live testing is currently only supported for Email and SMS channels");
    }
    
    // Parse template body with dummy data
    const parsedBody = template.body
      .replace(/{{guest_name}}/g, 'Test Guest')
      .replace(/{{booking_ref}}/g, 'WEB-999999')
      .replace(/{{check_in}}/g, new Date().toLocaleDateString())
      .replace(/{{check_out}}/g, new Date().toLocaleDateString())
      .replace(/{{room_number}}/g, '101')
      .replace(/{{room_details}}/g, 'Executive Suite')
      .replace(/{{total_amount}}/g, '150,000')
      .replace(/{{total_paid}}/g, '50,000')
      .replace(/{{balance_due}}/g, '100,000')
      .replace(/{{payment_status}}/g, 'Partial')
      .replace(/{{payment_amount}}/g, '50,000')
      .replace(/{{payment_ref}}/g, 'PAY-TEST-8888')
      .replace(/{{payment_method}}/g, 'Paystack')
      .replace(/{{payment_date}}/g, new Date().toLocaleDateString())
      .replace(/{{invoice_number}}/g, 'INV-WEB-999999');

    if (template.channel === 'sms') {
      setIsSending(true);
      toast.loading("Sending via SMS API...", { id: 'send' });
      try {
        const result = await sendSMSNotification({
          to: testEmail,
          message: parsedBody
        });
        if (result.success) {
          toast.success(result.simulated ? "Simulated! (Check SMS gateway logs)" : "SMS sent successfully!", { id: 'send' });
          
          // Log to DB
          await supabase.from('notification_logs').insert([{
            recipient: testEmail,
            channel: 'sms',
            template_name: template.name,
            status: 'sent'
          }]);
        } else {
          toast.error(`Failed to send SMS: ${result.error}`, { id: 'send' });
          
          await supabase.from('notification_logs').insert([{
            recipient: testEmail,
            channel: 'sms',
            template_name: template.name,
            status: 'failed',
            error_message: result.error
          }]);
        }
      } catch (err) {
        toast.error(`Failed to send: ${err.message}`, { id: 'send' });
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    toast.loading("Sending via Resend API...", { id: 'send' });

    // Fetch dynamic branding from system_settings
    let contactLogo = 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    let contactAddress = 'Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja';
    let contactPhone = '08033214684, 08062332639, 08171278657';
    let contactEmail = 'info@sparklesapartments.ng';

    try {
      const { data: sysSettings } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_logo', 'contact_address', 'contact_phone', 'contact_email']);
        
      if (sysSettings) {
        const settingsMap = sysSettings.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        if (settingsMap.contact_logo) contactLogo = settingsMap.contact_logo;
        if (settingsMap.contact_address) contactAddress = settingsMap.contact_address;
        if (settingsMap.contact_phone) contactPhone = settingsMap.contact_phone;
        if (settingsMap.contact_email) contactEmail = settingsMap.contact_email;
      }
    } catch (e) {
      console.warn("Failed to load branding settings for test notification:", e);
    }

    const result = await sendResendEmail({
      to: testEmail,
      subject: template.subject ? template.subject.replace(/{{booking_ref}}/g, 'WEB-999999').replace(/{{guest_name}}/g, 'Test Guest') : 'Sparkles Apartments Notification',
      html: `
        <div style="font-family: 'Outfit', sans-serif; padding: 30px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
            ${contactLogo ? `<img src="${contactLogo}" alt="Sparkles Apartments" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />` : ''}
            <h2 style="color: #000000; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">SPARKLES APARTMENTS</h2>
            <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase; tracking-wider: 0.1em;">Premium Luxury Shortlets</span>
          </div>
          <div style="font-size: 15px; line-height: 1.6; color: #4b5563; white-space: pre-wrap;">
            ${parsedBody.replace(/\n/g, '<br/>')}
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
            <p style="margin: 0 0 5px 0;">This is an automated operational alert sent from the Sparkles PMS Hub.</p>
            <p style="margin: 0;">${contactAddress}</p>
            <p style="margin: 5px 0 0 0;">Phones: ${contactPhone} | Email: ${contactEmail}</p>
          </div>
        </div>
      `
    });

    if (result.success) {
      toast.success(result.simulated ? "Simulated! (Add VITE_RESEND_API_KEY to send real emails)" : "Email sent successfully!", { id: 'send' });
      
      // Log to DB
      await supabase.from('notification_logs').insert([{
        recipient: testEmail,
        channel: 'email',
        template_name: template.name,
        status: 'sent'
      }]);
    } else {
      toast.error(`Failed to send: ${result.error}`, { id: 'send' });
      
      await supabase.from('notification_logs').insert([{
        recipient: testEmail,
        channel: 'email',
        template_name: template.name,
        status: 'failed',
        error_message: result.error
      }]);
    }

    setIsSending(false);
  };


  return (
    <div className="pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-lg border border-dark-700 shadow-sm mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="text-brand-500"/> Automations & Alerts
          </h1>
          <p className="text-gray-400 mt-1">Configure automated workflows and manage communication templates via Resend/SMS.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-dark-700 mb-6 overflow-x-auto">
        <button onClick={() => setActiveTab('rules')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rules' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
          <Activity size={18} /> Automation Rules
        </button>
        <button onClick={() => setActiveTab('templates')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'templates' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
          <FileText size={18} /> Message Templates
        </button>
        <button onClick={() => setActiveTab('logs')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'logs' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
          <Send size={18} /> Delivery Logs
        </button>
      </div>

      {/* --- RULES TAB --- */}
      {activeTab === 'rules' && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
            <h3 className="font-bold text-white">Active Triggers</h3>
            <button onClick={() => { setRuleForm({ id: null, name: '', trigger_event: 'booking_created', template_id: '', is_active: true }); setShowRuleModal(true); }} className="btn-primary py-2 px-4 text-sm font-bold rounded flex gap-2"><Zap size={16}/> New Rule</button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
              <tr>
                <th className="p-4 font-semibold">Rule Name</th>
                <th className="p-4 font-semibold">Trigger Event</th>
                <th className="p-4 font-semibold">Attached Template</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-dark-700/30">
                  <td className="p-4 font-bold text-white">{rule.name}</td>
                  <td className="p-4 text-brand-500 font-mono text-xs">{rule.trigger_event}</td>
                  <td className="p-4 text-gray-300">
                    {rule.notification_templates?.name}
                    <span className="ml-2 text-xs text-gray-500 uppercase">({rule.notification_templates?.channel})</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleRuleActive(rule.id, rule.is_active)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${rule.is_active ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'}`}>
                      {rule.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={() => { setRuleForm(rule); setShowRuleModal(true); }} className="p-2 text-gray-400 hover:text-white"><Edit size={16}/></button>
                    <button onClick={() => deleteRule(rule.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TEMPLATES TAB --- */}
      {activeTab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4">
              <input type="text" placeholder="Test recipient (email/phone)..." value={testEmail} onChange={e => setTestEmail(e.target.value)} className="bg-dark-900 border border-dark-700 p-2 rounded text-sm text-white outline-none focus:border-brand-500 w-64"/>
            </div>
            <button onClick={() => { setTemplateForm({ id: null, name: '', channel: 'email', subject: '', body: '' }); setShowTemplateModal(true); }} className="bg-dark-700 hover:bg-dark-600 text-white font-bold py-2 px-4 rounded text-sm border border-dark-600 transition-colors">
              Create Template
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <div key={template.id} className="bg-dark-800 border border-dark-700 rounded-lg p-5 flex flex-col hover:border-brand-500/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">{template.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">
                      {CHANNELS.find(c => c.id === template.channel)?.icon} {template.channel}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setTemplateForm(template); setShowTemplateModal(true); }} className="text-gray-400 hover:text-white"><Edit size={16}/></button>
                    <button onClick={() => deleteTemplate(template.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                </div>
                
                {template.channel === 'email' && <div className="text-xs text-gray-500 mb-2 truncate"><strong>Subj:</strong> {template.subject}</div>}
                
                <div className="bg-dark-900 p-4 rounded text-gray-300 text-sm font-mono flex-1 whitespace-pre-wrap break-words border border-dark-700">
                  {template.body}
                </div>

                <div className="mt-4 pt-4 border-t border-dark-700">
                  <button onClick={() => sendTestNotification(template)} disabled={isSending} className="w-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    <Send size={16}/> Send Test Notification
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- LOGS TAB --- */}
      {activeTab === 'logs' && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
              <tr>
                <th className="p-4 font-semibold">Sent At</th>
                <th className="p-4 font-semibold">Recipient</th>
                <th className="p-4 font-semibold">Channel</th>
                <th className="p-4 font-semibold">Template Sent</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-dark-700/30">
                  <td className="p-4 text-gray-400 font-mono text-xs">{new Date(log.sent_at).toLocaleString()}</td>
                  <td className="p-4 text-white font-medium">{log.recipient}</td>
                  <td className="p-4 text-gray-400 uppercase text-xs">{log.channel}</td>
                  <td className="p-4 text-gray-300">{log.template_name}</td>
                  <td className="p-4">
                    {log.status === 'sent' ? (
                      <span className="flex items-center gap-1 text-green-500 text-xs font-bold"><CheckCircle size={14}/> Sent</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs font-bold" title={log.error_message}><XCircle size={14}/> Failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Configure Automation Rule</h2>
            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
                <input required type="text" value={ruleForm.name} onChange={e => setRuleForm({...ruleForm, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trigger Event</label>
                <select value={ruleForm.trigger_event} onChange={e => setRuleForm({...ruleForm, trigger_event: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 font-mono">
                  {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notification Template</label>
                <select required value={ruleForm.template_id} onChange={e => setRuleForm({...ruleForm, template_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500">
                  <option value="">Select a template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-4 mt-4 border-t border-dark-700">
                <button type="button" onClick={() => setShowRuleModal(false)} className="flex-1 bg-dark-700 hover:bg-dark-600 py-3 rounded text-white font-bold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 btn-primary py-3 rounded">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-2xl rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Message Template Builder</h2>
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Template Name</label>
                  <input required type="text" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500" placeholder="e.g. Pre-arrival SMS" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Delivery Channel</label>
                  <select value={templateForm.channel} onChange={e => setTemplateForm({...templateForm, channel: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 uppercase">
                    {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              
              {templateForm.channel === 'email' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email Subject</label>
                  <input required type="text" value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500" placeholder="Your upcoming stay..." />
                </div>
              )}
              
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex justify-between">
                  Message Body 
                  <span className="text-xs text-brand-500 font-mono">Use variables: {'{{guest_name}}, {{booking_ref}}, {{check_in}}'}</span>
                </label>
                <textarea required rows={6} value={templateForm.body} onChange={e => setTemplateForm({...templateForm, body: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 font-mono text-sm leading-relaxed" placeholder="Hi {{guest_name}}..."></textarea>
              </div>

              <div className="flex gap-4 pt-4 mt-4 border-t border-dark-700">
                <button type="button" onClick={() => setShowTemplateModal(false)} className="flex-1 bg-dark-700 hover:bg-dark-600 py-3 rounded text-white font-bold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 btn-primary py-3 rounded">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminAutomations;
