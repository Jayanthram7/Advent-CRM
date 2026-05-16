'use client';
import { RefreshCw, MoreHorizontal } from 'lucide-react';

interface TopBarProps {
  title: string;
  children?: React.ReactNode;
  onRefresh?: () => void;
}

export default function TopBar({ title, children, onRefresh }: TopBarProps) {
  return (
    <div className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn-secondary"
            style={{ padding: '6px 10px', minWidth: 'unset' }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
