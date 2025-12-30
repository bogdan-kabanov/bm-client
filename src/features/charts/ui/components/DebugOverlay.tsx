import React from 'react';

interface DebugOverlayProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ logs, isOpen, onClose, onToggle }) => {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: isOpen ? 24 : 16,
          bottom: isOpen ? 24 : 16,
          width: isOpen ? 48 : 36,
          height: isOpen ? 48 : 36,
          backgroundColor: '#00ff7f',
          border: 'none',
          borderRadius: isOpen ? 12 : 8,
          boxShadow: '0 0 12px rgba(0, 255, 127, 0.6)',
          cursor: 'pointer',
          zIndex: 10000,
          transition: 'all 0.2s ease',
        }}
        aria-label="Toggle debug logs"
      >
        {isOpen ? '×' : 'LOG'}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 32, 0, 0.98)',
            color: '#00ff7f',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#7CFFB2' }}>Chart Debug Logs</h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid rgba(124, 255, 178, 0.6)',
                color: '#7CFFB2',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid rgba(124, 255, 178, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Логи пока отсутствуют...</div>
            ) : (
              logs.map((log, index) => (
                <div key={`${log}_${index}`} style={{ marginBottom: '6px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

