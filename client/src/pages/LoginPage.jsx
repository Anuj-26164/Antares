import { useState } from 'react';
import BrandLink from '../components/common/BrandLink.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore.js';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';
import BackButton from '../components/common/BackButton.jsx';
import GoogleAuthButton from '../components/auth/GoogleAuthButton.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState(() => {
    // Check for Google OAuth error in URL params
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'account_blocked') {
      return { form: 'Your account has been blocked. Please contact the administrator.' };
    }
    if (error === 'google_auth_failed') {
      return { form: 'Google authentication failed. Please try again.' };
    }
    return {};
  });
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password.trim()) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/gallery', { replace: true });
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian px-4">
      <div className="w-full max-w-[420px]">
        <BackButton fallback="/" />
        <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] bg-ink rounded-[36px] p-8 border border-graphite"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="mb-6"><BrandLink size="lg" /></div>
        <h1 className="text-[32px] font-bold text-snow mb-2">Welcome back</h1>
        <p className="text-ash text-[14px] mb-8">Sign in to your account</p>

        {errors.form && (
          <div className="mb-4 rounded-[14px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Button
            variant="filled"
            size="lg"
            pill
            disabled={loading}
            onClick={handleSubmit}
            className="w-full mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-fog dark:bg-graphite" />
          <span className="text-ash text-[12px]">or</span>
          <div className="flex-1 h-px bg-fog dark:bg-graphite" />
        </div>

        <GoogleAuthButton />

        <p className="text-center text-ash text-[13px] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-snow font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
      </div>
    </div>
  );
}
