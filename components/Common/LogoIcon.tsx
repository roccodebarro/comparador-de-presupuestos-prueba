import React from 'react';

const LogoIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="12.5" cy="12.5" r="10" fill="#9D4291" />
        <circle cx="37.5" cy="12.5" r="10" fill="#88888B" />
        <circle cx="62.5" cy="12.5" r="10" fill="#88888B" />
        <circle cx="87.5" cy="12.5" r="10" fill="#88888B" />
        <circle cx="12.5" cy="37.5" r="10" fill="#88888B" />
        <circle cx="37.5" cy="37.5" r="10" fill="#88888B" />
        <circle cx="62.5" cy="37.5" r="10" fill="#88888B" />
        <circle cx="12.5" cy="62.5" r="10" fill="#88888B" />
        <circle cx="37.5" cy="62.5" r="10" fill="#88888B" />
        <circle cx="37.5" cy="87.5" r="10" fill="#88888B" />
    </svg>
);

export default LogoIcon;
