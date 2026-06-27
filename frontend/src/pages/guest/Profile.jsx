import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Save, KeyRound, User, ShieldCheck } from 'lucide-react';

const Profile = () => {
  const { user, profile } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setResidentialAddress(user.residential_address || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      return toast.error('First and Last Name are required.');
    }

    setLoading(true);
    const toastId = toast.loading('Saving changes...');

    try {
      // Update public.profiles details
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          residential_address: residentialAddress
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update linked CRM profile details too
      try {
        await supabase
          .from('crm_guests')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: phone
          })
          .eq('profile_id', user.id);
      } catch (crmErr) {
        console.warn("CRM updates sync skipped:", crmErr);
      }

      toast.success('Profile details saved successfully! Refreshing dashboard...', { id: toastId });
      
      // Dispatch global sync event to update the layouts
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save details: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return toast.error('Please input a new password.');
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match.');

    setLoading(true);
    const toastId = toast.loading('Resetting credentials...');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Your account password has been updated securely!', { id: toastId });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      toast.error(`Failed to reset password: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-white">
      <div>
        <h2 className="text-2xl font-semibold text-white">Profile Settings</h2>
        <p className="text-gray-400 mt-1">Manage your identity, personal contact cards, and account security credentials.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card & Inputs */}
        <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-md">
          <div className="bg-dark-900/50 p-6 border-b border-dark-700 flex items-center gap-6">
            <div className="w-20 h-20 bg-dark-700 rounded-full border-2 border-gold-500 overflow-hidden flex-shrink-0">
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=D97706&color=fff`} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{firstName} {lastName}</h3>
              <p className="text-sm text-gray-400 capitalize">Guest Member</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">First Name *</label>
                <input 
                  type="text" 
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded p-3 text-sm focus:border-gold-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Last Name *</label>
                <input 
                  type="text" 
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded p-3 text-sm focus:border-gold-500 outline-none font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Email Address (Read-only)</label>
              <input 
                type="email" 
                disabled
                value={email}
                className="w-full bg-dark-900/50 border border-dark-700/50 text-gray-500 rounded p-3 text-sm outline-none font-mono cursor-not-allowed font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Phone Number</label>
              <input 
                type="tel" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 text-white rounded p-3 text-sm focus:border-gold-500 outline-none font-semibold"
                placeholder="+234..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Residential Address</label>
              <textarea 
                rows="2"
                value={residentialAddress}
                onChange={e => setResidentialAddress(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 text-white rounded p-3 text-sm focus:border-gold-500 outline-none font-semibold resize-none"
                placeholder="Your primary home address"
              />
            </div>

            {/* Terms & Conditions of Stay */}
            <div className="pt-6 border-t border-dark-700/50 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-gold-500" /> Terms & Conditions Agreement
              </h4>
              <p className="text-xs text-gray-400">
                Review our primary suite occupancy rules and conditions of stay in the apartments. Your consent is registered below:
              </p>
              <div className="bg-dark-900 border border-dark-700 rounded p-4 h-36 overflow-y-auto text-xs text-gray-400 space-y-2 scrollbar-thin select-text">
                <p className="font-bold text-white uppercase text-[10px] border-b border-dark-700 pb-1">Primary Apartment Stay Rules</p>
                <p><strong>1. Strict No-Smoking Suit Policy:</strong> Smoking or vaping is completely prohibited inside the suites or balconies. Violations trigger an immediate ₦50,000 deep cleaning fine.</p>
                <p><strong>2. Damage Liabilities:</strong> Guests agree to full incidental billing and financial responsibility for room damages caused during occupancy.</p>
                <p><strong>3. Noise Policies:</strong> Quiet hours are observed from 10:00 PM to 7:00 AM. Parties and loud crowds are strictly forbidden.</p>
              </div>
              <label className="flex items-center gap-3 p-3 bg-dark-900 border border-dark-700 rounded cursor-pointer hover:bg-dark-850 transition-colors">
                <input 
                  type="checkbox" 
                  checked={agreedTerms} 
                  onChange={e => {
                    setAgreedTerms(e.target.checked);
                    if(e.target.checked) toast.success("You have accepted the primary Terms & Conditions of Stay!");
                  }}
                  className="w-5 h-5 rounded border-dark-700 text-brand-500 accent-brand-500" 
                />
                <span className="text-xs font-semibold text-gray-300">I have read, understood, and accept the Terms & Conditions of Stay.</span>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-dark-700/50">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-gold-500 hover:bg-gold-600 text-dark-900 font-bold px-8 py-3 rounded-lg text-sm shadow-md transition-all flex items-center gap-2"
              >
                <Save size={16}/> Save Details
              </button>
            </div>
          </form>
        </div>

        {/* Security Reset Card */}
        <div className="lg:col-span-1 bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-md h-fit space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><KeyRound size={18} className="text-gold-500" /> Account Password</h3>
            <p className="text-xs text-gray-400 mt-1">Configure a new secure login code to protect your portal access.</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">New Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 text-white pl-3.5 pr-11 py-2.5 rounded text-xs focus:border-gold-500 outline-none font-semibold"
                  placeholder="Min. 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 text-white pl-3.5 pr-11 py-2.5 rounded text-xs focus:border-gold-500 outline-none font-semibold"
                  placeholder="Repeat new password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-dark-700 hover:bg-dark-600 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors flex justify-center items-center gap-1.5"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
