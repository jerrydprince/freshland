import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { sendWelcomeEmail } from '../../lib/emailService';

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      return toast.error('Please fill in all fields');
    }

    setLoading(true);
    const toastId = toast.loading('Creating account...');

    try {
      await register({ email, password, firstName, lastName });
      
      // Dispatch welcome email in the background
      try {
        await sendWelcomeEmail({ email, firstName, lastName });
      } catch (welcomeErr) {
        console.warn("Failed to dispatch welcome email", welcomeErr);
      }

      toast.success('Account created successfully!', { id: toastId });
      navigate('/guest'); // Default redirect to guest dashboard
    } catch (error) {
      console.error(error);
      const errMsg = error.message || '';
      if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exist') || errMsg.toLowerCase().includes('already in use')) {
        toast.error('User already exists. Redirecting to login...', { id: toastId });
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast.error(error.message || 'Failed to create account', { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-medium mb-6 text-center">Create an Account</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">First Name</label>
            <input 
              type="text" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Last Name</label>
            <input 
              type="text" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Email Address</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 focus:outline-none focus:border-gold-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white pl-4 pr-12 py-3 focus:outline-none focus:border-gold-500 transition-colors"
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
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-4">
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      
      <div className="mt-8 pt-6 border-t border-dark-700 text-center">
        <p className="text-gray-200 text-sm">
          Already have an account? <Link to="/login" className="text-gold-500 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
