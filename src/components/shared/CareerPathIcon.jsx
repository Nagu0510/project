import React from 'react';

export const CareerPathIcon = ({ type, size = 52, className = '' }) => {
  const normalized = (type || '').toLowerCase();

  const forest = '#12372A';
  const emerald = '#1F6B50';
  const lime = '#B7E44A';
  const ivory = '#F4F0E7';

  // 1. Java Developer
  if (normalized.includes('java') && !normalized.includes('script')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M26 18C28 20 28 22 26 24" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M32 15C35 18 35 21 32 24" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 18C40 20 40 22 38 24" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M20 28H44V38C44 42.4183 40.4183 46 36 46H28C23.5817 46 20 42.4183 20 38V28Z" fill={emerald} stroke={ivory} strokeWidth="2" />
        <path d="M44 31H47C49.2091 31 51 32.7909 51 35C51 37.2091 49.2091 39 47 39H44" stroke={lime} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M18 49H46" stroke={lime} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // 2. Frontend Developer
  if (normalized.includes('front')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <rect x="14" y="16" width="36" height="32" rx="6" fill={emerald} stroke={ivory} strokeWidth="2" />
        <circle cx="20" cy="22" r="1.75" fill={lime} />
        <circle cx="25" cy="22" r="1.75" fill={ivory} opacity="0.7" />
        <circle cx="30" cy="22" r="1.75" fill={ivory} opacity="0.4" />
        <line x1="14" y1="26" x2="50" y2="26" stroke={ivory} strokeWidth="1.5" opacity="0.3" />
        <path d="M24 33L20 37L24 41" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 33L44 37L40 41" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 32L30 42" stroke={ivory} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      </svg>
    );
  }

  // 3. Backend Developer
  if (normalized.includes('back')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <rect x="15" y="15" width="34" height="10" rx="3" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="21" cy="20" r="1.5" fill={lime} />
        <circle cx="26" cy="20" r="1.5" fill={lime} />
        <line x1="34" y1="20" x2="43" y2="20" stroke={ivory} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <rect x="15" y="27" width="34" height="10" rx="3" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="21" cy="32" r="1.5" fill={lime} />
        <circle cx="26" cy="32" r="1.5" fill={lime} />
        <line x1="34" y1="32" x2="43" y2="32" stroke={ivory} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <rect x="15" y="39" width="34" height="10" rx="3" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="21" cy="44" r="1.5" fill={lime} />
        <circle cx="26" cy="44" r="1.5" fill={lime} />
        <line x1="34" y1="44" x2="43" y2="44" stroke={ivory} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </svg>
    );
  }

  // 4. Full Stack Developer
  if (normalized.includes('full') || normalized.includes('stack')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M32 14L49 22L32 30L15 22L32 14Z" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <path d="M15 28L32 36L49 28" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 35L32 43L49 35" stroke={ivory} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 42L32 50L49 42" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // 5. Python Developer
  if (normalized.includes('python')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M31.5 15C22.5 15 22 19 22 23V27H32V28.5H18C14 28.5 14 34.5 14 34.5V40C14 44.5 19 44.5 19 44.5H23V40.5C23 36 27.5 36 27.5 36H36.5C41 36 41 31.5 41 31.5V23C41 18.5 36.5 15 31.5 15Z" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="26" cy="19" r="1.5" fill={lime} />
        <path d="M32.5 49C41.5 49 42 45 42 41V37H32V35.5H46C50 35.5 50 29.5 50 29.5V24C50 19.5 45 19.5 45 19.5H41V23.5C41 28 36.5 28 36.5 28H27.5C23 28 23 32.5 23 32.5V41C23 45.5 27.5 49 32.5 49Z" fill={lime} opacity="0.9" />
        <circle cx="38" cy="45" r="1.5" fill={forest} />
      </svg>
    );
  }

  // 6. Data Analyst
  if (normalized.includes('analyst') || normalized.includes('analytic')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M32 16C40.8366 16 48 23.1634 48 32C48 40.8366 40.8366 48 32 48C23.1634 48 16 40.8366 16 32C16 23.1634 23.1634 16 32 16Z" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <path d="M32 16V32H48C48 23.1634 40.8366 16 32 16Z" fill={lime} />
        <circle cx="32" cy="32" r="8" fill={forest} />
        <path d="M40 20L48 14M48 14V20M48 14H42" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // 7. Data Scientist
  if (normalized.includes('scientist') || (normalized.includes('data') && !normalized.includes('analyst'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <circle cx="32" cy="20" r="5" fill={lime} />
        <circle cx="18" cy="40" r="5" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="46" cy="40" r="5" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="32" cy="48" r="4" fill={lime} opacity="0.8" />
        <line x1="32" y1="20" x2="18" y2="40" stroke={lime} strokeWidth="2" strokeDasharray="3 3" />
        <line x1="32" y1="20" x2="46" y2="40" stroke={lime} strokeWidth="2" strokeDasharray="3 3" />
        <line x1="18" y1="40" x2="46" y2="40" stroke={ivory} strokeWidth="1.5" />
        <line x1="18" y1="40" x2="32" y2="48" stroke={ivory} strokeWidth="1.5" />
        <line x1="46" y1="40" x2="32" y2="48" stroke={ivory} strokeWidth="1.5" />
      </svg>
    );
  }

  // 8. AI / ML Engineer
  if (normalized.includes('ai') || normalized.includes('machine') || normalized.includes('intelligence')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M32 16C23.1634 16 18 22 18 30C18 35 21 39 25 42L27 48H37L39 42C43 39 46 36 46 30C46 22 40.8366 16 32 16Z" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <circle cx="32" cy="26" r="3" fill={lime} />
        <circle cx="26" cy="33" r="2.5" fill={ivory} />
        <circle cx="38" cy="33" r="2.5" fill={ivory} />
        <circle cx="32" cy="40" r="2.5" fill={lime} />
        <line x1="32" y1="26" x2="26" y2="33" stroke={lime} strokeWidth="1.5" />
        <line x1="32" y1="26" x2="38" y2="33" stroke={lime} strokeWidth="1.5" />
        <line x1="26" y1="33" x2="32" y2="40" stroke={ivory} strokeWidth="1.5" />
        <line x1="38" y1="33" x2="32" y2="40" stroke={ivory} strokeWidth="1.5" />
        <line x1="27" y1="51" x2="37" y2="51" stroke={lime} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 9. Cloud / DevOps Engineer
  if (normalized.includes('cloud') || normalized.includes('devops')) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill={forest} />
        <path d="M22 42H44C47.3137 42 50 39.3137 50 36C50 32.9622 47.7412 30.452 44.7891 30.0762C44.2541 24.3644 39.4674 20 33.6667 20C28.8477 20 24.7346 23.0305 23.084 27.3569C20.2173 27.9734 18 30.5054 18 33.5C18 38.1944 21.8056 42 22 42Z" fill={emerald} stroke={ivory} strokeWidth="1.5" />
        <path d="M26 34C24 34 22 36 22 38C22 40 24 42 26 42C29 42 32 38 32 38C32 38 35 42 38 42C40 42 42 40 42 38C42 36 40 34 38 34C35 34 32 38 32 38C32 38 29 34 26 34Z" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill={forest} />
      <path d="M32 16L46 24V40L32 48L18 40V24L32 16Z" stroke={lime} strokeWidth="2" fill={emerald} />
      <circle cx="32" cy="32" r="4" fill={lime} />
    </svg>
  );
};

export default CareerPathIcon;
