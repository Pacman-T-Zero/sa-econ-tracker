import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const C = { gold: '#D4AF37', navy: '#0A1628', slate: '#1E293B', text: '#F1F5F9', muted: '#94A3B8' };

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch(`${API}/dashboard`).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const ask = async () => {
    setAsking(true);
    try {
      const r = await fetch(`${API}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const d = await r.json();
      setAnswer(d.answer);
    } catch (e) { setAnswer('Error: ' + e.message); }
    setAsking(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.navy, color: C.text, fontFamily: 'system-ui' }}>
      <header style={{ padding: '24px', borderBottom: `1px solid ${C.slate}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '22px' }}>🇿🇦 SA Economic <span style={{ color: C.gold }}>Tracker</span></h1>
        <button onClick={() => setAskOpen(!askOpen)} style={{ padding: '10px 20px', background: C.gold, border: 'none', borderRadius: '8px', color: C.navy, fontWeight: 'bold', cursor: 'pointer' }}>🤖 Ask AI</button>
      </header>

      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? <p>Loading...</p> : data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {data.indicators?.map((ind, i) => (
                <div key={i} style={{ background: C.slate, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{ind.icon}</div>
                  <div style={{ color: C.muted, fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>{ind.name}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: C.gold }}>{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value} <span style={{ fontSize: '14px', color: C.muted }}>{ind.unit}</span></div>
                  <div style={{ color: C.muted, fontSize: '13px', marginTop: '8px' }}>{ind.description}</div>
                </div>
              ))}
            </div>

            <h2 style={{ color: C.muted, fontSize: '14px', textTransform: 'uppercase', marginBottom: '16px' }}>Historical Trends</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {[
                { title: 'ZAR/USD Rate', data: data.exchange_rate?.history, color: C.gold },
                { title: 'Repo Rate %', data: data.sarb?.repo_rate?.history, color: '#10B981' },
                { title: 'Inflation %', data: data.inflation?.cpi?.history, color: '#F59E0B' },
                { title: 'GDP Growth %', data: data.gdp?.gdp_growth?.history, color: '#3B82F6' },
              ].map((chart, i) => (
                <div key={i} style={{ background: C.slate, borderRadius: '12px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>{chart.title}</h3>
                  {chart.data?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={[...chart.data].sort((a,b) => a.date.localeCompare(b.date)).slice(-10)}>
                        <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={d => d.slice(2)} />
                        <YAxis tick={{ fill: C.muted, fontSize: 10 }} width={40} />
                        <Tooltip contentStyle={{ background: C.navy, border: `1px solid ${C.gold}` }} />
                        <Area type="monotone" dataKey="value" stroke={chart.color} fill={chart.color} fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <p style={{ color: C.muted }}>No data</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {askOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh', background: C.navy, borderLeft: `1px solid ${C.slate}`, padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: C.gold }}>🤖 Ask AI</h2>
            <button onClick={() => setAskOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
          </div>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about SA economy..."
            style={{ width: '100%', padding: '12px', background: C.slate, border: 'none', borderRadius: '8px', color: C.text, marginBottom: '12px', boxSizing: 'border-box' }} />
          <button onClick={ask} disabled={asking || !question} style={{ width: '100%', padding: '12px', background: asking ? C.slate : C.gold, border: 'none', borderRadius: '8px', color: C.navy, fontWeight: 'bold', cursor: asking ? 'wait' : 'pointer' }}>
            {asking ? 'Thinking...' : 'Get Answer'}
          </button>
          {answer && <div style={{ marginTop: '20px', padding: '16px', background: C.slate, borderRadius: '8px', lineHeight: 1.6 }}>{answer}</div>}
          <div style={{ marginTop: '20px' }}>
            <p style={{ color: C.muted, fontSize: '12px', marginBottom: '8px' }}>Try asking:</p>
            {['Why is the rand weak?', 'How does repo rate affect me?', 'Is SA in recession?'].map((q, i) => (
              <button key={i} onClick={() => setQuestion(q)} style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '6px', background: 'transparent', border: `1px solid ${C.slate}`, borderRadius: '6px', color: C.text, textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}>{q}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
