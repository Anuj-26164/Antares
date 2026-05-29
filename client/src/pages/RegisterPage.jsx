import { useState } from 'react';
import BrandLink from '../components/common/BrandLink.jsx';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore.js';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';
import BackButton from '../components/common/BackButton.jsx';
import GoogleAuthButton from '../components/auth/GoogleAuthButton.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((state) => state.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
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
      await register({ name, email, password });
      navigate('/events', { replace: true });
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Registration failed' });
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
          className="w-full bg-ink rounded-[36px] p-8 border border-graphite"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="mb-6"><BrandLink size="lg" /></div>
          <h1 className="text-[32px] font-bold text-snow mb-2">Create account</h1>
          <p className="text-ash text-[14px] mb-8">Join Antares to access event media</p>

          {errors.form && (
            <div className="mb-4 rounded-[14px] bg-red-900/30 border border-red-500/30 px-4 py-3 text-[13px] text-red-400">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              type="password"
              placeholder="Password (min 8 characters)"
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
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-graphite" />
            <span className="text-ash text-[12px]">or</span>
            <div className="flex-1 h-px bg-graphite" />
          </div>

          <GoogleAuthButton />

          <p className="text-center text-ash text-[13px] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-snow font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
