import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Filter, Download, Circle } from 'lucide-react';
import { api } from '../services/api.js';

const SERVICES = ['', 'auth-service', 'api-gateway', 'user-service', 'payment-service', 'notification-service', 'order-service', 'inventory-service', 'search-service'];
const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

const LEVEL_COLORS = {
  DEBUG: 'var(--accent-purple)',
  INFO: 'var(--accent-cyan)',
  WARNING: 'var(--accent-amber)',
  ERROR: 'var(--accent-red)',
  CRITICAL: '#ff0040',
};

function LogRow({ log, idx }) {
  const [expanded, setExpanded] = useState(false);
  const color = LEVEL_COLORS[log.level] || 'var(--text-secondary)';
  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        animation: `fadeIn 0.2s ease ${(idx % 20) * 0.02}s both`,
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 70px 150px 1fr',
        gap: 8,
        padding: '6px 12px',
        fontSize: 11,
        alignItems: 'center',
        background: expanded ? 'var(--bg-card)' : 'transparent',
        transition: 'background 0.1s',
      }}
        onMouseEnter={e => !expanded && (e.currentTarget.style.background = 'var(--bg-deep)')}
        onMouseLeave={e => !expanded && (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {log.timestamp.replace('T', ' ').slice(0, 23)}
        </span>
        <span style={{ color, fontWeight: 600 }}>{log.level}</span>
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.service}
        </span>
        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.message}
        </span>
      </div>
      {expanded && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-deep)',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>TRACE ID</div>
              <code style={{ fontSize: 11 }}>{log.trace_id}</code>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>SPAN ID</div>
              <code style={{ fontSize: 11 }}>{log.span_id}</code>
            </div>
            {log.metadata && Object.entries(log.metadata).map(([k, v]) => (
              <div key={k}>
                <div style={{ color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', fontSize: 10 }}>{k}</div>
                <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LogExplorer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [filters, setFilters] = useState({ service: '', level: '', search: '', limit: 100 });
  const streamRef = useRef(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs({
        service: filters.service || undefined,
        level: filters.level || undefined,
        search: filters.search || undefined,
        limit: filters.limit,
      });
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStream = () => {
    if (streaming) {
      clearInterval(streamRef.current);
      setStreaming(false);
    } else {
      setStreaming(true);
      streamRef.current = setInterval(async () => {
        try {
          const data = await api.streamLogs(filters.service || undefined);
          setLogs(prev => [...data.logs, ...prev].slice(0, 500));
        } catch (e) {}
      }, 2000);
    }
  };

  useEffect(() => {
    fetchLogs();
    return () => clearInterval(streamRef.current);
  }, []);

  const errorCount = logs.filter(l => l.level === 'ERROR' || l.level === 'CRITICAL').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>Log Explorer</h2>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {logs.length.toLocaleString()} entries · {errorCount} errors
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${streaming ? 'btn-danger' : 'btn-success'}`} onClick={toggleStream}>
              <Circle size={8} fill={streaming ? 'currentColor' : 'none'} />
              {streaming ? 'Stop Stream' : 'Live Stream'}
            </button>
            <button className="btn btn-primary" onClick={fetchLogs} disabled={loading}>
              <RefreshCw size={12} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search log messages..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              style={{ paddingLeft: 30 }}
            />
          </div>
          <select
            value={filters.service}
            onChange={e => setFilters(f => ({ ...f, service: e.target.value }))}
            style={{ width: 160 }}
          >
            {SERVICES.map(s => <option key={s} value={s}>{s || 'All services'}</option>)}
          </select>
          <select
            value={filters.level}
            onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}
            style={{ width: 120 }}
          >
            {LEVELS.map(l => <option key={l} value={l}>{l || 'All levels'}</option>)}
          </select>
          <button className="btn" onClick={fetchLogs}>
            <Filter size={12} /> Apply
          </button>
        </div>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 70px 150px 1fr',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--text-dim)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 600,
        flexShrink: 0,
      }}>
        <span>Timestamp</span>
        <span>Level</span>
        <span>Service</span>
        <span>Message</span>
      </div>

      {/* Log rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>No logs found</div>
        ) : (
          logs.map((log, idx) => <LogRow key={`${log.trace_id}-${idx}`} log={log} idx={idx} />)
        )}
      </div>

      {/* Footer */}
      {streaming && (
        <div style={{
          padding: '6px 16px',
          background: 'var(--accent-green-dim)',
          borderTop: '1px solid #00ff8840',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--accent-green)',
        }}>
          <div className="pulse-dot" />
          Live streaming active · updating every 2s
        </div>
      )}
    </div>
  );
}
