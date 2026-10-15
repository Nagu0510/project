import React, { useState } from 'react';

/** Google profile picture when there is one, otherwise the user's initial. */
export const Avatar = ({ user, size = 32, background = 'var(--color-forest)', color = 'var(--color-lime)' }) => {
  const [broken, setBroken] = useState(false);
  const label = user?.name || user?.email || '?';
  const box = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background,
    color,
    fontWeight: 700,
    fontSize: `${Math.round(size * 0.4)}px`,
  };
  if (user?.picture && !broken) {
    return (
      <span style={box}>
        <img
          src={user.picture}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }
  return <span style={box} aria-hidden="true">{label.charAt(0).toUpperCase()}</span>;
};

export default Avatar;
