import React, { useState, useEffect } from 'react';
import { GitPullRequest, GitBranch, Copy, Check, ExternalLink, Sparkles, ChevronDown, ChevronUp, FileCode } from 'lucide-react';
import { api } from '../services/api.js';

function CodeDiff({ patch }) {
  if (!patch) return null;
  return (
    <div style={{ background: '#060810', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 10 }}>
        <span style={{ color: 'var(--accent-red)' }}>- removed</span>
        <span style={{ color: 'var(--accent-green)' }}>+ added</span>
        <span style={{ color: 'var(--text-dim)' }}>context</span>
      </div>
      <pre style={{ padding: '12px 16px', margin: 0, overflowX: 'auto', fontSize: 11, lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
        {patch.split('\n').map((line, i) => {
          let color = 'var(--text-dim)';
          let bg = 'transparent';
          if (line.startsWith('+') && !line.startsWith('+++')) { color = 'var(--accent-green)'; bg = '#00ff8810'; }
          if (line.startsWith('-') && !line.startsWith('---')) { color = 'var(--accent-red)'; bg = '#ff3b5c10'; }
          if (line.startsWith('@@')) { color = 'var(--accent-cyan)'; bg = '#00d4ff08'; }
          if (line.startsWith('---') || line.startsWith('+++')) { color = 'var(--text-secondary)'; }
          return (
            <span key={i} style={{ display: 'block', color, background: bg, padding: '0 4px', margin: '0 -4px' }}>
              {line || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

function CopyButton({ text, style }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn"
      style={{ padding: '3px 10px', fontSize: 10, ...style }}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
    </button>
  );
}

export default function PRGenerator() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState({
    repo_url: 'https://github.com/your-org/your-repo',
    branch_name: 'fix/logai-auto-fix',
    title: '',
    description: '',
    file_path: '',
    original_code: '',
    fix_description: '',
    language: 'python',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('diff');
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    api.getPRTemplates().then(d => {
      setTemplates(d.templates || []);
    }).catch(() => {});
  }, []);

  const applyTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    setForm(f => ({
      ...f,
      file_path: `src/${tpl.language === 'python' ? 'services' : 'lib'}/${tpl.id.replace(/_/g, '-')}.${tpl.language === 'python' ? 'py' : 'ts'}`,
      original_code: tpl.original_code,
      fix_description: tpl.description,
      title: `fix: ${tpl.name}`,
      description: tpl.description,
      branch_name: `fix/logai-${tpl.id.replace(/_/g, '-')}`,
      language: tpl.language,
    }));
    setResult(null);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.generatePR(form);
      setResult(data);
      setActiveTab('diff');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-deep)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>PR Generator</h2>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          AI-powered pull request generation · Llama 70B generates the fix · real diff preview
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', overflow: 'hidden' }}>
        {/* Left: form */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16 }}>
          {/* Templates */}
          <div style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Quick Templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    padding: '8px 12px',
                    background: selectedTemplate === tpl.id ? 'var(--accent-cyan-dim)' : 'var(--bg-card)',
                    border: `1px solid ${selectedTemplate === tpl.id ? 'var(--accent-cyan)' : 'var(--border)'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, color: selectedTemplate === tpl.id ? 'var(--accent-cyan)' : 'var(--text-primary)', fontWeight: 500, marginBottom: 2 }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>PR Configuration</div>

            <div className="form-group">
              <label>Repository URL</label>
              <input type="url" value={form.repo_url} onChange={e => update('repo_url', e.target.value)} placeholder="https://github.com/org/repo" />
            </div>

            <div className="form-group">
              <label>Branch Name</label>
              <input type="text" value={form.branch_name} onChange={e => update('branch_name', e.target.value)} placeholder="fix/description" />
            </div>

            <div className="form-group">
              <label>PR Title</label>
              <input type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="fix: description" />
            </div>

            <div className="form-group">
              <label>File Path</label>
              <input type="text" value={form.file_path} onChange={e => update('file_path', e.target.value)} placeholder="src/services/db.py" />
            </div>

            <div className="form-group">
              <label>Language</label>
              <select value={form.language} onChange={e => update('language', e.target.value)}>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="go">Go</option>
                <option value="java">Java</option>
              </select>
            </div>

            <div className="form-group">
              <label>Fix Description</label>
              <textarea value={form.fix_description} onChange={e => update('fix_description', e.target.value)} placeholder="Describe what needs to be fixed..." style={{ minHeight: 70 }} />
            </div>

            <div className="form-group">
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 6 }}
                onClick={() => setShowOriginal(!showOriginal)}
              >
                <label style={{ margin: 0, cursor: 'pointer' }}>Original Code</label>
                {showOriginal ? <ChevronUp size={12} color="var(--text-dim)" /> : <ChevronDown size={12} color="var(--text-dim)" />}
              </div>
              {showOriginal && (
                <textarea
                  value={form.original_code}
                  onChange={e => update('original_code', e.target.value)}
                  placeholder="Paste original code here..."
                  style={{ minHeight: 140, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                />
              )}
              {!showOriginal && form.original_code && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {form.original_code.split('\n').length} lines loaded
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={generate}
              disabled={loading || !form.original_code || !form.fix_description}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading
                ? <><div className="spinner" /> Generating...</>
                : <><GitPullRequest size={12} /> Generate PR</>}
            </button>
          </div>
        </div>

        {/* Right: result */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!result && !loading && !error && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)', padding: 40 }}>
              <GitPullRequest size={48} strokeWidth={1} />
              <div style={{ fontSize: 13 }}>Select a template or configure manually</div>
              <div style={{ fontSize: 11 }}>AI will generate the fix code and a full PR description</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {['connection_pool', 'retry_logic'].map(t => (
                  <button key={t} className="btn" style={{ fontSize: 11 }} onClick={() => applyTemplate(templates.find(x => x.id === t) || {})}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48,
                border: '2px solid var(--border)',
                borderTop: '2px solid var(--accent-cyan)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Generating fix with Llama 70B...</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Building diff and PR description</div>
            </div>
          )}

          {error && (
            <div style={{ padding: 24 }}>
              <div style={{ padding: 16, background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 4, display: 'flex', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>Generation Failed</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{error}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Set GROQ_API_KEY in backend/.env to use real LLM</div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div style={{ padding: 20, flex: 1 }}>
              {/* PR Header */}
              <div style={{
                padding: '14px 16px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: 4,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className="badge badge-info" style={{ fontSize: 11 }}>Draft PR</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{result.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <GitBranch size={11} /> {result.branch_name}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>Model: {result.model_used}</span>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <div style={{ padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
                    $ git commit -m "{result.commit_message}"
                  </div>
                  <CopyButton text={result.commit_message} />
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                {[
                  { id: 'diff', icon: FileCode, label: 'Diff' },
                  { id: 'fixed', icon: Check, label: 'Fixed Code' },
                  { id: 'description', icon: GitPullRequest, label: 'PR Description' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px',
                      background: activeTab === tab.id ? 'var(--accent-cyan-dim)' : 'transparent',
                      border: `1px solid ${activeTab === tab.id ? 'var(--accent-cyan)' : 'transparent'}`,
                      borderRadius: 4,
                      color: activeTab === tab.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <tab.icon size={12} /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'diff' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <CopyButton text={result.patch} />
                  </div>
                  <CodeDiff patch={result.patch} />
                </div>
              )}

              {activeTab === 'fixed' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <CopyButton text={result.fixed_code} />
                  </div>
                  <div style={{ background: '#060810', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)' }}>
                      {form.file_path || 'fixed_code.py'}
                    </div>
                    <pre style={{ padding: '14px 16px', margin: 0, overflowX: 'auto', fontSize: 11, lineHeight: 1.7, color: '#abb2bf', maxHeight: 500 }}>
                      <code>{result.fixed_code}</code>
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'description' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <CopyButton text={result.description} />
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, fontFamily: 'var(--font-mono)' }}>
                      {result.description}
                    </pre>
                  </div>
                </div>
              )}

              {/* GitHub button placeholder */}
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <Sparkles size={14} color="var(--accent-purple)" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>
                  Add your GitHub token to backend/.env to automatically create this PR via GitHub API
                </span>
                <button className="btn" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ExternalLink size={10} /> Open on GitHub
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
