import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Contact = () => {
  const [contactInfo, setContactInfo] = useState({});
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchContactSettings();
  }, []);

  const fetchContactSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').in('setting_key', ['contact_email', 'contact_phone', 'contact_address']);
      if (data) {
        const settings = {};
        data.forEach(item => settings[item.setting_key] = item.setting_value);
        setContactInfo(settings);
      }
    } catch (e) { console.error("Contact load error:", e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Sending your message...");
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE}/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const res = await response.json();
      if (response.ok && res.success) {
        toast.success("Message sent successfully!", { id: toastId });
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        throw new Error(res.error || "Failed to send message.");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to send message: ${err.message}`, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const phones = contactInfo.contact_phone ? contactInfo.contact_phone.split(',').map(p => p.trim()) : ['08103694837, 08174971881'];

  return (
    <div className="pt-24 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Get in Touch</h1>
        <p className="text-gray-200 text-center mb-16 max-w-2xl mx-auto">We are here to assist you with any inquiries or special requests you may have.</p>

        <div className="flex flex-col lg:flex-row gap-12 max-w-6xl mx-auto">
          {/* Contact Info */}
          <div className="lg:w-1/3 space-y-8">
            <div className="bg-dark-800 p-8 border border-dark-700 hover:border-brand-500 transition-colors">
              <div className="w-12 h-12 bg-dark-900 border border-brand-500 text-brand-500 flex items-center justify-center mb-6">
                <MapPin size={24} />
              </div>
              <h3 className="text-xl font-medium mb-2">Location</h3>
              <p className="text-gray-200 whitespace-pre-wrap">{contactInfo.contact_address || '123 Luxury Avenue,\nVictoria Island, Lagos, Nigeria'}</p>
            </div>
            
            <div className="bg-dark-800 p-8 border border-dark-700 hover:border-brand-500 transition-colors">
              <div className="w-12 h-12 bg-dark-900 border border-brand-500 text-brand-500 flex items-center justify-center mb-6">
                <Phone size={24} />
              </div>
              <h3 className="text-xl font-medium mb-2">Phone</h3>
              <div className="text-gray-200">
                {phones.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>

            <div className="bg-dark-800 p-8 border border-dark-700 hover:border-brand-500 transition-colors">
              <div className="w-12 h-12 bg-dark-900 border border-brand-500 text-brand-500 flex items-center justify-center mb-6">
                <Mail size={24} />
              </div>
              <h3 className="text-xl font-medium mb-2">Email</h3>
              <p className="text-gray-200">{contactInfo.contact_email || 'info@Freshlandhotels.com'}</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:w-2/3 bg-dark-800 p-8 md:p-12 border border-dark-700">
            <h3 className="text-2xl font-medium mb-8">Send a Message</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Your Name</label>
                  <input 
                    type="text" 
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    required
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    required
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Subject</label>
                <input 
                  type="text" 
                  value={form.subject}
                  onChange={e => setForm({...form, subject: e.target.value})}
                  required
                  className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Message</label>
                <textarea 
                  rows="6" 
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  required
                  className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
                ></textarea>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-primary w-full md:w-auto px-10 py-4 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
