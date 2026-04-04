import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Globe, Search, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import Overview from './pages/Overview';
import TrendAnalysis from './pages/TrendAnalysis';
import NetworkAnalysis from './pages/NetworkAnalysis';
import SemanticSearch from './pages/SemanticSearch';
import TopicExplorer from './pages/TopicExplorer';
import { Toaster } from 'react-hot-toast';
import './App.css';

const navItems = [
  { to: '/', label: 'Overview', icon: BarChart3, end: true },
  { to: '/trends', label: 'Trend Analysis', icon: TrendingUp },
  { to: '/network', label: 'Network Analysis', icon: Globe },
  { to: '/search', label: 'Semantic Search', icon: Search },
  { to: '/topics', label: 'Topic Explorer', icon: Layers },
];

const sidebarVariants = {
  hidden: { x: -260, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  },
  collapsed: {
    x: -260,
    opacity: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  }
};

const navItemVariants = {
  hidden: { x: -30, opacity: 0 },
  visible: (i) => ({
    x: 0,
    opacity: 1,
    transition: {
      delay: 0.4 + i * 0.1,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1]
    }
  })
};

const pageVariants = {
  initial: {
    opacity: 0,
    y: 30,
    scale: 0.98,
    filter: 'blur(6px)'
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.05
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    filter: 'blur(6px)',
    transition: { duration: 0.35 }
  }
};

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    restDelta: 0.001
  });

  return <motion.div className="scroll-progress" style={{ scaleX }} />;
}

function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [textInput, setTextInput] = useState(false);

  const updateCursor = useCallback(() => {
    // Ring follows with smooth lag
    ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.15;
    ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.15;

    if (dotRef.current) {
      dotRef.current.style.left = mousePos.current.x + 'px';
      dotRef.current.style.top = mousePos.current.y + 'px';
    }
    if (ringRef.current) {
      ringRef.current.style.left = ringPos.current.x + 'px';
      ringRef.current.style.top = ringPos.current.y + 'px';
    }
    if (glowRef.current) {
      glowRef.current.style.left = ringPos.current.x + 'px';
      glowRef.current.style.top = ringPos.current.y + 'px';
    }

    rafRef.current = requestAnimationFrame(updateCursor);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);

      // Detect hover on interactive elements
      const target = e.target;
      const isInteractive = target.closest('a, button, [role="button"], .nav-link, .stat-card, .result-card, .cluster-card, .toggle-pill, .btn');
      const isTextInput = target.closest('input[type="text"], input[type="search"], textarea');

      setHovering(!!isInteractive);
      setTextInput(!!isTextInput);
    };

    const handleMouseDown = () => setClicking(true);
    const handleMouseUp = () => setClicking(false);
    const handleMouseLeave = () => setVisible(false);
    const handleMouseEnter = () => setVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    rafRef.current = requestAnimationFrame(updateCursor);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, updateCursor]);

  const dotCls = `cursor-dot${hovering ? ' hovering' : ''}${textInput ? ' text-cursor' : ''}`;
  const ringCls = `cursor-ring${hovering ? ' hovering' : ''}${clicking ? ' clicking' : ''}${textInput ? ' text-cursor' : ''}`;

  return (
    <>
      <div ref={dotRef} className={dotCls} style={{ opacity: visible ? 1 : 0 }} />
      <div ref={ringRef} className={ringCls} style={{ opacity: visible ? 1 : 0 }} />
      <div ref={glowRef} className="cursor-glow" style={{ opacity: visible ? 1 : 0 }} />
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Routes location={location}>
          <Route path="/" element={<Overview />} />
          <Route path="/trends" element={<TrendAnalysis />} />
          <Route path="/network" element={<NetworkAnalysis />} />
          <Route path="/search" element={<SemanticSearch />} />
          <Route path="/topics" element={<TopicExplorer />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 1024;
  });

  return (
    <Router>
      <div className="app">
        {/* Dot grid background */}
        <div className="grid-bg" />

        {/* Custom cursor */}
        <CustomCursor />

        {/* Scroll progress */}
        <ScrollProgress />

        <motion.button
          type="button"
          className={`sidebar-toggle ${isSidebarOpen ? 'open' : 'closed'}`}
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          aria-label={isSidebarOpen ? 'Hide left panel' : 'Show left panel'}
          aria-pressed={isSidebarOpen}
          title={isSidebarOpen ? 'Hide left panel' : 'Show left panel'}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileTap={{ scale: 0.94 }}
        >
          {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </motion.button>

        {/* Sidebar */}
        <motion.aside
          className={`sidebar ${isSidebarOpen ? 'open' : 'collapsed'}`}
          variants={sidebarVariants}
          initial="hidden"
          animate={isSidebarOpen ? 'visible' : 'collapsed'}
        >
          <motion.div
            className="sidebar-logo"
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1>NarrativeTrace</h1>
            <p>Social Media Intelligence</p>
          </motion.div>

          <nav className="sidebar-nav">
            {navItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.to}
                  custom={i}
                  variants={navItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} strokeWidth={2} className="nav-icon" />
                    {item.label}
                  </NavLink>
                </motion.div>
              );
            })}
          </nav>

          <motion.div
            className="sidebar-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
          >
            <p>Built for SimPPL</p>
          </motion.div>
        </motion.aside>

        <main className={`main-content ${isSidebarOpen ? '' : 'expanded'}`}>
          <AnimatedRoutes />
        </main>

        {/* Toast Notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#16161b',
              color: '#ececf1',
              border: '1px solid rgba(232,168,73,0.15)',
              borderRadius: '16px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '0.85rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
