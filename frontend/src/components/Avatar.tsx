import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-2xl',
  };

  const baseClasses = `${sizeClasses[size]} rounded-full object-cover flex items-center justify-center`;

  if (!src || imgError) {
    return (
      <div className={`${baseClasses} bg-gray-300 ${className}`}>
        <span className="font-semibold text-gray-600">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setImgError(true)}
      className={`${baseClasses} ${className}`}
    />
  );
}