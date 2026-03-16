import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { api } from '../services/api.js';

const TASK_META = {
  fast: {
    label: 'Fast',
    groq: 'llama3-8b-8192',
    openai: 'gpt-3.5-turbo',
    desc: 'Quick classification, summarization, triage',
    color: 'var(--accent-green)',
  },
  analysis: {
    label: 'Analysis',
    groq: 'qwen-qwq-32b',
    openai: 'gpt-4o-mini',
    desc: 'Deep root cause, pattern recognition',
    color: 'var(--accent-cyan)',
  },
  fix: {
    label: 'Fix',
    groq: 'llama3-70b-8192',
    openai: 'gpt-4o',
    desc: 'Code generation, remediation plans',
    color: 'var(--accent-amber)',
  },
};

const EXAMPLE_PROMPTS = {
  fast: 'Quickly summarize: auth-service is getting 500 errors on /login endpoint. Is this critical?',
  analysis: 'Analyze this incident: We see a 10x spike in database connection timeouts in auth-service starting at 14:23 UTC. Error logs show "connection pool exhausted". What is the root cause and what is the blast radius?',
  fix: 'Generate a Python fix for connection pool exhaustion in a FastAPI application using SQLAlchemy. Include proper pool sizing, circuit breaker, and connection health check.',
};

function FlowDiagram({ activeTask, provider, loading }) {
  const meta = activeTask ? TASK_META[activeTask] : null;

  return (
    <div style={{
      padding: 20,
      background: 'var(--bg-deep)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      marginBottom: 20,
    }}>
      <div className="section-title" style={{ marginBottom: 16 }}>Routing Flow</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
        {/* User */}
        <FlowNode label="User Request" active={false} color="var(--text-secondary)" />
        <FlowArrow />
        {/* Task selector */}
        <FlowNode label="Select Model" sub="by task type" active={!!activeTask} color="var(--accent-purple)" />
        <FlowArrow />
        {/* Groq */}
        <FlowNode
          label="Groq"
          sub={meta ? meta.groq : 'Primary'}
          active={provider === 'groq' || (loading && !!activeTask)}
          color="var(--accent-cyan)"
          pulse={loading && !!activeTask}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px' }}>
          <div style={{ fontSize: 9, color: 'var(--accent-green)', letterSpacing: '0.1em' }}>SUCCESS</div>
          <ArrowRight size={12} color="var(--accent-green)" />
          <div style={{ height: 20 }} />
          <div style={{ fontSize: 9, color: 'var(--accent-red)', letterSpacing: '0.1em' }}>FAILURE</div>
          <ArrowRight size={12} color="var(--accent-red)" style={{ transform: 'rotate(20deg)' }} />
        </div>
        {/* Result / OpenAI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FlowNode label="Return Result" sub="success path" active={provider === 'groq'} color="var(--accent-green)" small />
          <FlowNode
            label="OpenAI"
            sub={meta ? meta.openai : 'Fallback'}
            active={provider === 'openai'}
            color="var(--accent-amber)"
            small
          />
        </div>
      </div>
    </div>
  );
}

function FlowNode({ label, sub, active, color, pulse, small }) {
  return (
    <div style={{
      padding: small ? '8px 12px' : '12px 16px',
      background: active ? color + '15' : 'var(--bg-card)',
      border: `1px solid ${active ? color : 'var(--border)'}`,
      borderRadius: 4,
      minWidth: small ? 100 : 120,
      textAlign: 'center',
      transition: 'all 0.3s',
      boxShadow: active ? `0 0 16px ${color}30` : 'none',
      animation: pulse ? 'pulse 1s ease infinite' : 'none',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: active ? color : 'var(--text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FlowArrow() {
  return <ArrowRight size={14} color="var(--text-dim)" style={{ flexShrink: 0, margin: '0 4px' }} />;
}

export default function LLMRouter() {
  const [taskType, setTaskType] = useState('analysis');
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS.analysis);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [modelConfig, setModelConfig] = useState(null);

  useEffect(() => {
    api.modelConfig().then(setModelConfig).catch(() => {});
  }, []);

  const query = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const start = Date.now();
    try {
      const data = await api.queryLLM({ task_type: taskType, prompt });
      const elapsed = Date.now() - start;
      setResult({ ...data, elapsed });
      setHistory(h => [{ taskType, prompt: prompt.slice(0, 60) + '...', provider: data.provider, model: data.model_used, elapsed }, ...h.slice(0, 9)]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>LLM Router</h2>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Groq-first routing with OpenAI fallback · fast → Llama 8B · analysis → Qwen 32B · fix → Llama 70B
          </div>
        </div>

        {/* Flow diagram */}
        <FlowDiagram
          activeTask={loading || result ? taskType : null}
          provider={result?.provider}
          loading={loading}
        />

        {/* Task type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {Object.entries(TASK_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => {
                setTaskType(key);
                setPrompt(EXAMPLE_PROMPTS[key]);
                setResult(null);
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: taskType === key ? meta.color + '15' : 'var(--bg-card)',
                border: `1px solid ${taskType === key ? meta.color : 'var(--border)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: taskType === key ? meta.color : 'var(--text-secondary)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>{meta.label}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>task</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{meta.groq}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>fallback: {meta.openai}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{meta.desc}</div>
            </button>
          ))}
        </div>

        {/* Prompt + query */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 16, alignItems: 'flex-start' }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            style={{ minHeight: 80 }}
          />
          <button
            className="btn btn-primary"
            onClick={query}
            disabled={loading || !prompt.trim()}
            style={{ alignSelf: 'stretch', padding: '0 20px', whiteSpace: 'nowrap' }}
          >
            {loading ? <><div className="spinner" /> Running...</> : <><Zap size={12} /> Send Query</>}
          </button>
        </div>

        {/* Result */}
        {error && (
          <div style={{ padding: 14, background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 4, marginBottom: 16, display: 'flex', gap: 10 }}>
            <AlertCircle size={16} color="var(--accent-red)" />
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 2 }}>LLM Query Failed</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{error}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Add GROQ_API_KEY or OPENAI_API_KEY to backend/.env</div>
            </div>
          </div>
        )}

        {result && (
          <div className="card fade-in" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <CheckCircle size={14} color="var(--accent-green)" />
              <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>Response Received</span>
              <span style={{
                fontSize: 10, padding: '2px 8px',
                background: result.provider === 'groq' ? 'var(--accent-cyan-dim)' : 'var(--accent-amber-dim)',
                color: result.provider === 'groq' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                border: `1px solid ${result.provider === 'groq' ? '#00d4ff40' : '#ffb02040'}`,
                borderRadius: 2, letterSpacing: '0.1em',
              }}>
                {result.provider.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{result.model_used}</span>
              {result.fallback_used && <span style={{ fontSize: 10, color: 'var(--accent-amber)' }}>⚡ Fallback used</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} /> {result.elapsed}ms
              </span>
              {result.tokens_used && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{result.tokens_used} tokens</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
              {result.content}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Query History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
                  fontSize: 11,
                }}>
                  <span className={`badge badge-${h.provider === 'groq' ? 'info' : 'medium'}`}>{h.provider}</span>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>[{h.taskType}]</span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.prompt}</span>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{h.model}</span>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{h.elapsed}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
