import React, { useState } from 'react';
import { Film } from 'lucide-react';

interface PosterFrameProps {
  src?: string | null;
  title: string;
  className?: string;
}

export const PosterFrame: React.FC<PosterFrameProps> = ({ src, title, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-3 text-center select-none ${className}`}
        aria-label={title}
      >
        <Film className="w-6 h-6 text-slate-400 mb-1.5" strokeWidth={1.6} />
        <span className="text-[11px] font-medium leading-tight line-clamp-2 text-slate-300">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-slate-900 ${className}`}
    />
  );
};
