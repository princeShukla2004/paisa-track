import React from 'react';

interface ProfileAvatarProps {
  name?: string;
  photoURL?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ProfileAvatarProps['size']>, string> = {
  sm: 'w-7 h-7 text-[11px] shadow-[0_0_12px_rgba(124,58,237,0.42)]',
  md: 'w-9 h-9 text-xs shadow-[0_0_14px_rgba(124,58,237,0.42)]',
  lg: 'w-16 h-16 text-lg shadow-[0_0_20px_rgba(124,58,237,0.45)]',
};

export function getProfileInitials(name?: string): string {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function ProfileAvatar({
  name = 'Prince Kumar',
  photoURL,
  size = 'sm',
  className = '',
}: ProfileAvatarProps) {
  const initials = getProfileInitials(name);
  const sizeClass = SIZE_CLASSES[size];

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border border-violet-300/35 shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`${sizeClass} rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-blue-600 border border-violet-300/35 ring-1 ring-white/15 font-display font-bold tracking-tight text-white flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {initials}
    </span>
  );
}
