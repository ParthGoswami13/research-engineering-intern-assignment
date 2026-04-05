import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { searchPosts } from '../api/client';
import { Search as SearchIcon, SearchCheck, AlertTriangle, Globe2, ArrowUp, Calendar, Compass } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const platformMeta = results?.platforms || [];
  const groupedResults = results?.grouped_results || {};

  const getPlatformLabel = (source) => {
    const match = platformMeta.find((platform) => platform.source === source);
    return match?.label || source.replace(/_/g, ' ');
  };

  const platformGroups = platformMeta
    .filter((platform) => platform.count > 0 && Array.isArray(groupedResults[platform.source]))
    .map((platform) => ({
      source: platform.source,
      label: platform.label,
      items: groupedResults[platform.source],
    }));

  const fallbackGroups = platformGroups.length > 0
    ? platformGroups
    : [
        {
          source: 'all',
          label: 'All Sources',
          items: results?.results || [],
        },
      ];

  const handleSearch = async (searchQuery = query) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await searchPosts(q);
      setResults(res.data);
    } catch (err) {
      setError('Search failed. Is the backend running?');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div className="page-header" variants={slideUp}>
        <h2>Semantic Search</h2>
        <p>Find posts by <span className="serif-accent">meaning, not just keywords</span></p>
      </motion.div>

      <motion.div
        className="search-bar"
        style={{ marginBottom: 'var(--space-xl)', maxWidth: 740 }}
        variants={slideUp}
      >
        <span className="search-icon"><SearchIcon size={18} /></span>
        <input
          type="text"
          placeholder="Search by meaning... e.g. 'government should stop wasting money'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          id="semantic-search-input"
        />
        <motion.button
          className="btn btn-primary"
          onClick={() => handleSearch()}
          disabled={loading}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
        >
          {loading ? (
            <span className="ai-thinking-dots"><span /><span /><span /></span>
          ) : 'Search'}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div className="error-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!results && !loading && (
        <motion.div
          style={{ textAlign: 'center', padding: 'var(--space-3xl) var(--space-xl)', color: 'var(--text-muted)' }}
          variants={slideUp}
        >
            <SearchCheck size={56} style={{ marginBottom: 'var(--space-lg)', opacity: 0.3 }} />
          <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Enter a phrase to find semantically similar posts
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
            {[
              'economic inequality is destroying democracy',
              'immigration policy debate',
              'universal healthcare costs',
            ].map((ex, i) => (
              <motion.button
                key={i}
                className="btn btn-secondary"
                onClick={() => handleSuggestion(ex)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                whileHover={{ y: -3, borderColor: 'rgba(232,168,73,0.3)' }}
                whileTap={{ scale: 0.96 }}
                style={{ fontSize: '0.75rem' }}
              >
                "{ex}"
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {results && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              {results.warnings?.map((w, i) => (
                <motion.div key={i} className="warning-badge" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                  <AlertTriangle size={12} /> {w}
                </motion.div>
              ))}
              {results.language && (
                <motion.div className="warning-badge" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Globe2 size={12} /> Detected: {results.language}
                </motion.div>
              )}
            </div>

            <motion.div
              style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 'var(--space-md)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {results.total_results} results across {platformMeta.filter((p) => p.count > 0).length || 1} platform sources for "{results.query}"
            </motion.div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
              {(platformMeta.length > 0 ? platformMeta : [{ source: 'all', label: 'All Sources', count: results?.total_results || 0 }])
                .filter((platform) => platform.count > 0)
                .map((platform, idx) => (
                  <motion.span
                    key={`${platform.source}-${idx}`}
                    className="warning-badge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + idx * 0.06 }}
                  >
                    {getPlatformLabel(platform.source)}: {platform.count}
                  </motion.span>
                ))}
            </div>

            {fallbackGroups.map((group, groupIdx) => (
              <motion.div
                key={`${group.source}-${groupIdx}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + groupIdx * 0.08 }}
              >
                <div className="card-title" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                  <span>{group.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.6px' }}>{group.items.length} matches</span>
                </div>

                {group.items.map((result, i) => {
                  const idx = groupIdx * 100 + i;
                  return (
                    <motion.div
                      key={`${group.source}-${result.id}-${i}`}
                      className="result-card"
                      initial={{ opacity: 0, y: 25, x: -8 }}
                      animate={{ opacity: 1, y: 0, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ x: 8, borderColor: 'rgba(232,168,73,0.15)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                        <div style={{ flex: 1 }}>
                          <div className="result-title">
                            <a href={result.permalink || result.url || '#'} target="_blank" rel="noopener noreferrer">{result.title}</a>
                          </div>
                          <div className="result-meta">
                            <span className={`sub-badge ${result.subreddit}`}>r/{result.subreddit}</span>
                            <span>u/{result.author}</span>
                            <span style={{display:'flex',alignItems:'center',gap:2}}><ArrowUp size={12} /> {result.score}</span>
                            <span style={{display:'flex',alignItems:'center',gap:2}}><Calendar size={12} /> {result.created_date}</span>
                          </div>
                          {result.text && <div className="result-text">{result.text.slice(0, 200)}{result.text.length > 200 ? '...' : ''}</div>}
                        </div>
                        <motion.div
                          style={{
                            minWidth: 68, textAlign: 'center', padding: '12px 8px',
                            background: result.similarity > 60 ? 'var(--accent-primary-dim)' : 'var(--accent-tertiary-dim)',
                            borderRadius: 'var(--radius-lg)',
                            border: `1px solid ${result.similarity > 60 ? 'rgba(232,168,73,0.15)' : 'rgba(251,113,133,0.15)'}`,
                          }}
                          initial={{ scale: 0.7, opacity: 0, rotate: -5 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          transition={{ delay: idx * 0.03 + 0.2, type: 'spring', stiffness: 300, damping: 15 }}
                        >
                          <div style={{
                            fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                            color: result.similarity > 60 ? 'var(--accent-primary)' : 'var(--accent-tertiary)',
                            letterSpacing: '-0.5px',
                          }}>
                            {result.similarity}%
                          </div>
                          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: 3, fontWeight: 700 }}>match</div>
                        </motion.div>
                      </div>
                      <div className="similarity-bar">
                        <motion.div
                          className="similarity-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${result.similarity}%` }}
                          transition={{ delay: idx * 0.03 + 0.15, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ))}

            <AnimatePresence>
              {results.suggested_queries?.length > 0 && (
                <motion.div className="card" style={{ marginTop: 'var(--space-lg)' }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
                  <div className="card-title" style={{ marginBottom: 'var(--space-md)', display:'flex', alignItems:'center', gap:8 }}><Compass size={16} /> Explore Further</div>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {results.suggested_queries.map((sq, i) => (
                      <motion.button
                        key={i}
                        className="btn btn-secondary"
                        onClick={() => handleSuggestion(sq)}
                        whileHover={{ y: -3, borderColor: 'rgba(232,168,73,0.25)' }}
                        whileTap={{ scale: 0.96 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.08 }}
                      >
                        {sq}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default SemanticSearch;
