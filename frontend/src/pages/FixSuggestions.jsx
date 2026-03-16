import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench, AlertCircle, CheckCircle, Copy, Check, Code2 } from 'lucide-react';
import { api } from '../services/api.js';

function CodeBlock({ code, language = 'python' }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlight
  const highlighted = code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(#[^\n]*)/g, '<span style="color:#5c7a5c">$1</span>')
    .replace(/\b(def|class|import|from|return|if|else|elif|for|while|try|except|with|as|and|or|not|in|is|None|True|False|async|await|raise)\b/g, '<span style="color:#c792ea">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')/g, '<span style="color:#c3e88d">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#f78c6c">$1</span>');

  return (
    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <Code2 size={10} style={{ display: 'inline', marginRight: 6 }} />{language}
        </span>
        <button className="btn" style={{ padding: '3px 8px', fontSize: 10 }} onClick={copy}>
          {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
        </button>
      </div>
      <pre style={{
        padding: '14px 16px',
        background: '#0a0c10',
        margin: 0,
        overflowX: 'auto',
        fontSize: 12,
        lineHeight: 1.7,
        color: '#abb2bf',
      }}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function MarkdownBlock({ content }) {
  const lines = (content || '').split('\n');
  return (
    <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, margin: '16px 0 8px' }}>{line.slice(2)}</h2>;
        if (line.startsWith('```')) return null;
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
            <span style={{ color: 'var(--accent-green)', flexShrink: 0 }}>✓</span>
            <span>{line.slice(2)}</span>
          </div>
        );
        if (line.match(/^\d+\./)) return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, paddingLeft: 8 }}>
            <span style={{
              background: 'var(--accent-cyan-dim)',
              color: 'var(--accent-cyan)',
              border: '1px solid #00d4ff40',
              borderRadius: 2,
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 700,
            }}>
              {line.match(/^\d+/)[0]}
            </span>
            <span>{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
        if (line === '') return <div key={i} style={{ height: 8 }} />;
        const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>');
        return <p key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
}

export default function FixSuggestions() {
  const location = useLocation();
  const preloadedAnomaly = location.state?.anomaly;

  const [anomalies, setAnomalies] = useState([]);
  const [selected, setSelected] = useState(preloadedAnomaly || null);
  const [service, setService] = useState(preloadedAnomaly?.service || '');
  const [language, setLanguage] = useState('python');
  const [rootCause, setRootCause] = useState('Connection pool exhaustion detected. High number of concurrent DB connections causing timeouts across dependent services.');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [codeMatch, setCodeMatch] = useState(null);

  useEffect(() => {
    api.getAnomalies(8).then(d => {
      setAnomalies(d.anomalies || []);
      if (!selected && d.anomalies?.length > 0) {
        setSelected(d.anomalies[0]);
        setService(d.anomalies[0].service);
      }
    });
  }, []);

  const generate = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCodeMatch(null);
    try {
      const data = await api.generateFix({
        anomaly: selected,
        root_cause: rootCause,
        service: service || selected.service,
        language,
      });
      setResult(data);
      // Extract code block
      const m = data.code_fix?.match(/```(?:\w+)?\n([\s\S]+?)```/);
      if (m) setCodeMatch(m[1].trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-deep)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Fix Suggestions</h2>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>AI-generated fixes using Llama 70B via Groq (fix task)</div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Anomaly</div>
            <select
              value={selected?.id || ''}
              onChange={e => {
                const a = anomalies.find(x => x.id === e.target.value);
                setSelected(a);
                if (a) setService(a.service);
                setResult(null);
              }}
            >
              {anomalies.map(a => (
                <option key={a.id} value={a.id}>{a.service} — {a.anomaly_type}</option>
              ))}
            </select>
          </div>

          {selected && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent-amber)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              {selected.description}
            </div>
          )}

          <div className="form-group">
            <label>Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="go">Go</option>
              <option value="java">Java</option>
            </select>
          </div>

          <div className="form-group">
            <label>Root Cause Context</label>
            <textarea
              value={rootCause}
              onChange={e => setRootCause(e.target.value)}
              style={{ minHeight: 80 }}
              placeholder="Describe the root cause..."
            />
          </div>

          <button
            className="btn btn-success"
            onClick={generate}
            disabled={loading || !selected}
            style={{ justifyContent: 'center' }}
          >
            {loading ? <><div className="spinner" /> Generating...</> : <><Wrench size={12} /> Generate Fix</>}
          </button>
        </div>

        {/* Right panel */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {!result && !loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-dim)' }}>
              <Wrench size={40} strokeWidth={1} />
              <div style={{ fontSize: 13 }}>Configure and generate a fix recommendation</div>
              <div style={{ fontSize: 11 }}>Uses Llama 70B (Groq) → GPT-4o (OpenAI fallback)</div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ width: 48, height: 48, border: '2px solid var(--border)', borderTop: '2px solid var(--accent-green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Generating fix with Llama 70B...</div>
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 4, display: 'flex', gap: 10 }}>
              <AlertCircle size={16} color="var(--accent-red)" />
              <div>
                <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>Generation Failed</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{error}</div>
              </div>
            </div>
          )}

          {result && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <CheckCircle size={16} color="var(--accent-green)" />
                <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>Fix Generated</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px',
                  background: result.priority === 'CRITICAL' ? 'var(--accent-red-dim)' : 'var(--accent-amber-dim)',
                  color: result.priority === 'CRITICAL' ? 'var(--accent-red)' : 'var(--accent-amber)',
                  border: `1px solid ${result.priority === 'CRITICAL' ? '#ff3b5c40' : '#ffb02040'}`,
                  borderRadius: 2, letterSpacing: '0.1em',
                }}>
                  {result.priority} Priority
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{result.model_used}</span>
              </div>

              {/* Steps */}
              {result.steps?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Remediation Steps</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.steps.map((step, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 10, padding: '8px 12px',
                        background: 'var(--bg-deep)', border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--accent-green)', borderRadius: 4,
                        fontSize: 12, color: 'var(--text-secondary)', alignItems: 'flex-start',
                      }}>
                        <span style={{
                          background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
                          border: '1px solid #00ff8840', borderRadius: 2,
                          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, fontSize: 10, fontWeight: 700,
                        }}>{i + 1}</span>
                        {step.replace(/^\d+\.\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Code fix */}
              {codeMatch && (
                <div style={{ marginBottom: 20 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Code Fix</div>
                  <CodeBlock code={codeMatch} language={language} />
                </div>
              )}

              {/* Full recommendation */}
              <div>
                <div className="section-title" style={{ marginBottom: 10 }}>Full Recommendation</div>
                <div style={{ padding: 16, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 4 }}>
                  <MarkdownBlock content={result.code_fix} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
