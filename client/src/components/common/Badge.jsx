export default function Badge({ label, variant = 'default', className = '' }) {
  const variantClasses = {
    default: 'bg-fog text-ink dark:bg-graphite dark:text-mist',
    ember: 'bg-ember text-snow',
  };

  return (
    <span
      className={`inline-flex items-center rounded-[12px] px-3 py-1 text-[10px] font-medium ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
