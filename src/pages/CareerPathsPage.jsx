import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { CareerCard } from '../components/shared/CareerCard';
import { mockCareerPaths } from '../data/mockCareerPaths';
import { careerService } from '../services/careerService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { normalizeCareerPathList } from '../utils/normalizers';
import { Sparkles, Compass, Target, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CareerPathsPage = () => {
  const { user, isAuthenticated, updateUserProfile, requireAuth } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [careerPaths, setCareerPaths] = useState(() => normalizeCareerPathList(mockCareerPaths));
  const [loading, setLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(
    user?.currentPath ? (mockCareerPaths.find((p) => p.title === user.currentPath)?.id || 'backend') : 'backend'
  );

  useEffect(() => {
    let isMounted = true;
    const fetchPaths = async () => {
      setLoading(true);
      try {
        const paths = await careerService.getCareerPaths();
        if (isMounted) {
          if (Array.isArray(paths) && paths.length > 0) {
            setCareerPaths(paths);
            if (user?.currentPath) {
              const matched = paths.find((p) => p.title === user.currentPath);
              if (matched) setSelectedPathId(matched.id);
            }
          }
        }
      } catch (err) {
        console.warn("Using default career paths", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPaths();
    return () => {
      isMounted = false;
    };
  }, [user?.currentPath]);

  const safePaths = Array.isArray(careerPaths) ? careerPaths : [];
  const activePath = safePaths.find((p) => p.id === selectedPathId) || safePaths[0] || normalizeCareerPathList(mockCareerPaths)[0];

  const handleSelectPath = (pathId) => {
    setSelectedPathId(pathId);
  };

  const handleConfirmPath = async (path) => {
    if (!path) return;
    requireAuth(async () => {
      try {
        await careerService.selectCareerPath(path.id, path.title);
      } catch (e) {
        console.warn("Backend career save fallback:", e);
      }
      updateUserProfile({
        currentPath: path.title,
        careerInterest: path.title,
      });
      addToast(`Target career path set to ${path.title}!`, 'success');
      navigate('/roadmap');
    }, '/career-paths');
  };

  const activeSkills = Array.isArray(activePath?.requiredSkills)
    ? activePath.requiredSkills
    : Array.isArray(activePath?.skills)
    ? activePath.skills
    : ["Python", "FastAPI", "SQL", "REST APIs"];

  const activeCompanies = Array.isArray(activePath?.topCompanies)
    ? activePath.topCompanies
    : ["TCS Prime", "Amazon", "Infosys", "Accenture", "Capgemini"];

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {/* Guest Preview Banner */}
          {!isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--color-lime-soft)',
                border: '1px solid rgba(6, 46, 37, 0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.85rem 1.25rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span><strong>Public Preview Mode:</strong> Explore career pathways and skill requirements freely. Sign in to save your target path.</span>
              </div>
              <Button variant="primary" size="sm" onClick={() => requireAuth(null, '/career-paths')}>
                Sign In to Save Path
              </Button>
            </div>
          )}

          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                Target Specialization Engine
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                color: 'var(--color-deep-forest)',
                margin: 0,
              }}
            >
              Explore & Select Your Career Path
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
              Choose a target career track. SkillSense AI will calibrate your winding roadmaps and diagnostic placement tests accordingly.
            </p>
          </div>

          {/* CAREER TRACKS GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem',
            }}
          >
            {safePaths.map((path) => (
              <CareerCard
                key={path.id}
                career={path}
                path={path}
                isSelected={selectedPathId === path.id}
                onSelect={() => handleSelectPath(path.id)}
              />
            ))}
          </div>

          {/* ACTIVE TRACK SPOTLIGHT & CONFIRMATION */}
          {activePath && (
            <div
              className="card-static"
              style={{
                padding: '2.25rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-2xl)',
                border: '1.5px solid rgba(15, 118, 110, 0.25)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.35rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                      {activePath.title}
                    </h3>
                    <Badge variant="lime">{activePath.matchPercentage || activePath.matchScore || 87}% Alignment</Badge>
                  </div>
                  <div style={{ fontSize: '0.885rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                    Estimated Entry Level: {activePath.averageSalary || activePath.avgSalary || "₹ 11.2 LPA"} · {activePath.activeOpenings || 120} Active Drives
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleConfirmPath(activePath)}
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Choose This Career Path
                </Button>
              </div>

              <p style={{ fontSize: '0.95rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {activePath.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '8px' }}>
                    Core Required Skills
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {activeSkills.map((s) => (
                      <span
                        key={s}
                        style={{
                          backgroundColor: 'var(--color-ivory-surface)',
                          border: '1px solid var(--color-border-medium)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: 'var(--color-deep-forest)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '8px' }}>
                    Top Hiring Companies
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {activeCompanies.map((c) => (
                      <span
                        key={c}
                        style={{
                          backgroundColor: 'rgba(15, 118, 110, 0.08)',
                          border: '1px solid rgba(15, 118, 110, 0.2)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          color: 'var(--color-emerald)',
                        }}
                      >
                        ✦ {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CareerPathsPage;
