import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { getOverview, getSummary } from '../api/client';
import { BrainCircuit, Lightbulb, Sparkles } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 }
  }
};

const slideUp = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

const slideRight = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1, x: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  }
};

function CountUp({ target, duration = 2 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const num = typeof target === 'number' ? target : 0;

  useEffect(() => {
    if (!inView || !num) return;
    const frames = duration * 60;
    const increment = num / frames;
    let current = 0;
    let frame = 0;
    const timer = setInterval(() => {
      frame++;
      // Ease out - slow down near the end
      const progress = frame / frames;
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.floor(eased * num);
      setCount(current);
      if (frame >= frames) {
        setCount(num);
        clearInterval(timer);
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, num, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function AnimatedBar({ percent, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={inView ? { width: `${percent}%`, opacity: 1 } : { width: 0 }}
        transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{
          height: '100%',
          background: 'var(--gradient-primary)',
          borderRadius: 2,
        }}
      />
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    getOverview()
      .then(res => { setData(res.data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const fetchSummary = async () => {
    if (!data) return;
    setSummaryLoading(true);
    try {
      const res = await getSummary('overview', {
        total_posts: data.total_posts,
        unique_authors: data.unique_authors,
        subreddits: data.subreddits,
        date_range: data.date_range,
        top_subreddits: data.top_subreddits,
      });
      setSummary(res.data.summary);
    } catch (err) {
      setSummary('Summary unavailable.');
    }
    setSummaryLoading(false);
  };

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <p>Loading dashboard...</p>
    </div>
  );
  if (error) return <div className="error-message">Error: {error}</div>;
  if (!data) return null;

  const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : n;

  const stats = [
    { label: 'Total Posts', value: data.total_posts, sub: `Across ${data.unique_subreddits} subreddits` },
    { label: 'Unique Authors', value: data.unique_authors, sub: null },
    { label: 'Date Range', value: null, display: `${data.date_range.start} → ${data.date_range.end}`, sub: `${data.date_range.span_days} days`, small: true },
    { label: 'Avg Score', value: data.avg_score, sub: `Total: ${fmt(data.total_score)}` },
    { label: 'Total Comments', value: data.total_comments, sub: null },
    { label: 'Crossposts', value: data.crossposts, sub: 'Cross-community sharing' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div className="page-header" variants={slideUp}>
        <h2>Overview</h2>
        <p>
          Dataset snapshot — <span className="serif-accent">{data.date_range.span_days} days</span> of political discourse across Reddit
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div className="stats-grid" variants={container}>
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card"
            variants={slideUp}
            whileHover={{
              y: -8,
              scale: 1.02,
              transition: { type: 'spring', stiffness: 400, damping: 15 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={s.small ? { fontSize: '1.05rem' } : {}}>
              {s.value !== null && s.value !== undefined ? <CountUp target={s.value} /> : s.display}
            </div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </motion.div>
        ))}
      </motion.div>

      {/* Subreddit Distribution */}
      <motion.div className="card" style={{ marginBottom: 'var(--space-lg)' }} variants={slideUp}>
        <div className="card-header">
          <span className="card-title">Subreddit Distribution</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {data.unique_subreddits} communities
          </span>
        </div>
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {Object.entries(data.top_subreddits).map(([sub, count], idx) => (
            <motion.div
              key={sub}
              variants={slideRight}
              custom={idx}
              whileHover={{ x: 4 }}
              style={{ transition: 'all 0.2s' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={`sub-badge ${sub}`}>r/{sub}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {fmt(count)}
                </span>
              </div>
              <AnimatedBar percent={(count / data.total_posts) * 100} delay={idx * 0.06} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Domains Table */}
      <motion.div className="card" style={{ marginBottom: 'var(--space-lg)' }} variants={slideUp}>
        <div className="card-header">
          <span className="card-title">Top Content Domains</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>Domain</th><th>Posts</th></tr>
          </thead>
          <tbody>
            {Object.entries(data.top_domains).slice(0, 10).map(([domain, count], idx) => (
              <motion.tr
                key={domain}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <td style={{ fontFamily: 'var(--font-mono)', color: idx < 3 ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 700, width: 40 }}>
                  {String(idx + 1).padStart(2, '0')}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{domain}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(count)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* AI Insight */}
      <motion.div className="card" variants={slideUp}>
        <div className="card-header">
          <span className="card-title" style={{display:'flex',alignItems:'center',gap:8}}><BrainCircuit size={18} /> AI Insight</span>
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
        <AnimatePresence>
          {summary && (
            <motion.div
              className="summary-panel"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="summary-header"><Lightbulb size={14} /> AI Analysis</div>
              <div className="summary-text">{summary}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default Overview;
