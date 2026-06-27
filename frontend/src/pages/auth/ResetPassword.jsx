import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasSession, setHasSession] = useState(true);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [resetToken, setResetToken] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const email = params.get('email');
      const code = params.get('code');
      
      if (token && email) {
        setResetToken(token);
        setResetEmail(email);
        setHasSession(true);
        setSessionChecking(false);
        return;
      }
      
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } catch (e) {
          console.error("Code exchange failed:", e);
          toast.error("Could not verify password reset link: " + e.message);
          setHasSession(false);
          setSessionChecking(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setHasSession(false);
      } else {
        setHasSession(true);
      }
      setSessionChecking(false);
    };
    checkSession();
  }, []);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!password) return toast.error('Please enter a new password');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirmPassword) return toast.error('Passwords do not match');

    setLoading(true);
    const toastId = toast.loading('Updating your password...');

    try {
      if (resetToken && resetEmail) {
        // Custom backend password reset flow
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: resetEmail,
            token: resetToken,
            password: password
          })
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Failed to reset password');
        }

        toast.success('Password updated successfully! Please sign in.', { id: toastId });
        
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        // Standard Supabase auth reset flow
        const { error } = await supabase.auth.updateUser({
          password: password
        });

        if (error) throw error;

        toast.success('Password updated successfully! Please sign in.', { id: toastId });
        await supabase.auth.signOut();
        
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to reset password', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold-500 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Verifying secure session...</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="text-center space-y-6 py-4">
        <AlertCircle size={48} className="text-red-500 mx-auto" />
        <h3 className="text-xl font-medium text-white">Reset Link Expired or Invalid</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          The password reset session is invalid or has expired. Password reset links are secure and only valid for a single use within a short period.
        </p>
        <div className="pt-4 border-t border-dark-700">
          <Link to="/forgot-password" className="btn-primary inline-block w-full py-3 text-center">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-medium mb-4 text-center">Create New Password</h2>
      <p className="text-gray-400 text-sm mb-6 text-center leading-relaxed">
        Choose a secure, memorable password that contains at least 6 characters.
      </p>
      
      <form onSubmit={handlePasswordUpdate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white pl-4 pr-12 py-3 focus:outline-none focus:border-gold-500 transition-colors"
              placeholder="Min. 6 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
          <input 
            type="password" 
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-gold-500 transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-6">
          {loading ? 'Resetting password...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
