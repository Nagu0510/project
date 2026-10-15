import React, { useState, useEffect, useMemo } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Sparkles, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { CareerCard } from '../components/shared/CareerCard';
import { careerService } from '../services/careerService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DOMAIN_OPTIONS = [
  'All Domains',
  'Software Engineering',
  'Web Development',
  'Data & Analytics',
  'AI & Machine Learning',
  'Cloud & DevOps',
];

export const CareerPathsPage = () => {
  const { user, isAuthenticated, updateUserProfile, requireAuth } = useAuth();
  const { addToast } = useToast();

  const [careerPaths, setCareerPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [selectedTrackId, setSelectedTrackId] = useState(user?.currentPath || '');

  useEffect(() => {
    let isMounted = true;
    const fetchPaths = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const paths = await careerService.getCareerPaths();
        if (isMounted && Array.isArray(paths) && paths.length > 0) {
          setCareerPaths(paths);
          if (user?.currentPath) {
            const matched = paths.find(
              (p) => p.title === user.currentPath || p.id === user.currentPath || p.slug === user.currentPath
            );
            if (matched) setSelectedTrackId(matched.id);
          }
        }
      } catch (err) {
        if (isMounted) setLoadError(err?.message || 'Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPaths();
    return () => {
      isMounted = false;
    };
  }, [user?.currentPath, reloadKey]);

  // Filter paths by search query and domain
  const filteredPaths = useMemo(() => {
    return careerPaths.filter((path) => {
      const q = searchQuery.toLowerCase().trim();
      const title = (path.title || path.name || '').toLowerCase();
      const desc = (path.description || '').toLowerCase();
      const skills = (path.required_skills || path.skills || []).join(' ').toLowerCase();

      const matchesSearch = !q || title.includes(q) || desc.includes(q) || skills.includes(q);

      let matchesDomain = true;
      if (selectedDomain === 'Software Engineering') {
        matchesDomain = title.includes('java') || title.includes('python') || title.includes('backend');
      } else if (selectedDomain === 'Web Development') {
        matchesDomain = title.includes('front') || title.includes('full');
      } else if (selectedDomain === 'Data & Analytics') {
        matchesDomain = title.includes('data');
      } else if (selectedDomain === 'AI & Machine Learning') {
        matchesDomain = title.includes('ai') || title.includes('machine');
      } else if (selectedDomain === 'Cloud & DevOps') {
        matchesDomain = title.includes('cloud') || title.includes('devops');
      }

      return matchesSearch && matchesDomain;
    });
  }, [careerPaths, searchQuery, selectedDomain]);

  const handleChooseTrack = async (path) => {
    if (!path) return;
    const targetTitle = path.title || path.name || 'Backend Developer';
    const targetId = path.id || path.slug || 'backend';

    return new Promise((resolve, reject) => {
      requireAuth(async () => {
        try {
          await careerService.selectCareerPath(targetId, targetTitle);
          updateUserProfile({
            currentPath: targetTitle,
            careerInterest: targetTitle,
            careerGoal: targetTitle,
          });
          setSelectedTrackId(targetId);
          addToast(`Target track updated to ${targetTitle}! Roadmap calibrated.`, 'success');
          resolve(true);
        } catch (err) {
          console.warn('Track selection fallback:', err);
          updateUserProfile({
            currentPath: targetTitle,
            careerInterest: targetTitle,
          });
          setSelectedTrackId(targetId);
          addToast(`Selected ${targetTitle}`, 'info');
          resolve(true);
        }
      }, '/career-paths');
    });
  };

  const userSkills = user?.strongSkills || user?.skills || [];

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 6rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1280px', margin: '0 auto' }}>
          {loadError && <ErrorBanner title="Career paths could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: '2.5rem' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-emerald)', fontSize: '0.9rem' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-emerald)' }}>
                Target Career Path Selection
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.25rem, 4vw, 3.25rem)',
                fontWeight: 400,
                color: 'var(--color-forest)',
                margin: '0 0 0.5rem 0',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Explore Career Paths
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '640px', lineHeight: 1.6 }}>
              Discover the perfect path for your skills and goals.
            </p>
          </motion.div>

          {/* Search & Domain Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-2xl)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Search Bar Input */}
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search
                size={18}
                color="var(--color-text-subtle)"
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search career paths, skills, domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: '2.75rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-ivory-soft)',
                  fontSize: '0.9375rem',
                }}
              />
            </div>

            {/* Domain Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-white)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'var(--color-forest)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-outline"
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', borderColor: 'var(--color-border-medium)' }}
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDomain('All Domains');
                }}
              >
                <SlidersHorizontal size={15} style={{ marginRight: '4px' }} />
                Reset
              </button>
            </div>
          </motion.div>

          {/* Loading Grid Skeleton */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: '320px', borderRadius: 'var(--radius-2xl)' }}
                />
              ))}
            </div>
          )}

          {/* 2-COLUMN RESPONSIVE CAREER CARDS GRID */}
          {!loading && (
            <>
              {filteredPaths.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1.5rem',
                  }}
                  className="career-paths-2col-grid"
                >
                  {filteredPaths.map((path, idx) => (
                    <CareerCard
                      key={path.id || path.slug || idx}
                      path={path}
                      index={idx}
                      isSelected={
                        selectedTrackId === path.id ||
                        selectedTrackId === path.slug ||
                        (user?.currentPath && user.currentPath.toLowerCase() === (path.title || '').toLowerCase())
                      }
                      onChooseTrack={handleChooseTrack}
                      userSkills={userSkills}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'var(--color-white)',
                    borderRadius: 'var(--radius-2xl)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <Sparkles size={36} color="var(--color-emerald)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-forest)', margin: '0 0 0.5rem 0' }}>
                    No matching career tracks found
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    Try adjusting your search terms or domain filter.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedDomain('All Domains');
                    }}
                  >
                    View All Career Paths
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 900px) {
          .career-paths-2col-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CareerPathsPage;
