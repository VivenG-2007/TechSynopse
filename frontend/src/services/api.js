const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Health
  health: () => request('/health'),
  modelConfig: () => request('/config/models'),

  // Logs
  getLogs: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ));
    return request(`/logs?${q}`);
  },
  getLogStats: () => request('/logs/stats'),
  streamLogs: (service) => request(`/logs/stream${service ? `?service=${service}` : ''}`),

  // Anomalies
  getAnomalies: (count = 5) => request(`/anomalies?count=${count}`),
  getAnomalySummary: () => request('/anomalies/summary'),

  // LLM
  queryLLM: (body) => request('/llm/query', { method: 'POST', body: JSON.stringify(body) }),

  // Root Cause
  analyzeRootCause: (body) => request('/analyze/root-cause', { method: 'POST', body: JSON.stringify(body) }),

  // Fix
  generateFix: (body) => request('/analyze/fix', { method: 'POST', body: JSON.stringify(body) }),

  // PR
  generatePR: (body) => request('/pr/generate', { method: 'POST', body: JSON.stringify(body) }),
  getPRTemplates: () => request('/pr/templates'),
};
