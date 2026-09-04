import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from '../../components/common/Navbar';

export const FeaturesPage = () => {
  const features = [
    { title: 'Multi-Level Skill Assessment', description: 'Easy, Medium, and Hard assessments across Python, Java, JavaScript, React, SQL, DSA, AI/ML, and more.', link: '/assessment' },
    { title: 'Personalized Career Roadmap', description: 'Your roadmap is generated from your chosen career path, assessment results, and skill gaps.', link: '/roadmap' },
    { title: 'Coding Practice Arena', description: 'LeetCode-style problems sorted by difficulty. Each problem is tagged with companies that asked similar questions.', link: '/practice' },
    { title: 'Resume Intelligence', description: 'Upload PDF or DOCX. Our system extracts your skills, compares against career requirements, and generates ATS scores.', link: '/resume-analyzer' },
    { title: 'Question Intelligence', description: 'TF-IDF + cosine similarity matching shows which practice problems resemble real placement questions.', link: '/previous-questions' },
    { title: 'Placement Readiness', description: 'Browse live placement opportunities. See your skill match %, strong skills, and missing skills for each role.', link: '/placement-tracker' },
    { title: 'Assessment Analytics', description: 'Detailed results after every test: topic breakdowns, strong/weak areas, score history, and next steps.', link: '/assessment' },
    { title: 'Secure & Private', description: 'JWT authentication, bcrypt password hashing, role-based access control. Your data stays yours.', link: '/signup' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      <Navbar />
      <section style={{ paddingBlock: '6rem', textAlign: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="container-custom" style={{ maxWidth: '720px' }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="badge badge-lime" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>Platform Features</span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
              Everything you need, nothing you don't.
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              SkillSense AI combines assessment, roadmap, practice, resume analysis, and placement intelligence into one coherent platform.
            </p>
          </motion.div>
        </div>
      </section>
      <section style={{ paddingBlock: '5rem', background: 'var(--color-white)' }}>
        <div className="container-custom">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Link to={f.link} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div style={{ background: 'var(--color-ivory)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', padding: '2rem', height: '100%', transition: 'transform 250ms, box-shadow 250ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--color-forest)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'var(--color-lime)', fontWeight: 700 }}>&#x2726;</span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-forest)', marginBottom: '0.625rem' }}>{f.title}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>{f.description}</p>
                    <div style={{ marginTop: '1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-emerald)' }}>Explore feature →</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <section style={{ paddingBlock: '5rem', textAlign: 'center', background: 'var(--color-forest)' }}>
        <div className="container-custom">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--color-ivory)', letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Ready to get started?</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" className="btn btn-lime btn-lg">Create Free Account</Link>
            <Link to="/career-paths" className="btn btn-outline-light btn-lg">Browse Career Paths</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FeaturesPage;
