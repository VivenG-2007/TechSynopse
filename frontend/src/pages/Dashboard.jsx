import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, Activity, Zap, Terminal,
  TrendingUp, Clock, Server, ArrowRight
} from 'lucide-react';
import { api } from '../services/api.js';

const MOCK_TIMELINE = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  errors: Math.floor(Math.random() * 80) + (i >= 14 && i <= 16 ? 200 : 10),
  warnings: Math.floor(Math.random() * 40) + 20,
  info: Math.floor(Math.random() * 300) + 100,
}));

const PIE_COLORS = ['#ff3b5c', '#ffb020', '#00d4ff', '#00ff88', '#b060ff'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      padding: '8px 12px',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, sub, color = 'var(--accent-cyan)', icon: Icon }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color }}>{value}</div>
          {sub && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ background: color + '18', border: `1px solid ${color}40`, borderRadius: 4, padding: 8 }}>
          <Icon size={16} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getLogStats().catch(() => null),
      api.getAnomalySummary().catch(() => null),
      api.health().catch(() => null),
    ]).then(([s, a, h]) => {
      setStats(s);
      setAnomalies(a?.anomalies?.slice(0, 5) || []);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  const pieData = stats
    ? Object.entries(stats.by_service || {}).map(([name, value]) => ({ name, value }))
    : [];

  const byLevel = stats?.by_level || {};

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div className="pulse-dot" />
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: 'var(--text-primary)',
          }}>
            System Dashboard
          </h1>
          {health && (
            <span style={{
              fontSize: 10,
              padding: '2px 8px',
              background: health.groq_configured ? 'var(--accent-green-dim)' : 'var(--accent-amber-dim)',
              color: health.groq_configured ? 'var(--accent-green)' : 'var(--accent-amber)',
              border: `1px solid ${health.groq_configured ? '#00ff8840' : '#ffb02040'}`,
              borderRadius: 2,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Groq {health.groq_configured ? 'Connected' : 'Not Configured'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Real-time observability · AI-powered analysis · Groq → OpenAI routing
        </div>
      </div>

      {/* Stats Row */}
      {loading ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="card" style={{ flex: 1, height: 90, background: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Total Logs (1h)"
            value={stats?.total?.toLocaleString() || '—'}
            sub={`${stats?.error_rate || 0}% error rate`}
            color="var(--accent-cyan)"
            icon={Activity}
          />
          <StatCard
            label="Critical Errors"
            value={byLevel.CRITICAL || 0}
            sub="in last hour"
            color="var(--accent-red)"
            icon={AlertTriangle}
          />
          <StatCard
            label="Warnings"
            value={byLevel.WARNING || 0}
            sub="requiring attention"
            color="var(--accent-amber)"
            icon={TrendingUp}
          />
          <StatCard
            label="Services"
            value={Object.keys(stats?.by_service || {}).length || 8}
            sub="monitored instances"
            color="var(--accent-green)"
            icon={Server}
          />
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, marginBottom: 24 }}>
        {/* Timeline */}
        <div className="card">
          <div className="card-header">
            <span className="section-title">Log Volume — 24h Timeline</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
              <span style={{ color: '#ff3b5c' }}>● Errors</span>
              <span style={{ color: '#ffb020' }}>● Warnings</span>
              <span style={{ color: '#00d4ff' }}>● Info</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MOCK_TIMELINE}>
              <defs>
                <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWarn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffb020" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ffb020" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInfo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="errors" stroke="#ff3b5c" fill="url(#gErr)" strokeWidth={1.5} name="errors" />
              <Area type="monotone" dataKey="warnings" stroke="#ffb020" fill="url(#gWarn)" strokeWidth={1.5} name="warnings" />
              <Area type="monotone" dataKey="info" stroke="#00d4ff" fill="url(#gInfo)" strokeWidth={1} name="info" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Service distribution */}
        <div className="card">
          <div className="card-header">
            <span className="section-title">By Service</span>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {pieData.slice(0, 4).map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Anomalies + Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
        {/* Recent Anomalies */}
        <div className="card">
          <div className="card-header">
            <span className="section-title">Recent Anomalies</span>
            <Link to="/incidents" style={{ fontSize: 10, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={10} />
            </Link>
          </div>
          {anomalies.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: 8 }}>Loading anomalies...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {anomalies.map(a => (
                <div key={a.id} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-deep)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}>
                  <div className={`badge badge-${a.severity}`}>{a.severity}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.description}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {a.service} · score {a.score}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>Quick Actions</div>
          {[
            { to: '/llm', icon: Zap, label: 'Query LLM Router', sub: 'Groq → OpenAI fallback', color: 'var(--accent-cyan)' },
            { to: '/logs', icon: Terminal, label: 'Explore Logs', sub: 'Search & filter', color: 'var(--accent-green)' },
            { to: '/root-cause', icon: Activity, label: 'Analyze Incident', sub: 'AI root cause', color: 'var(--accent-amber)' },
            { to: '/pr', icon: 'git', label: 'Generate PR', sub: 'Auto-fix & PR', color: 'var(--accent-purple)' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              transition: 'border-color 0.15s',
              textDecoration: 'none',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = item.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ background: item.color + '18', border: `1px solid ${item.color}40`, borderRadius: 4, padding: 6 }}>
                {item.icon === 'git'
                  ? <Zap size={12} color={item.color} />
                  : <item.icon size={12} color={item.color} />}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.sub}</div>
              </div>
              <ArrowRight size={12} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
