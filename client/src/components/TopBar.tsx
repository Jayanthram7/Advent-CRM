'use client';
import { usePathname } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface TopBarProps {
  title: string;
  children?: React.ReactNode;
  onRefresh?: () => void;
}

const getParentSection = (pathname: string) => {
  if (pathname.startsWith('/home')) return 'Dashboard';
  if (pathname.startsWith('/leads')) return 'Sales';
  if (pathname.startsWith('/calls')) return 'Sales';
  if (pathname.startsWith('/events')) return 'Sales';
  if (pathname.startsWith('/today')) return 'Sales';
  if (pathname.startsWith('/tss')) return 'Operations';
  if (pathname.startsWith('/whatsapp')) return 'Operations';
  if (pathname.startsWith('/tasks')) return 'Work';
  if (pathname.startsWith('/calendar')) return 'Admin';
  if (pathname.startsWith('/users')) return 'Admin';
  if (pathname.startsWith('/customers')) return 'Admin';
  if (pathname.startsWith('/quiz-users')) return 'Admin';
  if (pathname.startsWith('/send-emails')) return 'Admin';
  if (pathname.startsWith('/team-chat')) return 'Messages';
  return '';
};

export default function TopBar({ title, children, onRefresh }: TopBarProps) {
  const pathname = usePathname();
  const parent = getParentSection(pathname);

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 500, color: '#94a3b8' }}>
        {parent ? (
          <>
            <span>{parent}</span>
            <span style={{ color: '#94a3b8', margin: '0 2px' }}>/</span>
            <strong style={{ color: '#0f172a', fontWeight: 600 }}>{title}</strong>
          </>
        ) : (
          <strong style={{ color: '#0f172a', fontWeight: 600 }}>{title}</strong>
        )}
      </div>
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
