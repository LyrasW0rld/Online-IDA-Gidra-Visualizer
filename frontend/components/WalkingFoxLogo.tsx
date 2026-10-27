import React from 'react';

export const WalkingFoxLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-6' }) => {
  return (
    <svg
      viewBox="0 0 64 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LCV Walking Fox Silhouette"
    >
      {/* Silhouette of a sleek fox striding right with its front-right paw lifted to step */}
      <path
        d="M4 23 C9 17, 15 17, 21 21 L25 19 C32 18, 39 18, 45 16 L48 8 L51 13 L54 7 L55 14 L62 17 L61 20 L55 21 C53 24, 49 26, 47 28 L53 26 L56 23 L58 25 L54 29 L46 31 L44 39 L41 39 L42 29 C36 29, 30 29, 25 28 L22 39 L19 39 L21 27 L16 36 L13 36 L17 25 C11 26, 6 26, 4 23 Z"
        fill="#FFCC00"
      />
    </svg>
  );
};
