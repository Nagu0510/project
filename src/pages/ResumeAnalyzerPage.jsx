import React, { useState, useRef } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressCircle } from '../components/common/ProgressCircle';
import { ProgressBar } from '../components/common/ProgressBar';
import { ResumeScan3D } from '../components/three/ResumeScan3D';
import { resumeService } from '../services/resumeService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  FileCheck2,
  Building2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ResumeAnalyzerPage = () => {
  const { user, isAuthenticated, requireAuth } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(true);
  const [extractionError, setExtractionError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [report, setReport] = useState({
    overallScore: 84,
    headline: 'High ATS Compatibility for Backend Roles',
    recommendedPath: 'Backend Developer',
    detectedSkills: ['Python', 'Java', 'SQL', 'MongoDB', 'Git', 'REST API'],
    strongSkills: ['Python', 'SQL', 'Git'],
    missingSkills: ['FastAPI', 'Docker'],
    strengths: [
      { skill: 'Python & Backend Logic', reason: 'Strong foundational backend language usage.' },
      { skill: 'Relational & NoSQL Databases (SQL, MongoDB)', reason: 'Clear schema and database query evidence.' },
      { skill: 'Version Control (Git)', reason: 'Verified repository collaboration practices.' },
    ],
    gaps: [
      { skill: 'FastAPI & Async Frameworks', reason: 'High demand in modern placement roles.' },
      { skill: 'Docker Containerization', reason: 'Recommended to enhance cloud deployment readiness.' },
    ],
    companyMatches: [
      { company: 'TCS (Tata Consultancy Services)', role: 'Systems Engineer', matchPercentage: 80, status: 'Eligible', missingSkills: ['Docker'] },
      { company: 'Infosys', role: 'Specialist Programmer', matchPercentage: 80, status: 'Eligible', missingSkills: ['FastAPI'] },
      { company: 'Accenture', role: 'Associate Software Engineer', matchPercentage: 80, status: 'Eligible', missingSkills: [] },
      { company: 'Amazon', role: 'SDE-1', matchPercentage: 50, status: 'Needs Skill Improvement', missingSkills: ['Docker', 'C++'] },
    ],
    recommendations: [
      'Complete FastAPI practice module to bridge the backend framework gap.',
      'Build a containerized microservice project using Docker.',
    ],
  });

  const handleFileSelected = async (file) => {
    if (!file) return;
    setAnalyzing(true);
    setExtractionError(null);
    try {
      const careerPath = user?.currentPath || 'Backend Developer';
      const result = await resumeService.analyzeResume(file, careerPath);
      setReport(result);
      setAnalyzed(true);
      addToast(`Resume parsed! ATS Score: ${result.overallScore}/100`, 'success');
    } catch (err) {
      console.warn("Resume extraction error:", err);
      const msg = err?.response?.data?.detail || err.message || 'Could not extract readable text from this resume.';
      setExtractionError(msg);
      setAnalyzed(false);
      addToast(msg, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUploadClick = () => {
    requireAuth(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, '/resume-analyzer');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    requireAuth(() => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    }, '/resume-analyzer');
  };

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileSelected(e.target.files[0])}
        style={{ display: 'none' }}
        accept=".pdf,.docx,.txt"
      />

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '960px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                ATS Placement Parser & Eligibility Engine
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
              Resume & ATS Skill Intelligence
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
              Instant PDF/DOCX parsing, skill extraction, strength analysis, and company placement eligibility mapping.
            </p>
          </div>

          {/* UPLOAD DROPZONE */}
          <div
            className="card-static"
            style={{
              padding: '2.5rem 2rem',
              backgroundColor: isDragging ? 'var(--color-emerald-alpha)' : 'var(--color-white)',
              borderRadius: 'var(--radius-2xl)',
              border: `2px dashed ${isDragging ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '2rem',
            }}
            onClick={handleUploadClick}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-lime-soft)',
                color: 'var(--color-deep-forest)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Upload size={24} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--color-deep-forest)', margin: '0 0 0.4rem 0' }}>
              Upload Your Resume (PDF, DOCX)
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', marginBottom: '1.25rem' }}>
              Drag and drop your file here, or click to browse. Max size 10MB.
            </p>

            <Button variant="primary" size="md" icon={Upload} loading={analyzing}>
              {isAuthenticated ? 'Upload My Resume' : 'Sign In & Upload My Resume →'}
            </Button>
          </div>

          {/* EXTRACTION ERROR ALERT */}
          {extractionError && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #F87171',
                borderRadius: 'var(--radius-xl)',
                padding: '1.25rem 1.5rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#991B1B',
              }}
            >
              <AlertCircle size={24} color="#DC2626" />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '2px' }}>
                  Text Extraction Error
                </strong>
                <span style={{ fontSize: '0.9rem' }}>{extractionError}</span>
              </div>
            </div>
          )}

          {/* REPORT RESULTS */}
          {analyzed && !extractionError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* Score Overview Card */}
              <div
                className="card-floating"
                style={{
                  padding: '2.25rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-2xl)',
                  border: '1.5px solid rgba(15, 118, 110, 0.25)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '2rem',
                }}
              >
                <div style={{ maxWidth: '480px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <Badge variant="success">ATS Verified</Badge>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                      Candidate Placement Analysis
                    </span>
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
                    {report.headline}
                  </h2>

                  <p style={{ fontSize: '0.925rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.55, margin: 0 }}>
                    Recommended career target: <strong>{report.recommendedPath}</strong>. Your profile has been scanned against corporate placement technical benchmarks.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '220px', height: '240px' }}>
                    <ResumeScan3D />
                  </div>

                  <ProgressCircle
                    percentage={report.overallScore}
                    size={130}
                    strokeWidth={11}
                    color="var(--color-emerald)"
                    label="ATS Score"
                  />
                </div>
              </div>

              {/* Detected & Strong Skills Overview */}
              <div
                style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.75rem',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                  Detected vs Verified Strong Skills
                </h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted-green)', marginBottom: '6px' }}>
                    Detected Skills ({report.detectedSkills?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(report.detectedSkills || []).map((s) => (
                      <span key={s} className="badge badge-neutral" style={{ fontSize: '0.825rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-emerald)', marginBottom: '6px' }}>
                    Strong / Verified Skills ({report.strongSkills?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(report.strongSkills || []).map((s) => (
                      <span key={s} className="badge badge-lime" style={{ fontSize: '0.825rem' }}>
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strengths & Missing Gaps Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Strengths */}
                <div
                  className="card-static"
                  style={{
                    padding: '1.75rem',
                    backgroundColor: 'var(--color-white)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                    <CheckCircle2 size={20} color="#059669" />
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                      Verified Strengths ({report.strengths?.length || 0})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(report.strengths || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: 'var(--color-ivory-surface)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--color-deep-forest)', marginBottom: '2px' }}>
                          ✓ {item.skill}
                        </div>
                        <div style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)', lineHeight: 1.4 }}>
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill Gaps */}
                <div
                  className="card-static"
                  style={{
                    padding: '1.75rem',
                    backgroundColor: 'var(--color-white)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                    <AlertTriangle size={20} color="#D97706" />
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                      Placement Skill Gaps ({report.gaps?.length || 0})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    {(report.gaps || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#92400E', marginBottom: '2px' }}>
                          ! {item.skill}
                        </div>
                        <div style={{ fontSize: '0.825rem', color: '#B45309', lineHeight: 1.4 }}>
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => requireAuth(null, '/roadmap')}
                    icon={ArrowRight}
                    iconPosition="right"
                    style={{ width: '100%' }}
                  >
                    Build Roadmap to Close Gaps
                  </Button>
                </div>
              </div>

              {/* Corporate Company Eligibility Matches */}
              <div
                style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.75rem',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <Building2 size={22} color="var(--color-emerald)" />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                    Company Placement Eligibility & Match Breakdown
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {(report.companyMatches || []).map((comp, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-xl)',
                        backgroundColor: 'var(--color-ivory-soft)',
                        border: '1px solid var(--color-border-medium)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-forest)' }}>
                            {comp.company}
                          </span>
                          <Badge variant={comp.status === 'Eligible' ? 'emerald' : comp.status === 'Possibly Eligible' ? 'medium' : 'hard'}>
                            {comp.status}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                          Role: <strong>{comp.role}</strong>
                        </div>

                        <ProgressBar
                          progress={comp.matchPercentage}
                          label={`${comp.matchPercentage}% Skill Match`}
                          color={comp.matchPercentage >= 75 ? 'var(--color-emerald)' : 'var(--color-amber)'}
                        />

                        {comp.missingSkills && comp.missingSkills.length > 0 && (
                          <div style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: '#92400E' }}>
                            Needs improvement in: {comp.missingSkills.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResumeAnalyzerPage;
