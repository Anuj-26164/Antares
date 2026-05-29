import { Link } from 'react-router-dom';

/**
 * Clickable brand logo + name that always navigates to home.
 * Uses React Router <Link> for reliable SPA navigation.
 */
export default function BrandLink({ size = 'md' }) {
  const sizes = {
    sm: { img: 'h-6 w-6', text: 'text-[18px]' },
    md: { img: 'h-7 w-7', text: 'text-[20px]' },
    lg: { img: 'h-8 w-8', text: 'text-[22px]' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <Link to="/" className="flex items-center gap-2 no-underline">
      <img src="/antareslogo.svg" alt="Antares" className={`${s.img} shrink-0`} />
      <span className={`font-bold text-ink dark:text-snow ${s.text}`}>Antares</span>
    </Link>
  );
}
