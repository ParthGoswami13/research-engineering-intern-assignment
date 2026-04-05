import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getClusters, getEmbeddings, getSummary, getApiUrl } from '../api/client';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Pin, X, Lightbulb, ArrowUp, Box, Download, Sparkles } from 'lucide-react';

const CLUSTER_COLORS = ['#e8a849', '#34d399', '#fb7185', '#22d3ee', '#a78bfa', '#f97316', '#fbbf24', '#f43f5e', '#60a5fa', '#14b8a6',
  '#ef4444', '#84cc16', '#e11d48', '#0891b2', '#d97706', '#7c3aed', '#059669', '#dc2626', '#2563eb', '#ca8a04'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

function TopicExplorer() {
  const [k, setK] = useState(5);
  const [clusters, setClusters] = useState(null);
  const [embeddings, setEmbeddings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [embLoading, setEmbLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showProjectorInfo, setShowProjectorInfo] = useState(false);
  const tensorsUrl = getApiUrl('/api/projector/tensors.tsv');
  const metadataUrl = getApiUrl('/api/projector/metadata.tsv');

  const fetchClusters = async (numK) => {
    setLoading(true);
    try {
      const res = await getClusters(numK);
      setClusters(res.data);
    } catch { setClusters(null); }
    setLoading(false);
  };

  useEffect(() => { fetchClusters(k); }, []);

  useEffect(() => {
    getEmbeddings()
      .then(res => { setEmbeddings(res.data); setEmbLoading(false); })
      .catch(() => setEmbLoading(false));
  }, []);

  const handleSliderChange = (e) => setK(parseInt(e.target.value));
  const handleSliderRelease = () => fetchClusters(k);

  const fetchSummary = async (clusterId, info) => {
    setSummaryLoading(true);
    try {
      const res = await getSummary('clusters', {
        k: clusters?.k,
        cluster_id: clusterId,
        label: info.label,
        keywords: info.keywords,
        count: info.count,
        largest_cluster: Object.entries(clusters?.cluster_info || {})
          .sort((a, b) => b[1].count - a[1].count)[0]?.[1]?.label,
      });
      setSummary(res.data.summary);
    } catch { setSummary('Summary unavailable.'); }
    setSummaryLoading(false);
  };

  const scatterData = embeddings?.points?.map((p) => ({
    ...p,
    cluster: clusters?.labels?.[p.row_index] ?? 0,
  })) || [];

  const clusterGroups = {};
  scatterData.forEach(p => {
    const c = p.cluster;
    if (!clusterGroups[c]) clusterGroups[c] = [];
    clusterGroups[c].push(p);
  });

  const CustomScatterTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{
        background: 'rgba(12, 12, 15, 0.95)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(232,168,73,0.15)',
        borderRadius: 14,
        padding: '12px 16px',
        fontSize: 12,
        color: '#ececf1',
        maxWidth: 300,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        fontFamily: 'Space Grotesk, sans-serif',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{d?.title}</div>
        <div style={{ color: '#8b8b9e', fontSize: 11 }}>r/{d?.subreddit} · u/{d?.author}</div>
      </div>
    );
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div className="page-header" variants={slideUp}>
        <h2>Topic Explorer</h2>
        <p>Discover sub-narratives — <span className="serif-accent">adjust cluster count to zoom in or out</span></p>
      </motion.div>

      <motion.div className="slider-container" style={{ marginBottom: 'var(--space-lg)', maxWidth: 500 }} variants={slideUp}>
        <label>Clusters:</label>
        <input type="range" min="2" max="20" value={k}
          onChange={handleSliderChange}
          onMouseUp={handleSliderRelease}
          onTouchEnd={handleSliderRelease}
          id="cluster-slider"
        />
        <motion.span
          className="slider-value"
          key={k}
          initial={{ scale: 1.4, color: '#fb7185' }}
          animate={{ scale: 1, color: '#e8a849' }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
        >
          {k}
        </motion.span>
      </motion.div>

      {clusters?.warnings?.map((w, i) => (
        <motion.div key={i} className="warning-badge" style={{ marginBottom: 'var(--space-md)' }}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <AlertTriangle size={12} /> {w}
        </motion.div>
      ))}

      {loading && <div className="loading"><div className="spinner" /><p>Computing clusters...</p></div>}

      <AnimatePresence>
        {!loading && clusters && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="cluster-grid" style={{ marginBottom: 'var(--space-xl)' }} variants={container} initial="hidden" animate="show">
              {Object.entries(clusters.cluster_info).map(([id, info], idx) => (
                <motion.div
                  key={id}
                  className={`cluster-card ${selectedCluster === id ? 'active' : ''}`}
                  onClick={() => { setSelectedCluster(id); fetchSummary(id, info); }}
                  style={{ borderLeft: `3px solid ${CLUSTER_COLORS[id % CLUSTER_COLORS.length]}` }}
                  variants={slideUp}
                  whileHover={{
                    y: -6, scale: 1.01,
                    boxShadow: `0 0 40px ${CLUSTER_COLORS[id % CLUSTER_COLORS.length]}10`,
                    transition: { type: 'spring', stiffness: 400, damping: 15 }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <div className="cluster-name" style={{ color: CLUSTER_COLORS[id % CLUSTER_COLORS.length] }}>{info.label}</div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.03)', padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                    }}>
                      {info.count}
                    </span>
                  </div>
                  <div className="cluster-keywords">
                    {info.keywords?.map((kw, i) => (
                      <motion.span key={i} className="keyword-tag"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 + i * 0.03, type: 'spring', stiffness: 300 }}>
                        {kw}
                      </motion.span>
                    ))}
                  </div>
                  {info.sample_posts?.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                      <Pin size={11} /> {info.sample_posts[0].title?.slice(0, 55)}...
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            <AnimatePresence>
              {selectedCluster && (
                <motion.div className="card" style={{ marginBottom: 'var(--space-lg)' }}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="card-header">
                    <span className="card-title">
                      Cluster {selectedCluster}: {clusters.cluster_info[selectedCluster]?.label}
                    </span>
                    <motion.button className="btn btn-ghost" onClick={() => setSelectedCluster(null)}
                      whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}><X size={16} /></motion.button>
                  </div>
                  {summaryLoading ? (
                    <div className="ai-thinking" style={{ justifyContent: 'center' }}>
                      <span className="ai-thinking-dots"><span /><span /><span /></span>
                      <span>Generating insight...</span>
                    </div>
                  ) : summary && (
                    <motion.div className="summary-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.4 }}>
                      <div className="summary-header"><Lightbulb size={14} /> AI Analysis</div>
                      <div className="summary-text">{summary}</div>
                    </motion.div>
                  )}
                  {clusters.cluster_info[selectedCluster]?.sample_posts?.map((post, i) => (
                    <motion.div key={i} className="result-card" style={{ marginTop: 'var(--space-md)' }}
                      initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.4 }}>
                      <div className="result-title">{post.title}</div>
                      <div className="result-meta">
                        <span className={`sub-badge ${post.subreddit}`}>r/{post.subreddit}</span>
                        <span>u/{post.author}</span>
                        <span style={{display:'flex',alignItems:'center',gap:2}}><ArrowUp size={12} /> {post.score}</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="chart-container" variants={slideUp}>
        <div className="card-header">
          <span className="card-title">2D Embedding Space</span>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              {embeddings?.sampled || 0}/{embeddings?.total || 0} pts
            </span>
            <motion.button className="btn btn-secondary" onClick={() => setShowProjectorInfo(!showProjectorInfo)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
              {showProjectorInfo ? 'Hide' : <><Box size={14} /> 3D Viewer</>}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {showProjectorInfo && (
            <motion.div className="card"
              style={{ marginBottom: 'var(--space-lg)', background: 'rgba(52,211,153,0.03)', borderColor: 'rgba(52,211,153,0.15)' }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
              <h3 style={{ color: 'var(--accent-secondary)', marginBottom: 'var(--space-sm)', fontFamily: 'var(--font-serif)', fontWeight: 700 }}>TensorFlow Projector</h3>
              <p style={{ marginBottom: 'var(--space-md)', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Explore full 384D embeddings in 3D.</p>
              <ol style={{ paddingLeft: 'var(--space-lg)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: '2.2' }}>
                <li>Download: <a href={tensorsUrl} download className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: '0.72rem' }}><Download size={11} /> tensors.tsv</a></li>
                <li>Download: <a href={metadataUrl} download className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: '0.72rem' }}><Download size={11} /> metadata.tsv</a></li>
                <li>Open <a href="https://projector.tensorflow.org/" target="_blank" rel="noopener noreferrer">projector.tensorflow.org</a></li>
                <li>Load both files → explore!</li>
              </ol>
            </motion.div>
          )}
        </AnimatePresence>

        {embLoading ? (
          <div className="loading"><div className="spinner" /><p>Loading embeddings...</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis type="number" dataKey="x" tick={false} axisLine={false} />
              <YAxis type="number" dataKey="y" tick={false} axisLine={false} />
              <Tooltip content={<CustomScatterTooltip />} />
              {Object.entries(clusterGroups).map(([clusterId, points]) => (
                <Scatter
                  key={clusterId} name={`Cluster ${clusterId}`}
                  data={points} fill={CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length]}
                  opacity={0.6} r={3.5}
                  animationDuration={1800} animationEasing="ease-out"
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </motion.div>
  );
}

export default TopicExplorer;
