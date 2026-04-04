import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTimeseries, getSummary, getPosts } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Sparkles, Lightbulb, Flame, ClipboardList, ArrowUp, MessageSquare, X } from 'lucide-react';

const SUB_COLORS = {
  neoliberal: '#e8a849', politics: '#34d399', worldpolitics: '#22d3ee',
  socialism: '#f43f5e', Liberal: '#a78bfa', Conservative: '#f97316',
  Anarchism: '#71717a', democrats: '#60a5fa', Republican: '#ef4444',
  PoliticalDiscussion: '#fbbf24'
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(12, 12, 15, 0.95)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(232,168,73,0.15)',
      borderRadius: 14,
      padding: '14px 18px',
      color: '#ececf1',
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      minWidth: 140,
    }}>
      <div style={{ fontSize: '0.7rem', color: '#53535f', marginBottom: 8, fontFamily: 'JetBrains Mono', letterSpacing: '0.5px' }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, boxShadow: `0 0 8px ${entry.color}40` }} />
          <span style={{ color: '#8b8b9e', fontWeight: 500 }}>{entry.name}</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, marginLeft: 'auto' }}>{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

function TrendAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('daily');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedSpike, setSelectedSpike] = useState(null);
  const [spikePosts, setSpikePosts] = useState([]);

  useEffect(() => {
    setLoading(true);
    getTimeseries(granularity)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [granularity]);

  const fetchSummary = async () => {
    if (!data) return;
    setSummaryLoading(true);
    try {
      const res = await getSummary('time_series', {
        total_posts: data.total_posts,
        peak_date: data.peak?.date,
        peak_count: data.peak?.count,
        num_spikes: data.spikes?.length,
        granularity,
        spikes: data.spikes?.slice(0, 5),
      });
      setSummary(res.data.summary);
    } catch { setSummary('Summary unavailable.'); }
    setSummaryLoading(false);
  };

  const handleSpikeClick = async (spike) => {
    setSelectedSpike(spike);
    try {
      const res = await getPosts({ date: spike.date, limit: 5 });
      setSpikePosts(res.data.posts);
    } catch { setSpikePosts([]); }
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading trends...</p></div>;
  if (!data) return <div className="error-message">Failed to load trend data.</div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div className="page-header" variants={slideUp}>
        <h2>Trend Analysis</h2>
        <p>How the conversation evolved across <span className="serif-accent">political subreddits</span></p>
      </motion.div>

      <motion.div variants={slideUp} style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <div className="toggle-pills">
          {['daily', 'weekly', 'monthly'].map(g => (
            <motion.button
              key={g}
              className={`toggle-pill ${granularity === g ? 'active' : ''}`}
              onClick={() => setGranularity(g)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </motion.button>
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
          {data.total_posts?.toLocaleString()} posts
        </span>
      </motion.div>

      <motion.div className="chart-container" variants={slideUp}>
        <div className="card-header">
          <span className="card-title">Post Volume Over Time</span>
          <motion.button
            className="btn btn-primary"
            onClick={fetchSummary}
            disabled={summaryLoading}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
          >
            {summaryLoading ? (
              <span className="ai-thinking-dots"><span /><span /><span /></span>
            ) : <><Sparkles size={14} /> Analyze</>}
          </motion.button>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data.timeseries}>
            <defs>
              <linearGradient id="lineWarm" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#e8a849" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
              <linearGradient id="areaWarm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8a849" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#e8a849" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#53535f', fontFamily: 'JetBrains Mono' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#53535f', fontFamily: 'JetBrains Mono' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="count" stroke="url(#lineWarm)" strokeWidth={2.5} fill="url(#areaWarm)"
              name="Posts" animationDuration={2000} animationEasing="ease-out" />
            <Line type="monotone" dataKey="avg_score" stroke="#34d399" strokeWidth={1.5}
              dot={false} name="Avg Score" strokeDasharray="5 5" strokeOpacity={0.6}
              yAxisId={0} animationDuration={2200} />
          </AreaChart>
        </ResponsiveContainer>

        <AnimatePresence>
          {summary && (
            <motion.div
              className="summary-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="summary-header"><Lightbulb size={14} /> AI Analysis</div>
              <div className="summary-text">{summary}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {data.spikes?.length > 0 && (
          <motion.div
            className="card"
            style={{ marginBottom: 'var(--space-lg)' }}
            variants={slideUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <div className="card-header">
              <span className="card-title" style={{display:'flex',alignItems:'center',gap:8}}><Flame size={16} /> Detected Spikes</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {data.spikes.length} anomalies
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
              {data.spikes.map((spike, i) => (
                <motion.div
                  key={i}
                  className="stat-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSpikeClick(spike)}
                  whileHover={{
                    y: -8,
                    scale: 1.03,
                    boxShadow: '0 0 40px rgba(232,168,73,0.1)',
                    transition: { type: 'spring', stiffness: 400, damping: 15 }
                  }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.45 }}
                >
                  <div className="stat-label">{spike.date}</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{spike.count}</div>
                  <div className="stat-sub">{spike.dominant_subreddit && `r/${spike.dominant_subreddit}`}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSpike && spikePosts.length > 0 && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="card-header">
              <span className="card-title" style={{display:'flex',alignItems:'center',gap:8}}><ClipboardList size={16} /> Top Posts on {selectedSpike.date}</span>
              <motion.button className="btn btn-ghost" onClick={() => setSelectedSpike(null)} whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}><X size={16} /></motion.button>
            </div>
            {spikePosts.map((post, idx) => (
              <motion.div
                key={post.id}
                className="result-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="result-title">{post.title}</div>
                <div className="result-meta">
                  <span className={`sub-badge ${post.subreddit}`}>r/{post.subreddit}</span>
                  <span>u/{post.author}</span>
                  <span style={{display:'flex',alignItems:'center',gap:2}}><ArrowUp size={12} /> {post.score}</span>
                  <span style={{display:'flex',alignItems:'center',gap:2}}><MessageSquare size={12} /> {post.num_comments}</span>
                </div>
                {post.selftext && <div className="result-text">{post.selftext.slice(0, 200)}...</div>}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default TrendAnalysis;
