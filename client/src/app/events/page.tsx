'use client';
import ProtectedLayout from '@/components/ProtectedLayout';
import TopBar from '@/components/TopBar';
import { Calendar } from 'lucide-react';

export default function EventsPlaceholderPage() {
  return (
    <ProtectedLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
        <TopBar title="Events" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 32 }}>
          <div style={{ width: 64, height: 64, background: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', marginBottom: 20 }}>
            <Calendar size={32} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>No Event Selected</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, textAlign: 'center', maxWidth: 380 }}>
            Please select an event from the sidebar list, or click <strong>Import Event</strong> to upload a new Excel sheet.
          </p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
