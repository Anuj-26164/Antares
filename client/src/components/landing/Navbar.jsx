import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import Button from '../common/Button';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-fog dark:border-graphite"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(9,9,11,0.92)',
      }}
    >
      <div className="w-full max-w-[1400px] mx-auto h-[64px] flex items-center justify-between px-6 lg:px-10">
        {/* Left: Logo + Brand — always navigates home */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <img src="/antareslogo.svg" alt="Antares" className="h-8 w-8" />
          <span className="font-bold text-ink dark:text-snow text-[22px]">Antares</span>
        </Link>

        {/* Center: Nav links */}
        <div className="hidden md:flex items-center gap-10">
          <a
            href="#features"
            className="text-ink dark:text-ash text-[15px] font-medium hover:opacity-70 transition-opacity"
          >
            Features
          </a>
          <Link
            to="/events"
            className="text-ink dark:text-ash text-[15px] font-medium hover:opacity-70 transition-opacity no-underline"
          >
            Events
          </Link>
          <Link
            to="/gallery"
            className="text-ink dark:text-ash text-[15px] font-medium hover:opacity-70 transition-opacity no-underline"
          >
            Gallery
          </Link>
          <a
            href="#about"
            className="text-ink dark:text-ash text-[15px] font-medium hover:opacity-70 transition-opacity"
          >
            About
          </a>
        </div>

        {/* Right: Auth buttons */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/profile">
                <Button variant="outline" size="sm" pill>
                  Profile
                </Button>
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="filled" size="sm" pill>
                    Dashboard
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline" size="sm" pill>
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="filled" size="sm" pill>
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
