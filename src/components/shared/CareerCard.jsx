import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { CareerPathIcon } from './CareerPathIcon';

export const CareerCard = ({
  path,
  isSelected = false,
  onChooseTrack,
  userSkills = [],
  index = 0,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState(isSelected);

  const title = path.title || path.name || "Career Track";
  const slug = path.slug || path.id || "backend-developer";
  const description = path.description || "";
  const skills = path.required_skills || path.skills || path.requiredSkills || [];
  const demand = path.demand_level || path.demandLevel || "";
  const salary = path.average_salary || path.avgSalary || path.averageSalary || "";

  // Calculate dynamic match score if user skills present
  // A match score exists only when the student has skills to compare; no baseline, no default
  let matchScore = null;
  if (userSkills && userSkills.length > 0 && skills.length > 0) {
    const matchedCount = skills.filter((s) =>
      userSkills.some((us) => us.toLowerCase() === s.toLowerCase() || s.toLowerCase().includes(us.toLowerCase()))
    ).length;
    const computed = Math.round((matchedCount / skills.length) * 100);
    matchScore = computed;
  }

  const handleChoose = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || selectedState) return;
    setLoading(true);
    try {
      if (onChooseTrack) {
        await onChooseTrack(path);
      }
      setSelectedState(true);
    } catch (err) {
      console.warn("Track selection error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4 }}
      style={{
        background: 'var(--color-white)',
        border: selectedState ? '2px solid var(--color-emerald)' : '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-2xl)',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: selectedState
          ? '0 16px 36px -6px rgba(31, 107, 80, 0.18)'
          : 'var(--shadow-md)',
        transition: 'border-color 200ms, box-shadow 200ms',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div>
        {/* Top Header Row: Icon + Title/Demand + Match Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
              <CareerPathIcon type={title} size={52} />
            </motion.div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.45rem',
                    fontWeight: 400,
                    color: 'var(--color-forest)',
                    margin: 0,
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {title}
                </h3>
                {selectedState && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    Active Track
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: '3px' }}>
                {demand}
              </div>
            </div>
          </div>

          {/* Match Badge (only with real skills to compare) */}
          {matchScore !== null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: selectedState ? 'var(--color-forest)' : 'var(--color-lime-soft)',
              color: selectedState ? 'var(--color-lime)' : 'var(--color-forest)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(183, 228, 74, 0.25)',
              transition: 'background 250ms, color 250ms',
            }}
          >
            <span>✦</span>
            {matchScore}% Match
          </div>
          )}
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.65,
            marginBottom: '1.25rem',
          }}
        >
          {description}
        </p>

        {/* CORE SKILLS */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              fontSize: '0.725rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-forest)',
              marginBottom: '0.5rem',
            }}
          >
            CORE SKILLS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {skills.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-ivory-soft)',
                  border: '1px solid var(--color-border-medium)',
                  color: 'var(--color-forest)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Metrics & Actions */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '1.125rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {salary && (<>Avg CTC:{' '}<strong style={{ color: 'var(--color-forest)', fontWeight: 700 }}>{salary}</strong></>)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Roadmap Button -> Links to specific career roadmap */}
          <Link to={`/roadmap?career=${encodeURIComponent(slug)}`}>
            <motion.button
              whileHover={{ x: 2 }}
              className="btn btn-outline btn-sm"
              style={{
                fontSize: '0.8125rem',
                padding: '0.45rem 1rem',
                borderColor: 'var(--color-border-strong)',
              }}
            >
              Roadmap <ArrowRight size={14} style={{ marginLeft: '4px' }} />
            </motion.button>
          </Link>

          {/* Choose Track Button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleChoose}
            disabled={loading}
            className={`btn ${selectedState ? 'btn-primary' : 'btn-lime'} btn-sm`}
            style={{
              fontSize: '0.8125rem',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin-slow" style={{ marginRight: '4px' }} />
                Choosing...
              </>
            ) : selectedState ? (
              <>
                <Check size={14} style={{ marginRight: '4px' }} />
                Track Selected ✓
              </>
            ) : (
              'Choose Track'
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default CareerCard;
