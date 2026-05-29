import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="bg-obsidian rounded-t-[36px] mt-16">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        {/* Top section: Brand + columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand column — spans 2 cols */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/antareslogo.svg" alt="Antares" className="h-8 w-8" />
              <span className="font-bold text-snow text-[22px]">Antares</span>
            </div>
            <p className="text-ash text-[15px] leading-relaxed mb-2">
              Capture • Organize • Relive Memories
            </p>
            <p className="text-steel text-[14px] leading-relaxed max-w-xs">
              AI-powered event and media management platform for clubs, photographers, and communities.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-snow text-[14px] font-semibold uppercase tracking-wider mb-5">Navigation</h4>
            <ul className="flex flex-col gap-3">
              <li><a onClick={() => navigate('/')} className="text-ash text-[15px] hover:text-snow transition-colors cursor-pointer">Home</a></li>
              <li><a onClick={() => navigate('/events')} className="text-ash text-[15px] hover:text-snow transition-colors cursor-pointer">Events</a></li>
              <li><a onClick={() => navigate('/gallery')} className="text-ash text-[15px] hover:text-snow transition-colors cursor-pointer">Gallery</a></li>
              <li><a href="#features" className="text-ash text-[15px] hover:text-snow transition-colors cursor-pointer">About</a></li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-snow text-[14px] font-semibold uppercase tracking-wider mb-5">Features</h4>
            <ul className="flex flex-col gap-3">
              <li><span className="text-ash text-[15px]">AI Photo Discovery</span></li>
              <li><span className="text-ash text-[15px]">Smart Search</span></li>
              <li><span className="text-ash text-[15px]">Cloud Media Storage</span></li>
              <li><span className="text-ash text-[15px]">Event Albums</span></li>
              <li><span className="text-ash text-[15px]">Real-time Notifications</span></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-snow text-[14px] font-semibold uppercase tracking-wider mb-5">Community</h4>
            <ul className="flex flex-col gap-3">
              <li><span className="text-ash text-[15px]">Clubs & Societies</span></li>
              <li><span className="text-ash text-[15px]">Photographers</span></li>
              <li><span className="text-ash text-[15px]">Contributors</span></li>
              <li><span className="text-ash text-[15px]">Support</span></li>
            </ul>
          </div>

          {/* Legal + Connect */}
          <div>
            <h4 className="text-snow text-[14px] font-semibold uppercase tracking-wider mb-5">Legal</h4>
            <ul className="flex flex-col gap-3 mb-8">
              <li><span className="text-ash text-[15px]">Privacy Policy</span></li>
              <li><span className="text-ash text-[15px]">Terms of Service</span></li>
              <li><span className="text-ash text-[15px]">Community Guidelines</span></li>
            </ul>

            <h4 className="text-snow text-[14px] font-semibold uppercase tracking-wider mb-5">Connect</h4>
            <div className="flex items-center gap-4">
              {/* Instagram */}
              <a href="#" className="text-ash hover:text-snow transition-colors" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* GitHub */}
              <a href="#" className="text-ash hover:text-snow transition-colors" aria-label="GitHub">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="#" className="text-ash hover:text-snow transition-colors" aria-label="LinkedIn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-graphite/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-steel text-[13px]">
            © 2026 Antares. All rights reserved.
          </p>
          <p className="text-steel text-[13px]">
            Built for smarter event memories.
          </p>
        </div>
      </div>
    </footer>
  );
}
