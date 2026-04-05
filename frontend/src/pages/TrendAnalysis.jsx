import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTimeseries, getSummary, getPosts } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Search as SearchIcon, Lightbulb, Flame, ClipboardList, ArrowUp, MessageSquare, X } from 'lucide-react';

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
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [selectedSpike, setSelectedSpike] = useState(null);
  const [spikePosts, setSpikePosts] = useState([]);

  useEffect(() => {
    setLoading(true);
    getTimeseries(granularity, null, query)
      .then(res => {
        setData(res.data);
        setSelectedSpike(null);
        setSpikePosts([]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [granularity, query]);

  useEffect(() => {
    if (!data) return;

    setSummaryLoading(true);
    setSummaryError('');

    getSummary('time_series', {
      total_posts: data.total_posts,
      peak_date: data.peak?.date,
      peak_count: data.peak?.count,
      num_spikes: data.spikes?.length,
      granularity,
      query,
      spikes: data.spikes?.slice(0, 5),
    })
      .then((res) => setSummary(res.data.summary))
      .catch(() => {
        setSummary('');
        setSummaryError('Summary unavailable for the current filter.');
      })
      .finally(() => setSummaryLoading(false));
  }, [data, granularity, query]);

  const applyQueryFilter = () => {
    setQuery(queryInput.trim());
  };

  const clearQueryFilter = () => {
    setQueryInput('');
    setQuery('');
  };

  const handleQueryKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyQueryFilter();
    }
  };

  const handleSpikeClick = async (spike) => {
    setSelectedSpike(spike);
    try {
      const res = await getPosts({ date: spike.date, limit: 5, q: query });
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

      <motion.div className="search-bar" style={{ marginBottom: 'var(--space-md)', maxWidth: 760 }} variants={slideUp}>
        <span className="search-icon"><SearchIcon size={18} /></span>
        <input
          type="text"
          placeholder="Filter timeline by keyword, phrase, or URL..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={handleQueryKeyDown}
          id="trend-query-input"
        />
        <motion.button className="btn btn-primary" onClick={applyQueryFilter} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
          Apply
        </motion.button>
        {(query || queryInput) && (
          <motion.button className="btn btn-secondary" onClick={clearQueryFilter} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
            Clear
          </motion.button>
        )}
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
        {query && (
          <span className="warning-badge">
            Filter: "{query}"
          </span>
        )}
      </motion.div>

      <motion.div className="chart-container" variants={slideUp}>
        <div className="card-header">
          <span className="card-title">Post Volume Over Time</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
            {summaryLoading ? 'Generating dynamic GenAI summary...' : 'Dynamic GenAI summary'}
          </span>
        </div>
        {data.timeseries?.length ? (
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
        ) : (
          <div className="error-message">No time-series points available for the current filter.</div>
        )}

        {(summaryLoading || summary || summaryError) && (
          <motion.div
            className="summary-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="summary-header"><Lightbulb size={14} /> AI Analysis</div>
            <div className="summary-text">
              {summaryLoading ? 'Generating a plain-language explanation from the current chart data...' : (summaryError || summary)}
            </div>
          </motion.div>
        )}
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
