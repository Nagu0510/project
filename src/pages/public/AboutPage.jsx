import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from '../../components/common/Navbar';

export const AboutPage = () => {
  const values = [
    { icon: 'target', title: 'Precision Assessment', desc: 'Multi-difficulty assessments calibrated to actual placement standards across Python, Java, DSA, SQL, and more.' },
    { icon: 'map', title: 'Personalized Roadmaps', desc: 'Dynamic roadmaps generated from your assessment performance and target career path.' },
    { icon: 'search', title: 'Question Intelligence', desc: 'TF-IDF cosine similarity matching against real placement papers from TCS, Infosys, Accenture, and Amazon.' },
    { icon: 'doc', title: 'Resume Intelligence', desc: 'ATS-optimized resume analysis that identifies missing skills and provides career-path-specific recommendations.' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      <Navbar />
      <section style={{ paddingBlock: '6rem', textAlign: 'center' }}>
        <div className="container-custom" style={{ maxWidth: '760px' }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="badge badge-emerald" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>Our Mission</span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
              Bridging the gap between education and employment.
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto 2rem' }}>
              SkillSense AI is a comprehensive skill assessment and career development platform built to give engineering students the tools, intelligence, and roadmap they need to land their dream placement.
            </p>
            <Link to="/signup" className="btn btn-primary btn-lg">Start Free</Link>
          </motion.div>
        </div>
      </section>

      <section style={{ paddingBlock: '5rem', background: 'var(--color-white)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="container-custom">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--color-forest)', letterSpacing: '-0.025em', textAlign: 'center', marginBottom: '3rem' }}>Built on real principles.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: 'var(--color-ivory)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', padding: '1.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--color-forest)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--color-lime)', fontSize: '1rem', fontWeight: 700 }}>&#x2726;</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-forest)', marginBottom: '0.5rem' }}>{v.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingBlock: '5rem', background: 'var(--color-forest)', textAlign: 'center' }}>
        <div className="container-custom">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--color-ivory)', letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Start your journey today.</h2>
          <Link to="/signup" className="btn btn-lime btn-lg">Create Free Account</Link>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
