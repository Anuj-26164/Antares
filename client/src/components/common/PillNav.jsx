import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';

const PillNav = ({
  logo,
  logoAlt = 'Logo',
  brandName = 'ANTARES',
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#120F17',
  pillColor = '#60A5FA',
  hoveredPillTextColor = '#120F17',
  pillTextColor,
  onMobileMenuClick,
  initialLoadAnimation = true,
  rightSlot = null,
}) => {
  const resolvedPillTextColor = pillTextColor ?? baseColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const circleRefs      = useRef([]);
  const tlRefs          = useRef([]);
  const activeTweenRefs = useRef([]);
  const logoImgRef      = useRef(null);
  const logoTweenRef    = useRef(null);
  const hamburgerRef    = useRef(null);
  const mobileMenuRef   = useRef(null);
  const navItemsRef     = useRef(null);
  const logoRef         = useRef(null);
  const pillRefs        = useRef([]);
  const sliderRef       = useRef(null);

  // ── GSAP ripple + load animation ─────────────────────────────────────────
  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return;

        const pill  = circle.parentElement;
        const rect  = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R       = ((w * w) / 4 + h * h) / (2 * h);
        const D       = Math.ceil(2 * R) + 2;
        const delta   = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width  = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });

        const label = pill.querySelector('.pill-label');
        const hover = pill.querySelector('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (hover) gsap.set(hover, { y: Math.ceil(h + 100), opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        if (hover) tl.to(hover, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        tlRefs.current[index] = tl;
      });
    };

    layout();
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout).catch(() => {});

    const menu = mobileMenuRef.current;
    if (menu) gsap.set(menu, { visibility: 'hidden', opacity: 0 });

    if (initialLoadAnimation) {
      const logoEl    = logoRef.current;
      const navItemsEl = navItemsRef.current;
      if (logoEl) {
        gsap.set(logoEl, { scale: 0 });
        gsap.to(logoEl, { scale: 1, duration: 0.6, ease });
      }
      if (navItemsEl) {
        gsap.set(navItemsEl, { width: 0, overflow: 'hidden' });
        gsap.to(navItemsEl, { width: 'auto', duration: 0.6, ease });
      }
    }

    return () => window.removeEventListener('resize', layout);
  }, [items, ease, initialLoadAnimation]);

  // ── Hover handlers ────────────────────────────────────────────────────────
  const handleEnter = i => {
    setHoveredIndex(i);

    // Animate sliding pill
    const pill = pillRefs.current[i];
    const slider = sliderRef.current;
    const container = navItemsRef.current;
    if (pill && slider && container) {
      const pillRect = pill.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const left = pillRect.left - containerRect.left;
      const width = pillRect.width;

      gsap.to(slider, {
        x: left,
        width: width,
        opacity: 1,
        duration: 0.3,
        ease: 'power3.out',
        overwrite: true,
      });
    }

    // GSAP ripple
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
  };

  const handleLeave = i => {
    setHoveredIndex(null);

    // Hide sliding pill
    const slider = sliderRef.current;
    if (slider) {
      gsap.to(slider, { opacity: 0, duration: 0.25, ease: 'power2.out', overwrite: true });
    }

    // GSAP ripple
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' });
  };

  const handleLogoEnter = () => {
    const img = logoImgRef.current;
    if (!img) return;
    logoTweenRef.current?.kill();
    gsap.set(img, { rotate: 0 });
    logoTweenRef.current = gsap.to(img, { rotate: 360, duration: 0.5, ease, overwrite: 'auto' });
  };

  // ── Mobile menu toggle ────────────────────────────────────────────────────
  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    const hamburger = hamburgerRef.current;
    const menu      = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line');
      if (newState) {
        gsap.to(lines[0], { rotation: 45,  y:  3, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(menu,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.3, ease, transformOrigin: 'top center' }
        );
      } else {
        gsap.to(menu, {
          opacity: 0, y: -8, duration: 0.2, ease,
          onComplete: () => gsap.set(menu, { visibility: 'hidden' }),
        });
      }
    }

    onMobileMenuClick?.();
  };

  const isExternalLink = href =>
    href?.startsWith('http') || href?.startsWith('//') ||
    href?.startsWith('mailto:') || href?.startsWith('tel:') || href?.startsWith('#');

  const isRouterLink = href => href && !isExternalLink(href);

  // ── CSS vars ──────────────────────────────────────────────────────────────
  const cssVars = {
    '--base':        baseColor,
    '--pill-bg':     pillColor,
    '--hover-text':  hoveredPillTextColor,
    '--pill-text':   resolvedPillTextColor,
    '--nav-h':       '78px',
    '--pill-pad-x':  '28px',
    '--pill-gap':    '5px',
  };

  // ── Nav item pill classes ────────────────────────────────────────────────
  const basePillClasses =
    'relative overflow-hidden inline-flex items-center justify-center h-full ' +
    'no-underline rounded-full font-medium text-sm leading-none ' +
    'uppercase tracking-wide whitespace-nowrap cursor-pointer';

  return (
    /* ── Fixed full-width wrapper ── */
    <div
      className="fixed top-0 left-0 right-0 z-[1000]"
      style={{
        background: `${baseColor}b3`,
        boxShadow: '0 4px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(96,165,250,0.1)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        borderBottom: '1px solid rgba(96,165,250,0.08)',
      }}
    >
      <nav
        className={`w-full max-w-[1400px] mx-auto flex items-center justify-between px-6 lg:px-10 ${className}`}
        aria-label="Primary"
        style={{ ...cssVars, height: 'var(--nav-h)' }}
      >
        {/* ── Left: Logo + Brand Name ── */}
        {isRouterLink(items?.[0]?.href) ? (
          <Link
            to={items[0].href}
            aria-label="Home"
            onMouseEnter={handleLogoEnter}
            ref={logoRef}
            className="flex items-center gap-3 shrink-0 no-underline transition-opacity duration-200 hover:opacity-80"
          >
            <img
              src={logo}
              alt={logoAlt}
              ref={logoImgRef}
              className="object-contain block"
              style={{ width: '38px', height: '38px' }}
            />
            {brandName && (
              <span
                className="text-lg font-semibold tracking-wide uppercase"
                style={{ color: pillColor }}
              >
                {brandName}
              </span>
            )}
          </Link>
        ) : (
          <a
            href={items?.[0]?.href || '#'}
            aria-label="Home"
            onMouseEnter={handleLogoEnter}
            ref={logoRef}
            className="flex items-center gap-3 shrink-0 no-underline transition-opacity duration-200 hover:opacity-80"
          >
            <img
              src={logo}
              alt={logoAlt}
              ref={logoImgRef}
              className="object-contain block"
              style={{ width: '38px', height: '38px' }}
            />
            {brandName && (
              <span
                className="text-lg font-semibold tracking-wide uppercase"
                style={{ color: pillColor }}
              >
                {brandName}
              </span>
            )}
          </a>
        )}

        {/* ── Center/Right: Desktop nav items ── */}
        <div
          ref={navItemsRef}
          className="hidden md:flex items-center rounded-full relative"
          style={{
            height: '52px',
            background: `${pillColor}10`,
            border: `1px solid ${pillColor}20`,
          }}
        >
          {/* Sliding pill highlight */}
          <div
            ref={sliderRef}
            className="absolute top-1 bottom-1 rounded-full pointer-events-none"
            style={{ background: pillColor, opacity: 0, width: 0, zIndex: 0 }}
          />
          <ul
            role="menubar"
            className="list-none flex items-stretch m-0 h-full relative z-[1]"
            style={{ padding: '4px', gap: 'var(--pill-gap)' }}
          >
            {items.map((item, i) => {
              const isActive =
                activeHref === item.href ||
                (item.href !== '/' && activeHref?.startsWith(item.href));

              const pillStyle = {
                background:   isActive && hoveredIndex === null ? pillColor : 'transparent',
                color:        isActive && hoveredIndex === null ? resolvedPillTextColor
                            : hoveredIndex === i ? resolvedPillTextColor
                            : 'rgba(255,255,255,0.6)',
                paddingLeft:  'var(--pill-pad-x)',
                paddingRight: 'var(--pill-pad-x)',
                transition:   'background 0.2s, color 0.2s',
              };

              const PillContent = (
                <>
                  {/* GSAP ripple circle */}
                  <span
                    className="hover-circle absolute left-1/2 bottom-0 rounded-full z-[1] block pointer-events-none"
                    style={{ background: pillColor, willChange: 'transform' }}
                    aria-hidden="true"
                    ref={el => { circleRefs.current[i] = el; }}
                  />
                  {/* Label stack */}
                  <span className="label-stack relative inline-block leading-none z-[2]">
                    <span
                      className="pill-label relative z-[2] inline-block leading-none"
                      style={{ willChange: 'transform' }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="pill-label-hover absolute left-0 top-0 z-[3] inline-block leading-none"
                      style={{ color: hoveredPillTextColor, willChange: 'transform, opacity' }}
                      aria-hidden="true"
                    >
                      {item.label}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={item.href} role="none" className="flex h-full" ref={el => { pillRefs.current[i] = el; }}>
                  {isRouterLink(item.href) ? (
                    <Link
                      role="menuitem"
                      to={item.href}
                      className={basePillClasses}
                      style={pillStyle}
                      aria-label={item.ariaLabel || item.label}
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => handleLeave(i)}
                    >
                      {PillContent}
                    </Link>
                  ) : (
                    <a
                      role="menuitem"
                      href={item.href}
                      className={basePillClasses}
                      style={pillStyle}
                      aria-label={item.ariaLabel || item.label}
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => handleLeave(i)}
                    >
                      {PillContent}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Right slot (Sign Out, etc.) ── */}
        {rightSlot && (
          <div className="hidden md:flex items-center gap-2 ml-4 relative z-[1001]">
            {rightSlot}
          </div>
        )}

        {/* ── Mobile hamburger ── */}
        <button
          ref={hamburgerRef}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          className="md:hidden rounded-full border-0 flex flex-col items-center justify-center gap-[6px] cursor-pointer shrink-0"
          style={{
            width:      '44px',
            height:     '44px',
            background: `${pillColor}15`,
            border:     `1px solid ${pillColor}30`,
          }}
        >
          <span
            className="hamburger-line rounded origin-center"
            style={{ width: '18px', height: '2px', background: pillColor }}
          />
          <span
            className="hamburger-line rounded origin-center"
            style={{ width: '18px', height: '2px', background: pillColor }}
          />
        </button>
      </nav>

      {/* ── Mobile dropdown ── */}
      <div
        ref={mobileMenuRef}
        className="md:hidden absolute top-full left-0 right-0 z-[998] origin-top overflow-hidden"
        style={{
          background: baseColor,
          borderTop: `1px solid ${pillColor}15`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
      >
        <ul className="list-none m-0 flex flex-col px-6 py-4 gap-1">
          {items.map(item => {
            const isActive =
              activeHref === item.href ||
              (item.href !== '/' && activeHref?.startsWith(item.href));

            const linkStyle = {
              background: isActive ? pillColor : 'transparent',
              color:      isActive ? resolvedPillTextColor : 'rgba(255,255,255,0.6)',
              transition: 'background 0.15s, color 0.15s',
            };

            const linkClasses =
              'block py-3 px-5 text-[15px] font-semibold uppercase tracking-[0.06em] rounded-full';

            return (
              <li key={item.href}>
                {isRouterLink(item.href) ? (
                  <Link
                    to={item.href}
                    className={linkClasses}
                    style={linkStyle}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = `${pillColor}22`;
                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                      }
                    }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={item.href}
                    className={linkClasses}
                    style={linkStyle}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = `${pillColor}22`;
                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                      }
                    }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {/* Right slot in mobile menu */}
        {rightSlot && (
          <div
            className="flex items-center gap-3 px-6 py-3 border-t"
            style={{ borderColor: `${pillColor}20` }}
          >
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
};

export default PillNav;
