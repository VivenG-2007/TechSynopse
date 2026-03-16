import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, Terminal, AlertTriangle, Brain, Wrench,
  GitPullRequest, Zap, ChevronRight, Radio, Server
} from 'lucide-react';

const NAV = [
  { to: '/', icon: Activity, label: 'Dashboard', exact: true },
  { to: '/logs', icon: Terminal, label: 'Log Explorer' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { to: '/root-cause', icon: Brain, label: 'Root Cause' },
  { to: '/fix', icon: Wrench, label: 'Fix Suggestions' },
  { divider: true },
  { to: '/llm', icon: Zap, label: 'LLM Router' },
  { to: '/pr', icon: GitPullRequest, label: 'PR Generator' },
];

export default function Layout({ children }) {
  const [time, setTime] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'var(--accent-cyan-dim)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Radio size={14} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
              LogAI
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Platform v1.0
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map((item, i) => {
            if (item.divider) {
              return (
                <div key={i} style={{
                  margin: '8px 16px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 8,
                }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4, marginLeft: 8 }}>
                    AI Tools
                  </div>
                </div>
              );
            }
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px',
                  margin: '1px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-cyan-dim)' : 'transparent',
                  border: isActive ? '1px solid #00d4ff25' : '1px solid transparent',
                  transition: 'all 0.15s',
                  letterSpacing: '0.04em',
                }}
              >
                <item.icon size={14} />
                {item.label}
                {isActive && <ChevronRight size={10} style={{ marginLeft: 'auto' }} />}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer status */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              SYSTEM LIVE
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {time.toISOString().replace('T', ' ').slice(0, 19)} UTC
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Server size={10} color="var(--text-dim)" />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>8 services monitored</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg-void)',
        position: 'relative',
      }}>
        {/* Top scanline effect */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)',
          opacity: 0.3,
          zIndex: 10,
        }} />
        {children}
      </main>
    </div>
  );
}
