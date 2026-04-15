'use client'

interface VerificationBadgeProps {
  status?: 'verifying' | 'confirmed' | 'flagged' | null;
  size?: 'sm' | 'md';
}

export default function VerificationBadge({ status, size = 'md' }: VerificationBadgeProps) {
  if (!status) return null;

  const isConfirmed = status === 'confirmed';
  const isFlagged = status === 'flagged';
  const isVerifying = status === 'verifying';

  const baseStyles = "inline-flex items-center gap-1.5 font-black uppercase tracking-widest border transition-all duration-500 ease-in-out";
  
  const sizeStyles = size === 'sm' 
    ? "px-1.5 py-0.5 text-[7px] rounded-md" 
    : "px-2 py-1 text-[9px] rounded-lg";

  const colorStyles = isConfirmed 
    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
    : isFlagged 
      ? "bg-red-50 text-red-700 border-red-200" 
      : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse ring-2 ring-amber-400/20";

  const iconSize = size === 'sm' ? "text-[10px]" : "text-[14px]";

  return (
    <span className={`${baseStyles} ${sizeStyles} ${colorStyles}`}>
      <span className={`material-symbols-outlined ${iconSize}`} style={{ fontVariationSettings: "'FILL' 1" }}>
        {isConfirmed ? 'verified' : isFlagged ? 'report' : 'pending'}
      </span>
      {isConfirmed ? 'Verified' : isFlagged ? 'Flagged' : 'Verifying'}
    </span>
  );
}
