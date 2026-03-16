import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Brain, Zap, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api.js';

const MODEL_BADGE = {
  groq: { label: 'Groq', color: 'var(--accent-cyan)' },
  openai: { label: 'OpenAI', color: 'var(--accent-green)' },
  mock: { label: 'Mock', color: 'var(--text-secondary)' },
};

function MarkdownBlock({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginTop: 16, marginBottom: 8 }}>{line.slice(2)}</h2>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{line.slice(2, -2)}</p>;
        if (line.match(/^\*\*(.+?)\*\*/)) {
          const replaced = line.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong style="color:var(--text-primary)">${m}</strong>`);
          return <p key={i} dangerouslySetInnerHTML={{ __html: replaced }} style={{ marginBottom: 4 }} />;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
            <span style={{ color: 'var(--accent-cyan)', flexShrink: 0 }}>›</span>
            <span>{line.slice(2)}</span>
          </div>
        );
        if (line.match(/^\d+\./)) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
            <span style={{ color: 'var(--accent-amber)', flexShrink: 0, minWidth: 16 }}>{line.match(/^\d+/)[0]}.</span>
            <span>{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
        if (line === '') return <div key={i} style={{ height: 8 }} />;
        return <p key={i} style={{ marginBottom: 4 }}>{line}</p>;
      })}
    </div>
  );
}

export default function RootCauseViewer() {
  const location = useLocation();
  const preloadedAnomaly = location.state?.anomaly;

  const [anomalies, setAnomalies] = useState([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState(preloadedAnomaly || null);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    api.getAnomalies(8).then(d => {
      setAnomalies(d.anomalies || []);
      if (!selectedAnomaly && d.anomalies?.length > 0) setSelectedAnomaly(d.anomalies[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAnomaly) {
      api.getLogs({ service: selectedAnomaly.service, level: 'ERROR', limit: 20 })
        .then(d => setLogs(d.logs || []))
        .catch(() => {});
    }
  }, [selectedAnomaly]);

  const analyze = async () => {
    if (!selectedAnomaly) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const logEntries = logs.map(l => ({
        timestamp: l.timestamp,
        level: l.level,
        service: l.service,
        message: l.message,
        trace_id: l.trace_id,
        span_id: l.span_id,
        metadata: l.metadata,
      }));
      const data = await api.analyzeRootCause({
        anomaly_id: selectedAnomaly.id,
        logs: logEntries,
        anomaly: selectedAnomaly,
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const mb = result ? MODEL_BADGE[result.provider] : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-deep)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Root Cause Analyzer</h2>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          AI-powered analysis using Qwen 32B via Groq (analysis task)
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>
        {/* Left: anomaly selector */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Select Anomaly</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {anomalies.map(a => (
              <div
                key={a.id}
                onClick={() => { setSelectedAnomaly(a); setResult(null); }}
                style={{
                  padding: '10px 12px',
                  background: selectedAnomaly?.id === a.id ? 'var(--bg-hover)' : 'var(--bg-card)',
                  border: `1px solid ${selectedAnomaly?.id === a.id ? 'var(--accent-cyan)' : 'var(--border)'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>
                  {a.description.slice(0, 80)}...
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.service}</div>
              </div>
            ))}
          </div>

          {selectedAnomaly && (
            <button
              className="btn btn-primary"
              onClick={analyze}
              disabled={loading}
              style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
            >
              {loading ? <><div className="spinner" /> Analyzing...</> : <><Brain size={12} /> Analyze Root Cause</>}
            </button>
          )}
        </div>

        {/* Right: result */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {!result && !loading && !error && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: 'var(--text-dim)',
            }}>
              <Brain size={40} strokeWidth={1} />
              <div style={{ fontSize: 13 }}>Select an anomaly and click Analyze Root Cause</div>
              <div style={{ fontSize: 11 }}>Uses Qwen 32B (Groq) → GPT-4o-mini (OpenAI fallback)</div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 48, height: 48, border: '2px solid var(--border)', borderTop: '2px solid var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <Brain size={16} color="var(--accent-cyan)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Running AI analysis with Qwen 32B...</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Analyzing {logs.length} log entries</div>
            </div>
          )}

          {error && (
            <div style={{
              padding: 16,
              background: 'var(--accent-red-dim)',
              border: '1px solid var(--accent-red)',
              borderRadius: 4,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <AlertCircle size={16} color="var(--accent-red)" flexShrink={0} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>Analysis Failed</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{error}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                  Make sure your GROQ_API_KEY or OPENAI_API_KEY is set in backend/.env
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="fade-in">
              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <CheckCircle size={16} color="var(--accent-green)" />
                <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>Analysis Complete</span>
                {mb && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    background: mb.color + '18',
                    color: mb.color,
                    border: `1px solid ${mb.color}40`,
                    borderRadius: 2,
                    letterSpacing: '0.1em',
                  }}>
                    {mb.label} · {result.model_used}
                  </span>
                )}
                {result.fallback_used && (
                  <span style={{ fontSize: 10, color: 'var(--accent-amber)' }}>⚡ Fallback used</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                  Confidence: {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Contributing factors */}
              {result.contributing_factors?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Contributing Factors</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.contributing_factors.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--accent-amber)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}>
                        <span style={{ color: 'var(--accent-amber)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full analysis */}
              <div>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 10 }}
                  onClick={() => setShowRaw(!showRaw)}
                >
                  <div className="section-title">Full Analysis</div>
                  {showRaw ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
                </div>
                <div style={{
                  padding: 16,
                  background: 'var(--bg-deep)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  maxHeight: showRaw ? 'none' : 400,
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <MarkdownBlock content={result.root_cause} />
                  {!showRaw && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 60,
                      background: 'linear-gradient(transparent, var(--bg-deep))',
                    }} />
                  )}
                </div>
                {!showRaw && (
                  <button className="btn" style={{ marginTop: 8, fontSize: 11 }} onClick={() => setShowRaw(true)}>
                    Show full analysis
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
