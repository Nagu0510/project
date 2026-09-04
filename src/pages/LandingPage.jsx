import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Navbar } from '../components/common/Navbar';
import { SkillSenseCore3D } from '../components/three/SkillSenseCore3D';

const RevealSection = ({ children, delay = 0, style = {}, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const FeatureCard = ({ icon, title, description, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, boxShadow: '0 16px 40px -8px rgba(18,55,42,0.12)' }}
      style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{
        width: '48px', height: '48px',
        background: 'var(--color-forest)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1rem', fontSize: '1.25rem',
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: 'var(--font-sans)', fontSize: '1.0625rem',
        fontWeight: 700, color: 'var(--color-forest)', marginBottom: '0.5rem',
      }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--color-text-muted)' }}>
        {description}
      </p>
    </motion.div>
  );
};

const CareerCard = ({ name, icon, skills, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to="/career-paths" style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-sm)',
            height: '100%',
          }}
          whileHover={{ y: -6, boxShadow: '0 20px 48px -8px rgba(18,55,42,0.12)', borderColor: 'rgba(18,55,42,0.18)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.875rem' }}>{icon}</div>
          <h3 style={{
            fontFamily: 'var(--font-sans)', fontSize: '1rem',
            fontWeight: 700, color: 'var(--color-forest)', marginBottom: '0.625rem',
          }}>
            {name}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {(skills || []).slice(0, 4).map((s) => (
              <span key={s} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{s}</span>
            ))}
          </div>
          <div style={{
            marginTop: '1rem', display: 'flex', alignItems: 'center',
            gap: '4px', color: 'var(--color-emerald)', fontSize: '0.8125rem', fontWeight: 700,
          }}>
            Explore path <span>&#8594;</span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

