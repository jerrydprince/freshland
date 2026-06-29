import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    console.log('Login form submitted', { email, password });
    e.preventDefault();
    if (!email || !password) return toast.error('Please enter email and password');
    
    setLoading(true);
    const toastId = toast.loading('Signing in...');
    
    try {
      const { user: loggedUser } = await login({ email, password });
      console.log('Login successful', loggedUser);
      
      const { data: profileData } = await supabase.from('profiles').select('role').eq('id', loggedUser.id).single();
      const role = profileData?.role || 'guest';

      toast.success('Successfully logged in!', { id: toastId });
      // Delay navigation briefly so the toast can appear before the route changes
      setTimeout(() => navigate(role === 'guest' ? '/guest' : '/admin'), 200);
      // No need for manual location reload – context will update UI
      // The context state will update and AuthLayout will automatically redirect to the dashboard.
      // We do not use window.location.href because it can interrupt Supabase localStorage persistence.
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to sign in', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-medium mb-6 text-center">Sign In</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Email Address</label>
          <input 
            type="email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-gold-500 transition-colors"
            placeholder="admin@luxe.com or guest@luxe.com"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-200">Password</label>
            <Link to="/forgot-password" className="text-sm text-gold-500 hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white pl-4 pr-12 py-3 focus:outline-none focus:border-gold-500 transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-200 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-3 mt-4">
          Sign In
        </button>
      </form>
    </div>
  );
};

export default Login;
