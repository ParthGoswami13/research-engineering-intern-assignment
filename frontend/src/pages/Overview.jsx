import { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  GitBranch,
  Minus,
  Radar,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDashboard } from '../api/client';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const slideUp = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const TOPIC_COLORS = ['#e8a849', '#34d399', '#fb7185', '#22d3ee', '#a78bfa', '#f97316', '#fbbf24'];

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }
  return Number(value).toLocaleString();
}

function formatPct(value) {
  const number = Number(value || 0);
  return `${number.toFixed(1)}%`;
}

function formatSignedPct(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(1)}%`;
}

function CountUpValue({ value, decimals = 0, durationMs = 900 }) {
  const numeric = Number(value);
  const target = Number.isFinite(numeric) ? numeric : 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startTs;

    const tick = (timestamp) => {
      if (startTs === undefined) {
        startTs = timestamp;
      }

      const progress = Math.min((timestamp - startTs) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  if (decimals > 0) {
    return (
      <>
        {displayValue.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </>
    );
  }

  return <>{Math.round(displayValue).toLocaleString()}</>;
}

function TrendGlyph({ trend }) {
  if (trend === 'up') {
    return <ArrowUpRight size={14} />;
  }
  if (trend === 'down') {
    return <ArrowDownRight size={14} />;
  }
  return <Minus size={14} />;
}

function OverviewTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="overview-tooltip">
      <div className="overview-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="overview-tooltip-row">
          <span className="overview-tooltip-key">{entry.name}</span>
          <span className="overview-tooltip-value">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    getDashboard()
      .then((res) => {
        if (!isMounted) {
          return;
        }
        setDashboard(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        setError(err.response?.data?.detail || err.message || 'Failed to load dashboard');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading evidence deck...</p>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!dashboard) {
    return <div className="error-message">No dashboard payload available.</div>;
  }

  const summary = dashboard.summary || {};
  const dateRange = summary.date_range || {};
  const communitySpread = dashboard.community_spread || [];
  const weeklyActivity = dashboard.weekly_activity || [];
  const momentum = dashboard.platform_momentum || [];
  const rhythm = dashboard.dataset_rhythm || {};
  const turnSignals = dashboard.turn_signals || [];
  const topics = dashboard.topics || { distribution: [] };
  const networkHealth = dashboard.network_health || {};
  const evidence = dashboard.evidence || {};
  const weeklyActivitySummary = dashboard.weekly_activity_summary || '';

  const summaryCards = [
    { label: 'Total Posts', value: Number(summary.total_posts || 0), decimals: 0, sub: `${summary.unique_subreddits || 0} communities` },
    { label: 'Unique Authors', value: Number(summary.unique_authors || 0), decimals: 0, sub: `${summary.crossposts || 0} crossposts` },
    { label: 'Date Span', value: Number(dateRange.span_days || 0), decimals: 0, sub: `${dateRange.start || '-'} -> ${dateRange.end || '-'}` },
    { label: 'Avg Score', value: Number(summary.avg_score || 0), decimals: 1, sub: `Comments: ${formatNumber(summary.total_comments || 0)}` },
  ];

  const momentumMax = Math.max(1, ...momentum.map((item) => item.recent_posts || 0));

  const communityChart = communitySpread.slice(0, 8).map((item) => ({
    ...item,
    label: `r/${item.subreddit}`,
  }));

  const weeklyChart = weeklyActivity.slice(-18);

  const topicChart = (topics.distribution || []).slice(0, 6).map((item) => ({
    name: item.label,
    value: item.count,
    share: item.share_pct,
  }));

  const componentChart = (networkHealth.components || []).map((component) => ({
    name: component.label,
    size: component.size,
  }));

  const hasRhythmChart = weeklyChart.length > 1;
  const rhythmShift = Number(rhythm.recent_2w_change_pct || 0);
  const rhythmCadence = rhythm.cadence || 'steady';

  return (
    <Motion.div variants={container} initial="hidden" animate="show">
      <Motion.div className="page-header" variants={slideUp}>
        <h2>Overview</h2>
        <p>
          Evidence-first dashboard powered directly by dataset behavior across communities,
          weekly movement, cluster narratives, and network structure.
        </p>
      </Motion.div>

      <Motion.div className="stats-grid overview-stat-grid" variants={container}>
        {summaryCards.map((card) => (
          <Motion.div
            key={card.label}
            className="stat-card overview-stat-card"
            variants={slideUp}
            whileHover={{ y: -6, scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">
              <CountUpValue value={card.value} decimals={card.decimals} />
            </div>
            <div className="stat-sub">{card.sub}</div>
          </Motion.div>
        ))}
      </Motion.div>

      <Motion.div className="overview-evidence-grid" variants={container}>
        <Motion.div className="card overview-evidence-card" variants={slideUp} whileHover={{ y: -4 }}>
          <div className="card-header">
            <span className="card-title">Platform Momentum</span>
            <span className="overview-evidence-icon"><Radar size={16} /></span>
          </div>
          <p className="overview-evidence-summary">
            {evidence.platform_momentum?.summary || 'Momentum evidence unavailable.'}
          </p>
          <div className="overview-momentum-list">
            {momentum.slice(0, 5).map((item) => (
              <div key={item.subreddit} className="overview-momentum-item">
                <div className="overview-momentum-head">
                  <span className="overview-chip">r/{item.subreddit}</span>
                  <span className={`overview-trend-chip ${item.trend}`}>
                    <TrendGlyph trend={item.trend} />
                    {item.delta_posts > 0 ? '+' : ''}{item.delta_posts}
                  </span>
                </div>
                <div className="overview-momentum-subrow">
                  <span>Recent: {item.recent_posts}</span>
                  <span>Prev: {item.previous_posts}</span>
                  <span>{formatPct(item.delta_pct)}</span>
                </div>
                <div className="overview-momentum-track">
                  <div
                    className="overview-momentum-fill"
                    style={{ width: `${(item.recent_posts / momentumMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!momentum.length && (
              <div className="overview-turn-empty">No momentum windows available yet.</div>
            )}
          </div>
        </Motion.div>

        <Motion.div className="card overview-evidence-card" variants={slideUp} whileHover={{ y: -4 }}>
          <div className="card-header">
            <span className="card-title">Dataset Rhythm</span>
            <span className="overview-evidence-icon"><Gauge size={16} /></span>
          </div>
          <p className="overview-evidence-summary">
            {evidence.dataset_rhythm?.summary || 'Rhythm evidence unavailable.'}
          </p>
          <div className="overview-rhythm-body">
            <div className="overview-rhythm-metrics">
              <div className="overview-mini-metric">
                <span className="overview-mini-label">Avg / Week</span>
                <span className="overview-mini-value">{formatNumber(rhythm.avg_posts_per_week)}</span>
              </div>
              <div className="overview-mini-metric">
                <span className="overview-mini-label">Volatility</span>
                <span className="overview-mini-value">{formatPct(rhythm.volatility_pct)}</span>
              </div>
              <div className="overview-mini-metric">
                <span className="overview-mini-label">2W Shift</span>
                <span className={`overview-mini-value ${rhythmShift >= 0 ? 'up' : 'down'}`}>
                  {formatSignedPct(rhythmShift)}
                </span>
              </div>
            </div>

            {hasRhythmChart ? (
              <div className="overview-mini-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChart}>
                    <defs>
                      <linearGradient id="overviewRhythmFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e8a849" stopOpacity={0.38} />
                        <stop offset="95%" stopColor="#e8a849" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} hide />
                    <Tooltip content={<OverviewTooltip />} />
                    <Area type="monotone" dataKey="posts" name="Posts" stroke="#e8a849" fill="url(#overviewRhythmFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overview-mini-chart-empty">
                Limited weekly points right now. This rhythm chart expands automatically as more weeks are available.
              </div>
            )}

            <div className="overview-rhythm-footnote">
              <span className="overview-network-pill">Cadence: {rhythmCadence}</span>
              <span className="overview-network-pill">Last week: {formatNumber(rhythm.last_week_posts)}</span>
              <span className="overview-network-pill">Prev week: {formatNumber(rhythm.previous_week_posts)}</span>
            </div>
          </div>
        </Motion.div>

        <Motion.div className="card overview-evidence-card" variants={slideUp} whileHover={{ y: -4 }}>
          <div className="card-header">
            <span className="card-title">Turn Signals</span>
            <span className="overview-evidence-icon"><AlertTriangle size={16} /></span>
          </div>
          <p className="overview-evidence-summary">
            {evidence.turn_signals?.summary || 'Turn signal evidence unavailable.'}
          </p>
          <div className="overview-turn-list">
            {turnSignals.map((signal) => (
              <div key={`${signal.week}-${signal.signal}`} className="overview-turn-item">
                <span className={`overview-turn-type ${signal.signal}`}>
                  {signal.signal === 'surge' ? 'Surge' : 'Drop'}
                </span>
                <span className="overview-turn-week">{signal.week}</span>
                <span className="overview-turn-change">{signal.change_pct > 0 ? '+' : ''}{signal.change_pct}%</span>
              </div>
            ))}
            {!turnSignals.length && (
              <div className="overview-turn-empty">No sharp directional turns detected.</div>
            )}
          </div>
        </Motion.div>
      </Motion.div>

      <Motion.div className="overview-charts-grid" variants={container}>
        <Motion.div className="chart-container overview-panel" variants={slideUp}>
          <div className="card-header">
            <span className="card-title">Community Spread</span>
            <span className="overview-panel-meta">Top communities by share</span>
          </div>
          <div className="overview-panel-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={communityChart} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={102} />
                <Tooltip content={<OverviewTooltip />} />
                <Bar dataKey="posts" name="Posts" fill="#34d399" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Motion.div>

        <Motion.div className="chart-container overview-panel" variants={slideUp}>
          <div className="card-header">
            <span className="card-title">Weekly Activity</span>
            <span className="overview-panel-meta">Posts and active authors over time</span>
          </div>
          <div className="overview-panel-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyChart} margin={{ top: 8, right: 12, left: -12, bottom: 6 }}>
                <defs>
                  <linearGradient id="overviewWeekFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e8a849" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#e8a849" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip content={<OverviewTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="posts" name="Posts" stroke="#e8a849" fill="url(#overviewWeekFill)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="active_authors" name="Active Authors" stroke="#22d3ee" dot={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="overview-panel-summary">
            {weeklyActivitySummary}
          </p>
        </Motion.div>

        <Motion.div className="chart-container overview-panel" variants={slideUp}>
          <div className="card-header">
            <span className="card-title">Topic Clusters</span>
            <span className="overview-panel-meta">K={topics.k || 0} representative narrative groups</span>
          </div>
          <div className="overview-topic-layout">
            <div className="overview-topic-pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topicChart}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={86}
                    innerRadius={44}
                    paddingAngle={2}
                  >
                    {topicChart.map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={TOPIC_COLORS[idx % TOPIC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<OverviewTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="overview-topic-list">
              {(topics.distribution || []).slice(0, 4).map((cluster) => (
                <div key={cluster.cluster_id} className="overview-topic-item">
                  <div className="overview-topic-title">{cluster.label}</div>
                  <div className="overview-topic-meta">
                    <span>{cluster.count} posts</span>
                    <span>{formatPct(cluster.share_pct)}</span>
                  </div>
                  <div className="overview-topic-signal">
                    {(cluster.representative_signals || [])[0] || 'No representative signal available.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Motion.div>

        <Motion.div className="chart-container overview-panel" variants={slideUp}>
          <div className="card-header">
            <span className="card-title">Network Health</span>
            <span className="overview-panel-meta">Structural integrity and influence concentration</span>
          </div>
          <div className="overview-network-metrics">
            <div className="overview-network-pill"><Users size={13} /> {formatNumber(networkHealth.num_nodes)} nodes</div>
            <div className="overview-network-pill"><GitBranch size={13} /> {formatNumber(networkHealth.num_components)} components</div>
            <div className="overview-network-pill"><Activity size={13} /> {formatPct(networkHealth.top5_pagerank_share_pct)} top-5 share</div>
          </div>
          <div className="overview-panel-chart overview-network-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={componentChart} margin={{ top: 8, right: 8, left: -10, bottom: 6 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<OverviewTooltip />} />
                <Bar dataKey="size" name="Component Size" fill="#fb7185" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overview-influencer-row">
            {(networkHealth.top_influencers || []).slice(0, 4).map((node) => (
              <div key={node.id} className="overview-influencer-item">
                <span className="overview-influencer-id">{node.id}</span>
                <span className="overview-influencer-score">{node.pagerank.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </Motion.div>
      </Motion.div>
    </Motion.div>
  );
}

export default Overview;




