import React from 'react';
import { Search, FolderSearch, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = FolderSearch,
  title = 'No records found',
  description = 'Try adjusting your search query or filters to discover matching results.',
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`card-static ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-xl)',
        border: '1px dashed var(--color-border-medium)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-ivory-surface)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-emerald)',
          marginBottom: '1rem',
        }}
      >
        <Icon size={26} />
      </div>

      <h3
        style={{
          fontSize: '1.25rem',
          fontFamily: 'var(--font-serif)',
          color: 'var(--color-deep-forest)',
          margin: '0 0 0.35rem 0',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--color-muted-green)',
          maxWidth: '420px',
          marginBottom: actionText ? '1.25rem' : 0,
        }}
      >
        {description}
      </p>

      {actionText && (
        <Button variant="outline-emerald" size="sm" onClick={onAction} icon={RefreshCw}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
