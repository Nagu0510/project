import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import { roadmapService } from '../services/roadmapService';
import { CareerRoad3D } from '../components/three/CareerRoad3D';
import {
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Code2,
  BookOpen,
  Check,
  Target,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const CAREER_TRACKS = [
  'Backend Developer',
  'Frontend Developer',
  'Full Stack Developer',
  'Python Developer',
  'Java Developer',
  'Data Analyst',
  'Data Scientist',
  'AI / Machine Learning Engineer',
  'Cloud / DevOps Engineer',
];

export const RoadmapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, requireAuth, updateUserProfile } = useAuth();
  const { addToast } = useToast();

  const queryTrack = searchParams.get('track') || searchParams.get('career') || searchParams.get('career_path');
  const [selectedTrack, setSelectedTrack] = useState(queryTrack || user?.currentPath || user?.careerInterest || 'Backend Developer');
  const [selectedNode, setSelectedNode] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const careerTitle = selectedTrack;

  const fetchRoadmap = async (track = selectedTrack) => {
    setLoading(true);
    try {
      const data = await roadmapService.getRoadmap(track);
      setRoadmapData(data);
    } catch (err) {
      console.error('Failed to load roadmap:', err);
      addToast('Failed to load roadmap. Displaying resilient fallback.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryTrack && queryTrack !== selectedTrack) {
      setSelectedTrack(queryTrack);
    }
  }, [queryTrack]);

  useEffect(() => {
    fetchRoadmap(selectedTrack);
  }, [selectedTrack, isAuthenticated]);

  const handleTrackChange = (newTrack) => {
    setSelectedTrack(newTrack);
    setSearchParams({ track: newTrack });
    if (isAuthenticated) {
      updateUserProfile({ currentPath: newTrack, careerInterest: newTrack });
    }
  };

  const milestones = roadmapData?.milestones || [];
  const currentMilestoneNum = roadmapData?.currentMilestone || 3;
  const completionPercentage = roadmapData?.completionPercentage || 0;

  const handleStatusChange = async (milestoneId, newStatus) => {
    setUpdatingId(milestoneId);
    try {
      await roadmapService.updateProgress(milestoneId, newStatus);
      addToast(`Milestone updated to ${newStatus.replace('_', ' ')}!`, 'success');
      // Update locally
      setRoadmapData((prev) => {
        if (!prev) return prev;
        const nextMilestones = prev.milestones.map((m) =>
          m.id === milestoneId ? { ...m, status: newStatus } : m
        );
        const completedCount = nextMilestones.filter((m) => m.status === 'completed').length;
        const newPct = Math.round((completedCount / nextMilestones.length) * 100);
        return {
          ...prev,
          completionPercentage: newPct,
          milestones: nextMilestones,
        };
      });
      if (selectedNode && selectedNode.id === milestoneId) {
        setSelectedNode((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      addToast(err.message || 'Failed to update milestone progress', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

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
                padding: '1rem 1.5rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-deep-forest)' }}>
                  ✦ Interactive Career Roadmap Preview
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginTop: '2px' }}>
                  Explore milestones for any of the 9 career tracks. Create a free account to track your progress and highlight personalized skill gaps.
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() => requireAuth(null, `/roadmap?track=${encodeURIComponent(selectedTrack)}`)}
                icon={ArrowRight}
                iconPosition="right"
              >
                Track My Progress →
              </Button>
            </div>
          )}

          {/* Top Page Header */}
          <div
            style={{
              marginBottom: '2.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Adaptive Learning Road
                </span>
                {!isAuthenticated && <Badge variant="lime" size="sm">Interactive Preview</Badge>}
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                {careerTitle} Roadmap
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                Structured milestone checkpoints leading from foundational fundamentals to corporate recruitment readiness.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>Track:</span>
                <select
                  value={selectedTrack}
                  onChange={(e) => handleTrackChange(e.target.value)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--color-emerald)',
                    backgroundColor: 'var(--color-white)',
                    color: 'var(--color-deep-forest)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {CAREER_TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRoadmap(selectedTrack)}
                icon={Sparkles}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* =========================================================================
              Placement Insight Card
              ========================================================================= */}
          <div
            className="card-static"
            style={{
              padding: '1.5rem 1.75rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-lime-soft)',
                  color: 'var(--color-deep-forest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.04em' }}>
                  Roadmap Progress & Insight
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginTop: '2px' }}>
                  {completionPercentage}% of {careerTitle} Roadmap Completed
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginTop: '2px' }}>
                  Active Milestone: <strong>Milestone {currentMilestoneNum}</strong>. Prioritize highlighted skill gaps to boost recruitment readiness.
                </div>
              </div>
            </div>

            <Link to="/assessment">
              <Button
                variant="lime"
                size="sm"
              >
                Assess Skills Now ↗
              </Button>
            </Link>
          </div>

          {/* =========================================================================
              3D Winding Career Road Visualizer
              ========================================================================= */}
          <div
            className="card-static"
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--color-deep-forest)',
              borderRadius: 'var(--radius-2xl)',
              marginBottom: '3rem',
              border: '1.5px solid rgba(199, 243, 107, 0.3)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ padding: '0.75rem 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="var(--color-lime)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-lime)', letterSpacing: '0.04em' }}>
                  Interactive 3D Pathway Ribbon
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-lime-soft)', opacity: 0.85 }}>
                Milestone {currentMilestoneNum} Active · {milestones.length} Total Checkpoints
              </span>
            </div>

            <CareerRoad3D activeMilestone={currentMilestoneNum} />
          </div>

          {/* Loading state or 10-Step Winding Road Timeline */}
          {loading ? (
            <div style={{ padding: '3rem 0' }}>
              <LoadingState message="Generating personalized career milestones..." />
            </div>
          ) : (
            <div style={{ position: 'relative', maxWidth: '820px', margin: '0 auto', paddingBottom: '3rem' }}>
              {/* Center connecting road line */}
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  bottom: '40px',
                  left: '50%',
                  width: '4px',
                  backgroundColor: 'rgba(15, 118, 110, 0.2)',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}
                className="roadmap-center-line"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 2 }}>
                {milestones.map((node, index) => {
                  const isLeft = index % 2 === 0;
                  const isCompleted = node.status === 'completed';
                  const isInProgress = node.status === 'in_progress';
                  const isGap = node.isPriorityGap;

                  const cardContent = (
                    <div
                      className="card-floating"
                      onClick={() => setSelectedNode(node)}
                      style={{
                        padding: '1.25rem 1.4rem',
                        backgroundColor: isGap ? '#FBFDF9' : 'var(--color-white)',
                        borderRadius: 'var(--radius-xl)',
                        border: `1.5px solid ${isGap ? 'var(--color-lime)' : isInProgress ? 'var(--color-emerald)' : 'var(--color-border-subtle)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        maxWidth: '360px',
                        boxShadow: isInProgress ? 'var(--shadow-glow-emerald)' : 'var(--shadow-sm)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-emerald)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Milestone {node.number}
                        </span>
                        <Badge variant={isCompleted ? 'success' : isInProgress ? 'lime' : 'neutral'} size="sm">
                          {isCompleted ? 'Cleared' : isInProgress ? 'In Progress' : 'Locked'}
                        </Badge>
                      </div>
                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--color-deep-forest)', margin: '0 0 6px 0', lineHeight: 1.25 }}>
                        {node.title}
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: 'var(--color-charcoal-subtle)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                        {node.description}
                      </p>
                      {node.skills && node.skills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {node.skills.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor: 'var(--color-ivory-surface)',
                                border: '1px solid var(--color-border-subtle)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--color-deep-forest)',
                              }}
                            >
                              {s}
                            </span>
                          ))}
                          {node.skills.length > 3 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted-green)', padding: '2px' }}>
                              +{node.skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div key={node.id} className="roadmap-row">
                      {/* Desktop Left Col */}
                      <div className="roadmap-left-slot" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {isLeft ? cardContent : null}
                      </div>

                      {/* Timeline Center Node */}
                      <div className="roadmap-node-slot" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedNode(node)}
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isCompleted ? 'var(--color-deep-forest)' : isInProgress ? 'var(--color-emerald)' : 'var(--color-white)',
                            border: `3px solid ${isInProgress ? 'var(--color-lime)' : isCompleted ? 'var(--color-deep-forest)' : 'var(--color-border-medium)'}`,
                            color: isCompleted ? 'var(--color-lime)' : isInProgress ? 'var(--color-white)' : 'var(--color-muted-green)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            boxShadow: isInProgress ? 'var(--shadow-glow-lime)' : 'var(--shadow-sm)',
                            transition: 'transform 0.2s ease',
                            zIndex: 3,
                          }}
                          title={`Milestone ${node.number}: ${node.title}`}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          {isCompleted ? <Check size={20} /> : node.status === 'locked' ? <Lock size={16} /> : node.number}
                        </button>
                      </div>

                      {/* Desktop Right Col / Mobile Card Slot */}
                      <div className="roadmap-right-slot" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        {!isLeft ? cardContent : null}
                      </div>

                      {/* Mobile Card Slot (always rendered on mobile) */}
                      <div className="roadmap-mobile-card">
                        {cardContent}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Node Details Modal */}
      {selectedNode && (
        <Modal
          isOpen={Boolean(selectedNode)}
          onClose={() => setSelectedNode(null)}
          title={`Milestone ${selectedNode.number}: ${selectedNode.title}`}
          subtitle={selectedNode.estimatedTime}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge variant={selectedNode.status === 'completed' ? 'success' : selectedNode.status === 'in_progress' ? 'lime' : 'neutral'} size="md">
                Status: {selectedNode.status === 'completed' ? 'Completed' : selectedNode.status === 'in_progress' ? 'In Progress' : 'Locked'}
              </Badge>
              {selectedNode.isPriorityGap && (
                <Badge variant="warning" size="sm">
                  Priority Skill Gap
                </Badge>
              )}
            </div>

            <p style={{ fontSize: '0.925rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, margin: 0 }}>
              {selectedNode.description}
            </p>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '8px' }}>
                Key Skills & Topics in this Milestone:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(selectedNode.skills || []).map((s) => (
                  <span
                    key={s}
                    style={{
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: 'var(--color-deep-forest)',
                    }}
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons for Milestone Progress */}
            {isAuthenticated && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                {selectedNode.status !== 'completed' && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={updatingId === selectedNode.id}
                    onClick={() => handleStatusChange(selectedNode.id, 'completed')}
                    icon={Check}
                  >
                    Mark as Completed
                  </Button>
                )}
                {selectedNode.status !== 'in_progress' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updatingId === selectedNode.id}
                    onClick={() => handleStatusChange(selectedNode.id, 'in_progress')}
                  >
                    Set as In Progress
                  </Button>
                )}
                {selectedNode.status !== 'locked' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updatingId === selectedNode.id}
                    onClick={() => handleStatusChange(selectedNode.id, 'locked')}
                    icon={RotateCcw}
                  >
                    Reset
                  </Button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="outline" size="md" onClick={() => setSelectedNode(null)}>
                Close
              </Button>
              <Link to="/practice">
                <Button
                  variant="lime"
                  size="md"
                  onClick={() => setSelectedNode(null)}
                >
                  Practice Milestone Topics →
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .roadmap-row {
          display: grid;
          grid-template-columns: 1fr 60px 1fr;
          align-items: center;
          gap: 1.25rem;
        }
        .roadmap-mobile-card {
          display: none;
        }

        @media (max-width: 768px) {
          .roadmap-center-line {
            left: 23px !important;
            transform: none !important;
          }
          .roadmap-row {
            display: grid !important;
            grid-template-columns: 46px 1fr !important;
            gap: 1rem !important;
            align-items: flex-start !important;
          }
          .roadmap-left-slot,
          .roadmap-right-slot {
            display: none !important;
          }
          .roadmap-node-slot {
            grid-column: 1 !important;
            justify-content: flex-start !important;
            padding-top: 6px;
          }
          .roadmap-mobile-card {
            display: block !important;
            grid-column: 2 !important;
            width: 100% !important;
          }
          .roadmap-mobile-card .card-floating {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RoadmapPage;