const RoadmapStep = ({ number, label, active, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '1rem 1.25rem',
        background: active ? 'var(--color-forest)' : 'var(--color-white)',
        border: `1px solid ${active ? 'var(--color-forest)' : 'var(--color-border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: active ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      }}
    >
      <span style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: active ? 'var(--color-lime)' : 'var(--color-ivory-muted)',
        color: active ? 'var(--color-forest)' : 'var(--color-text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0,
      }}>
        {number}
      </span>
      <span style={{
        fontSize: '0.9rem', fontWeight: 600,
        color: active ? 'var(--color-ivory)' : 'var(--color-forest)',
      }}>
        {label}
      </span>
      {active && (
        <span style={{
          marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700,
          background: 'var(--color-lime)', color: 'var(--color-forest)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
        }}>
          CURRENT
        </span>
      )}
    </motion.div>
  );
};

export const LandingPage = () => {
  const careerPaths = [
    { name: 'Frontend Developer', icon: '\ud83c\udfa8', skills: ['React', 'JavaScript', 'CSS', 'TypeScript'] },
    { name: 'Backend Developer', icon: '\u2699\ufe0f', skills: ['Python', 'FastAPI', 'SQL', 'MongoDB'] },
    { name: 'Full Stack Developer', icon: '\ud83d\udd04', skills: ['React', 'Node.js', 'SQL', 'Docker'] },
    { name: 'Data Scientist', icon: '\ud83d\udcca', skills: ['Python', 'ML', 'Pandas', 'TensorFlow'] },
    { name: 'AI / ML Engineer', icon: '\ud83e\udd16', skills: ['Python', 'NLP', 'PyTorch', 'NumPy'] },
    { name: 'Cloud / DevOps', icon: '\u2601\ufe0f', skills: ['Docker', 'Kubernetes', 'AWS', 'Terraform'] },
  ];

  const roadmapSteps = [
    { number: '01', label: 'Foundations & Programming Basics' },
    { number: '02', label: 'Data Structures & Algorithms' },
    { number: '03', label: 'Core Technologies' },
    { number: '04', label: 'Projects & Portfolio', active: true },
    { number: '05', label: 'Advanced Specialization' },
    { number: '06', label: 'Deployment & DevOps' },
    { number: '07', label: 'Placement Preparation' },
    { number: '08', label: 'Career Ready \u2726' },
  ];

  const features = [
    { icon: '\ud83c\udfaf', title: 'Adaptive Skill Assessment', description: 'Structured tests across Easy, Medium, and Hard levels covering Python, Java, DSA, SQL, React, and more.' },
    { icon: '\ud83d\uddfa\ufe0f', title: 'Personalized Career Roadmap', description: 'Dynamically generated roadmaps based on your career goal, assessment scores, and skill gaps.' },
    { icon: '\ud83d\udcbb', title: 'Coding Practice Arena', description: 'LeetCode-style problems with placement-company tagging and previous question intelligence.' },
    { icon: '\ud83d\udcc4', title: 'Resume Intelligence', description: 'Upload your resume and get instant ATS analysis, missing skill detection, and role-specific recommendations.' },
    { icon: '\ud83d\udd0d', title: 'Question Intelligence', description: 'TF-IDF + cosine similarity matching against a curated bank of TCS, Infosys, Accenture, and Amazon questions.' },
    { icon: '\ud83c\udfe2', title: 'Placement Readiness', description: 'See how your skills match against real placement opportunities with company-specific skill gap analysis.' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-ivory)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      {/* HERO */}
      <section style={{
        position: 'relative', minHeight: '92vh',
        display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: '3rem',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(183, 228, 74, 0.06) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 90% 70%, rgba(31, 107, 80, 0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div className="container-custom" style={{ width: '100%' }}>
          <div className="hero-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '3rem', alignItems: 'center', minHeight: '75vh',
          }}>
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} style={{ marginBottom: '1.5rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'var(--color-white)', border: '1px solid rgba(31, 107, 80, 0.2)',
                  borderRadius: 'var(--radius-full)', padding: '6px 16px',
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)',
                  boxShadow: 'var(--shadow-sm)', letterSpacing: '0.02em', textTransform: 'uppercase',
                }}>
                  <span style={{ color: 'var(--color-emerald)' }}>\u2726</span>
                  Next-Gen Skill Assessment Platform
                </span>
              </motion.div>

              <div style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
                {['Turn your skills', 'into your career.'].map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 80 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span style={{
                      display: 'block',
                      fontFamily: 'var(--font-serif-display)',
                      fontSize: 'clamp(2.75rem, 5.5vw, 4.5rem)',
                      fontWeight: 400, color: 'var(--color-forest)',
                      letterSpacing: '-0.04em', lineHeight: 1.05,
                    }}>
                      {i === 1 ? (<>into your <em style={{ fontStyle: 'italic', color: 'var(--color-emerald)' }}>career.</em></>) : line}
                    </span>
                  </motion.div>
                ))}
              </div>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                style={{ fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: 'var(--color-text-muted)', lineHeight: 1.7, maxWidth: '480px', marginBottom: '2.25rem' }}
              >
                Assess what you know. Discover what you're missing.
                Build a personalized path toward your career.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.65 }}
                style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}
              >
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Start Your Journey <span>\u2192</span>
                </Link>
                <Link to="/career-paths" className="btn btn-outline btn-lg">
                  Explore Career Paths
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.9 }}
                style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
              >
                {[{ num: '9+', label: 'Career Paths' }, { num: '90+', label: 'Practice Problems' }, { num: '6+', label: 'Company Banks' }].map((stat, idx) => (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.03em' }}>{stat.num}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{stat.label}</span>
                    {idx < 2 && <span style={{ color: 'var(--color-border-medium)', marginLeft: '0.5rem' }}>&#183;</span>}
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '500px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden',
                background: 'radial-gradient(ellipse at center, rgba(31, 107, 80, 0.06) 0%, transparent 70%)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <React.Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading...</div>}>
                <SkillSenseCore3D />
              </React.Suspense>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ paddingBlock: '6rem', background: 'var(--color-white)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="container-custom">
          <RevealSection style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ display: 'inline-block', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '1rem' }}>Everything you need</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', maxWidth: '600px', margin: '0 auto' }}>
              One platform for your entire career journey.
            </h2>
          </RevealSection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {features.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.08} />)}
          </div>
        </div>
      </section>

      {/* ASSESSMENT PREVIEW */}
      <section style={{ paddingBlock: '7rem', background: 'var(--color-ivory)' }}>
        <div className="container-custom">
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
            <RevealSection>
              <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '1rem' }}>Skill Assessment</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
                Know exactly<br />where you stand.
              </h2>
              <p style={{ maxWidth: '440px', marginBottom: '1.75rem', lineHeight: 1.7 }}>
                Take structured assessments across Python, Java, DSA, SQL, React, and more.
                Choose your difficulty and receive a detailed breakdown of your performance.
              </p>
              <Link to="/assessment" className="btn btn-primary">Start Free Assessment</Link>
            </RevealSection>
            <RevealSection delay={0.2}>
              <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-2xl)', padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-forest)' }}>Python Medium</h3>
                  <span className="badge badge-medium">Medium</span>
                </div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-forest)', marginBottom: '0.75rem' }}>Q4. What is the output of: x = [1,2,3,4,5]; print(x[1:3])</p>
                <div style={{ background: 'var(--color-forest)', borderRadius: 'var(--radius-md)', padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-lime-soft)', lineHeight: 1.7, marginBottom: '1rem' }}>
                  x = [1, 2, 3, 4, 5]<br />print(x[1:3])
                </div>
                {['[1, 2]', '[2, 3]', '[2, 3, 4]', '[1, 2, 3]'].map((opt, i) => (
                  <div key={opt} style={{
                    padding: '0.625rem 1rem',
                    border: `1px solid ${i === 1 ? 'var(--color-emerald)' : 'var(--color-border-subtle)'}`,
                    borderRadius: 'var(--radius-md)', marginBottom: '0.5rem',
                    fontSize: '0.875rem', fontFamily: 'var(--font-mono)',
                    color: i === 1 ? 'var(--color-emerald)' : 'var(--color-charcoal)',
                    background: i === 1 ? 'var(--color-emerald-alpha)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-subtle)', minWidth: '16px' }}>{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {i === 1 && <span style={{ marginLeft: 'auto' }}>\u2713</span>}
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* CAREER PATHS */}
      <section style={{ paddingBlock: '7rem', background: 'var(--color-forest)' }}>
        <div className="container-custom">
          <RevealSection style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-lime)', marginBottom: '1rem' }}>Career Paths</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, color: 'var(--color-ivory)', letterSpacing: '-0.025em' }}>Choose your direction.</h2>
            <p style={{ color: 'rgba(244, 240, 231, 0.65)', marginTop: '0.75rem', maxWidth: '480px', margin: '0.75rem auto 0' }}>Nine curated career paths, each with tailored skill requirements and personalized roadmaps.</p>
          </RevealSection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            {careerPaths.map((cp, i) => <CareerCard key={cp.name} {...cp} delay={i * 0.07} />)}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Link to="/career-paths" className="btn btn-lime btn-lg">Explore All 9 Paths &#8594;</Link>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section style={{ paddingBlock: '7rem', background: 'var(--color-ivory)' }}>
        <div className="container-custom">
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'start' }}>
            <RevealSection>
              <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '1rem' }}>Personalized Roadmap</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
                Build your route,<br />step by step.
              </h2>
              <p style={{ maxWidth: '440px', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                Your roadmap is dynamically generated from your career path, assessment results, and skill gaps. Not a generic template.
              </p>
              <Link to="/signup" className="btn btn-primary">Get Your Roadmap</Link>
            </RevealSection>
            <RevealSection delay={0.2}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {roadmapSteps.map((step, i) => <RoadmapStep key={step.number} {...step} delay={i * 0.06} />)}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* QUESTION INTELLIGENCE */}
      <section style={{ paddingBlock: '7rem', background: 'linear-gradient(135deg, var(--color-forest) 0%, var(--color-forest-mid) 100%)' }}>
        <div className="container-custom">
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-lime)', marginBottom: '1rem' }}>Question Intelligence</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, color: 'var(--color-ivory)', letterSpacing: '-0.025em', marginBottom: '1rem' }}>
              Practice what companies actually ask.
            </h2>
            <p style={{ color: 'rgba(244, 240, 231, 0.65)', maxWidth: '520px', margin: '0 auto' }}>
              Every practice problem is matched against real placement questions using TF-IDF cosine similarity.
            </p>
          </RevealSection>
          <RevealSection delay={0.2} style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', maxWidth: '700px' }}>
              {['TCS', 'Infosys', 'Accenture', 'Cognizant', 'Wipro', 'Amazon', 'Microsoft'].map((company, i) => (
                <motion.div key={company}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  style={{
                    padding: '0.625rem 1.25rem', background: 'rgba(244, 240, 231, 0.08)',
                    border: '1px solid rgba(183, 228, 74, 0.2)', borderRadius: 'var(--radius-full)',
                    fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-ivory)', letterSpacing: '0.02em',
                  }}
                >
                  {company}
                </motion.div>
              ))}
            </div>
          </RevealSection>
          <div style={{ textAlign: 'center' }}>
            <Link to="/previous-questions" className="btn btn-lime btn-lg">Browse Previous Questions &#8594;</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingBlock: '8rem', background: 'var(--color-ivory)', textAlign: 'center' }}>
        <div className="container-custom">
          <RevealSection>
            <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-3xl)', padding: '4rem 3rem', boxShadow: 'var(--shadow-xl)', maxWidth: '700px', margin: '0 auto' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'var(--color-lime-soft)', borderRadius: '50%', fontSize: '1.5rem', marginBottom: '1.5rem' }}>\u2726</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', marginBottom: '1rem' }}>
                You're career ready.<br />Start proving it.
              </h2>
              <p style={{ color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 2.25rem' }}>
                Join SkillSense AI and get a personalized skill assessment, roadmap, and placement intelligence — completely free.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/signup" className="btn btn-primary btn-lg">Create Free Account</Link>
                <Link to="/career-paths" className="btn btn-outline btn-lg">Explore Paths</Link>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--color-forest)', paddingBlock: '3rem', borderTop: '1px solid rgba(183, 228, 74, 0.1)' }}>
        <div className="container-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '7px', background: 'var(--color-lime)', color: 'var(--color-forest)', fontWeight: 700, fontSize: '0.9rem' }}>\u2726</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-ivory)' }}>SkillSense AI</span>
            </Link>
            <nav style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
              {[{ to: '/career-paths', label: 'Career Paths' }, { to: '/assessment', label: 'Assessments' }, { to: '/previous-questions', label: 'Questions' }, { to: '/placement-tracker', label: 'Placements' }, { to: '/about', label: 'About' }, { to: '/admin/login', label: 'Admin' }].map((l) => (
                <Link key={l.to} to={l.to} style={{ fontSize: '0.85rem', color: 'rgba(244, 240, 231, 0.6)', fontWeight: 500 }}>{l.label}</Link>
              ))}
            </nav>
            <p style={{ fontSize: '0.8rem', color: 'rgba(244, 240, 231, 0.4)' }}>&copy; 2026 SkillSense AI</p>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid, .two-col-grid { grid-template-columns: 1fr !important; }
          .hero-grid > *:last-child { height: 320px !important; }
        }
        .radius-3xl { border-radius: var(--radius-3xl) !important; }
      `}</style>
    </div>
  );
};

export default LandingPage;
