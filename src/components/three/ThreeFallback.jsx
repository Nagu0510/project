import React from 'react';

export class ThreeFallback extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("Three.js WebGL fallback triggered:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            color: 'var(--color-muted-green)',
            fontSize: '0.85rem',
          }}
        >
          ✦ Visual Preview Mode
        </div>
      );
    }
    return this.props.children;
  }
}
