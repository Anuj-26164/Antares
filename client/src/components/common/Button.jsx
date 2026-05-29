import { motion } from 'framer-motion';

export default function Button({
  variant = 'filled',
  size = 'md',
  pill = false,
  disabled = false,
  onClick,
  children,
  className = '',
}) {
  const sizeClasses = {
    sm: 'px-5 py-2 text-sm',
    md: 'px-7 py-3 text-sm md:text-base',
    lg: 'px-9 py-4 text-sm md:text-base',
  };

  const radiusClass = pill ? 'rounded-[36px]' : 'rounded-[16px]';

  const variantClasses = {
    filled: 'bg-brand text-obsidian font-semibold',
    outline: 'border border-graphite bg-transparent text-snow hover:border-brand/50',
    ghost: 'bg-transparent text-snow',
  };

  const shadowStyle =
    variant === 'filled'
      ? { boxShadow: '0 0 20px rgba(96,165,250,0.3), 0 4px 12px rgba(0,0,0,0.3)' }
      : {};

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.04, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`inline-flex items-center justify-center font-semibold cursor-pointer transition-shadow duration-200 ${radiusClass} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={shadowStyle}
    >
      {children}
    </motion.button>
  );
}
