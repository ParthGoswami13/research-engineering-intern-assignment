import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNetwork, getSummary } from '../api/client';
import * as d3 from 'd3';
import { Search as SearchIcon, Trophy, User, Sparkles, Lightbulb, X, Award, Medal } from 'lucide-react';

const COMMUNITY_COLORS = ['#e8a849', '#34d399', '#fb7185', '#22d3ee', '#a78bfa', '#f97316', '#fbbf24', '#f43f5e', '#60a5fa', '#14b8a6'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

function NetworkAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [removeTopN, setRemoveTopN] = useState(0);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const svgRef = useRef(null);
  const stressProgress = `${(removeTopN / 5) * 100}%`;

  useEffect(() => {
    setLoading(true);
    getNetwork(query, removeTopN)
      .then(res => {
        setData(res.data);
        setSelectedNode(null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [query, removeTopN]);

  useEffect(() => {
    if (!data || !svgRef.current || !data.nodes.length) return;
    return renderGraph();
  }, [data]);

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

  const renderGraph = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.parentElement.clientWidth;
    const height = 520;
    svg.attr('width', width).attr('height', height);

    const maxPR = Math.max(...data.nodes.map(n => n.pagerank), 0.001);
    const nodeScale = d3.scaleLinear().domain([0, maxPR]).range([3, 26]);

    const nodes = data.nodes.map(n => ({ ...n, radius: nodeScale(n.pagerank) }));
    const edges = data.edges
      .filter(e => nodes.find(n => n.id === e.source) && nodes.find(n => n.id === e.target))
      .slice(0, 500);

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(60).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 2));

    const g = svg.append('g');

    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.3, 5])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    // Glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'nodeGlow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Edges
    const link = g.selectAll('line')
      .data(edges).enter().append('line')
      .attr('stroke', 'rgba(255,255,255,0.035)')
      .attr('stroke-width', d => Math.min(d.weight, 3));

    // Nodes
    const node = g.selectAll('circle')
      .data(nodes).enter().append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => COMMUNITY_COLORS[d.community % COMMUNITY_COLORS.length])
      .attr('stroke', 'rgba(0,0,0,0.2)')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .attr('filter', d => d.pagerank > maxPR * 0.3 ? 'url(#nodeGlow)' : null)
      .on('click', (e, d) => setSelectedNode(d))
      .on('mouseover', function(e, d) {
        const color = COMMUNITY_COLORS[d.community % COMMUNITY_COLORS.length];
        d3.select(this)
          .transition().duration(150)
          .attr('r', d.radius * 1.5)
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.8);

        link.transition().duration(150)
          .attr('stroke', l =>
            l.source.id === d.id || l.target.id === d.id ? color : 'rgba(255,255,255,0.015)')
          .attr('stroke-width', l =>
            l.source.id === d.id || l.target.id === d.id ? 2 : Math.min(l.weight, 3))
          .attr('stroke-opacity', l =>
            l.source.id === d.id || l.target.id === d.id ? 0.7 : 0.3);

        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
            `<div style="font-weight:700;margin-bottom:6px;font-family:Space Grotesk;font-size:13px">${d.id}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px">
              <span style="color:#8b8b9e">PageRank</span>
              <span style="color:#e8a849;font-family:JetBrains Mono;font-weight:600">${d.pagerank.toFixed(4)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;margin-top:2px">
              <span style="color:#8b8b9e">Community</span>
              <span style="display:flex;align-items:center;gap:4px">
                <span style="width:6px;height:6px;border-radius:50%;background:${color}"></span>${d.community}
              </span>
            </div>`)
          .style('left', (e.pageX + 16) + 'px')
          .style('top', (e.pageY - 16) + 'px');
      })
      .on('mouseout', function(e, d) {
        d3.select(this)
          .transition().duration(200)
          .attr('r', d.radius)
          .attr('stroke', 'rgba(0,0,0,0.2)')
          .attr('stroke-width', 0.5)
          .attr('stroke-opacity', 1);

        link.transition().duration(200)
          .attr('stroke', 'rgba(255,255,255,0.035)')
          .attr('stroke-width', d => Math.min(d.weight, 3))
          .attr('stroke-opacity', 1);

        tooltip.transition().duration(200).style('opacity', 0);
      })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Labels
    const topNodes = nodes.sort((a, b) => b.pagerank - a.pagerank).slice(0, 12);
    g.selectAll('text')
      .data(topNodes).enter().append('text')
      .attr('font-size', '8px')
      .attr('font-family', 'Space Grotesk, sans-serif')
      .attr('font-weight', '500')
      .attr('fill', '#8b8b9e')
      .attr('text-anchor', 'middle')
      .attr('dy', d => -d.radius - 6)
      .text(d => d.id.length > 14 ? d.id.slice(0, 14) + '…' : d.id);

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('background', 'rgba(12, 12, 15, 0.95)')
      .style('backdrop-filter', 'blur(24px)')
      .style('border', '1px solid rgba(232,168,73,0.15)')
      .style('border-radius', '14px')
      .style('padding', '12px 16px')
      .style('font-size', '12px')
      .style('font-family', 'Space Grotesk, sans-serif')
      .style('color', '#ececf1')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000)
      .style('box-shadow', '0 12px 40px rgba(0,0,0,0.5)')
      .style('min-width', '140px');

    // Animate nodes appearing
    node.attr('r', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 2)
      .ease(d3.easeBackOut.overshoot(1.5))
      .attr('r', d => d.radius);

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('cx', d => d.x).attr('cy', d => d.y);
      g.selectAll('text').attr('x', d => d.x).attr('y', d => d.y - d.radius - 4);
    });

    return () => tooltip.remove();
  };

  const fetchSummary = async () => {
    if (!data) return;
    setSummaryLoading(true);
    try {
      const res = await getSummary('network', {
        query,
        remove_top_n: removeTopN,
        num_nodes: data.stats.num_nodes,
        num_edges: data.stats.num_edges,
        num_communities: data.stats.num_communities,
        removed_nodes: data.stats.removed_nodes || [],
        top_influencer: data.top_influencers?.[0]?.id,
        top_5: data.top_influencers?.slice(0, 5).map(n => ({ id: n.id, pagerank: n.pagerank, community: n.community })),
      });
      setSummary(res.data.summary);
    } catch { setSummary('Summary unavailable.'); }
    setSummaryLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading network...</p></div>;
  if (!data || !data.nodes.length) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header"><h2>Network Analysis</h2></div>
      <div className="error-message">Not enough interaction data to build a network.</div>
    </motion.div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div className="page-header" variants={slideUp}>
        <h2>Network Analysis</h2>
        <p>Who is driving the conversation — <span className="serif-accent">influence network with PageRank</span></p>
      </motion.div>

      <motion.div className="search-bar" style={{ marginBottom: 'var(--space-md)', maxWidth: 760 }} variants={slideUp}>
        <span className="search-icon"><SearchIcon size={18} /></span>
        <input
          type="text"
          placeholder="Filter network by keyword, phrase, or URL..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={handleQueryKeyDown}
          id="network-query-input"
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

      <motion.div
        className="network-stress-control"
        variants={slideUp}
        style={{ marginBottom: 'var(--space-lg)', '--stress-progress': stressProgress }}
      >
        <div className="network-stress-head">
          <div>
            <div className="network-stress-title">Stress Test: Remove top PageRank nodes</div>
            <div className="network-stress-subtitle">Probe graph robustness by dropping high-influence nodes.</div>
          </div>
          <span className="network-stress-value">{removeTopN}</span>
        </div>
        <input
          className="network-stress-slider"
          type="range"
          min="0"
          max="5"
          step="1"
          value={removeTopN}
          onChange={(e) => setRemoveTopN(parseInt(e.target.value, 10))}
          id="network-remove-top-n-slider"
          aria-label="Remove top PageRank nodes"
        />
        <div className="network-stress-scale">
          <span>0 = baseline</span>
          <span>5 = maximum stress</span>
        </div>
      </motion.div>

      <div className="network-flags" style={{ marginBottom: 'var(--space-lg)' }}>
        <AnimatePresence>
          {query && (
            <motion.div className="warning-badge network-flag" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              Filter: "{query}"
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {data?.stats?.removed_nodes?.length > 0 && (
            <motion.div className="warning-badge network-flag" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              Removed influencers: {data.stats.removed_nodes.join(', ')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} variants={container}>
        {[
          { label: 'Nodes', value: data.stats.num_nodes, icon: '◉' },
          { label: 'Edges', value: data.stats.num_edges, icon: '⟶' },
          { label: 'Communities', value: data.stats.num_communities, icon: '◈' },
          { label: 'Components', value: data.stats.num_components, icon: '⬡' },
        ].map((stat) => (
          <motion.div key={stat.label} className="stat-card" variants={slideUp}
            whileHover={{ y: -8, scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 15 } }}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value?.toLocaleString()}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-lg)' }} variants={slideUp}>
        <div>
          <div className="network-container" style={{ marginBottom: 'var(--space-md)' }}>
            <svg ref={svgRef} style={{ background: 'var(--bg-surface)' }} />
          </div>
          <motion.button className="btn btn-primary" onClick={fetchSummary} disabled={summaryLoading}
            style={{ marginBottom: 'var(--space-md)' }}
            whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}>
            {summaryLoading ? <span className="ai-thinking-dots"><span /><span /><span /></span> : <><Sparkles size={14} /> Analyze</>}
          </motion.button>
          <AnimatePresence>
            {summary && (
              <motion.div className="summary-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <div className="summary-header"><Lightbulb size={14} /> AI Analysis</div>
                <div className="summary-text">{summary}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div className="card" style={{ maxHeight: 620, overflow: 'auto' }} variants={slideUp}>
          <div className="card-header">
            <span className="card-title" style={{display:'flex',alignItems:'center',gap:8}}><Trophy size={16} /> Top Influencers</span>
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>User</th><th>PageRank</th><th>Comm.</th></tr></thead>
            <tbody>
              {data.top_influencers.map((node, i) => (
                <motion.tr
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
                  whileHover={{ x: 4, backgroundColor: 'rgba(232,168,73,0.04)' }}
                >
                  <td style={{ fontWeight: 800, color: i < 3 ? 'var(--accent-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {i < 3 ? [<Award size={14} key="g" style={{color:'var(--accent-primary)'}} />, <Medal size={14} key="s" style={{color:'#a0a0a0'}} />, <Medal size={14} key="b" style={{color:'#cd7f32'}} />][i] : String(i + 1).padStart(2, '0')}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{node.id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>{node.pagerank.toFixed(4)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length],
                      marginRight: 6, boxShadow: `0 0 8px ${COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length]}30`
                    }} />
                    {node.community}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {selectedNode && (
          <motion.div className="card" style={{ marginTop: 'var(--space-lg)' }}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="card-header">
              <span className="card-title" style={{display:'flex',alignItems:'center',gap:8}}><User size={16} /> {selectedNode.id}</span>
              <motion.button className="btn btn-ghost" onClick={() => setSelectedNode(null)} whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}><X size={16} /></motion.button>
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div><div className="stat-label">PageRank</div><div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>{selectedNode.pagerank.toFixed(6)}</div></div>
              <div><div className="stat-label">Community</div><div style={{ fontWeight: 600 }}>{selectedNode.community}</div></div>
              <div><div className="stat-label">In-Degree</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedNode.in_degree}</div></div>
              <div><div className="stat-label">Out-Degree</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedNode.out_degree}</div></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default NetworkAnalysis;
