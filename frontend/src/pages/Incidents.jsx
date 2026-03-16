import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, ChevronRight, Clock, Layers } from 'lucide-react';
import { api } from '../services/api.js';
import { Link } from 'react-router-dom';

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function AnomalyCard({ anomaly, onSelect, selected }) {
  const sev = anomaly.severity;
  const borderColor = sev === 'critical' ? 'var(--accent-red)' : sev === 'high' ? 'var(--accent-amber)' : 'var(--accent-cyan)';

  return (
    <div
      onClick={() => onSelect(anomaly)}
      style={{
        padding: '14px 16px',
        background: selected ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${selected ? borderColor : 'var(--border)'}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 0.15s',
        animation: 'fadeIn 0.3s ease both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span className={`badge badge-${sev}`}>{sev}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          score {(anomaly.score * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
        {anomaly.description}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Layers size={9} /> {anomaly.service}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={9} /> {new Date(anomaly.timestamp).toLocaleTimeString()}
        </span>
        <span>{anomaly.affected_logs.length} logs</span>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedLogs, setRelatedLogs] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getAnomalySummary();
      setSummary(data);
      if (data.anomalies?.length > 0) {
        setSelected(data.anomalies[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedLogs = async (anomaly) => {
    try {
      const data = await api.getLogs({ service: anomaly.service, level: 'ERROR', limit: 10 });
      setRelatedLogs(data.logs || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selected) fetchRelatedLogs(selected);
  }, [selected]);

  const anomalies = (summary?.anomalies || []).sort((a, b) =>
    (SEV_ORDER[a.severity] || 3) - (SEV_ORDER[b.severity] || 3)
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-deep)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
              Incident Panel
            </h2>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {summary?.critical || 0} critical · {summary?.high || 0} high · {summary?.medium || 0} medium
            </div>
          </div>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Summary pills */}
        {summary && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Critical', val: summary.critical, cls: 'badge-critical' },
              { label: 'High', val: summary.high, cls: 'badge-high' },
              { label: 'Medium', val: summary.medium, cls: 'badge-medium' },
            ].map(item => (
              <span key={item.label} className={`badge ${item.cls}`} style={{ padding: '4px 12px', fontSize: 11 }}>
                {item.val} {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', overflow: 'hidden' }}>
        {/* Left: anomaly list */}
        <div style={{
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 100, background: 'var(--bg-card)', borderRadius: 4, border: '1px solid var(--border)' }} />
            ))
          ) : anomalies.map(a => (
            <AnomalyCard key={a.id} anomaly={a} onSelect={setSelected} selected={selected?.id === a.id} />
          ))}
        </div>

        {/* Right: detail */}
        {selected ? (
          <div style={{ padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className={`badge badge-${selected.severity}`}>{selected.severity}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{selected.id}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {selected.description}
                </h3>
              </div>
            </div>

            {/* Metadata grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              {[
                { label: 'Service', value: selected.service },
                { label: 'Type', value: selected.anomaly_type.replace(/_/g, ' ') },
                { label: 'Affected Logs', value: selected.affected_logs.length },
                { label: 'Detection Score', value: `${(selected.score * 100).toFixed(1)}%` },
                { label: 'Detected At', value: new Date(selected.timestamp).toLocaleString() },
                { label: 'Status', value: 'ACTIVE' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '10px 14px', background: 'var(--bg-card)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <Link to="/root-cause" state={{ anomaly: selected }} className="btn btn-primary">
                <AlertTriangle size={12} /> Analyze Root Cause
              </Link>
              <Link to="/fix" state={{ anomaly: selected }} className="btn btn-success">
                <ChevronRight size={12} /> Get Fix Recommendation
              </Link>
              <Link to="/pr" state={{ anomaly: selected }} className="btn">
                Generate PR
              </Link>
            </div>

            {/* Related logs */}
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Related Log Samples</div>
              <div style={{
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                {relatedLogs.slice(0, 8).map((log, i) => (
                  <div key={i} style={{
                    padding: '7px 12px',
                    borderBottom: i < relatedLogs.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '60px 140px 1fr',
                    gap: 8,
                    fontSize: 11,
                  }}>
                    <span style={{ color: log.level === 'ERROR' || log.level === 'CRITICAL' ? 'var(--accent-red)' : 'var(--accent-amber)', fontWeight: 600 }}>
                      {log.level}
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {log.timestamp.slice(11, 23)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            Select an anomaly to view details
          </div>
        )}
      </div>
    </div>
  );
}
