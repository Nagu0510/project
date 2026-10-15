import React, { useEffect, useRef, useState } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import {
  BulletCoach, CategoryBars, CompanyMatches, HistoryChart, KeywordGap, LearningSteps, OcrNotice, PracticeForCompany, RankedFixes, ScoreOverview, SkillChips,
} from '../components/resume/ResumeReport';
import { resumeService } from '../services/resumeService';
import { careerService } from '../services/careerService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Upload, AlertCircle, FileText, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp';
const EXTENSIONS = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

const panel = { backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', border: '1px solid var(--color-border-subtle)' };
const label = { fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-deep-forest)', display: 'block', marginBottom: '4px' };
const field = { width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.9rem', background: 'var(--color-white)' };

// Turn an API error into a sentence a student can act on
const explain = (err) => {
  const msg = err?.message || '';
  if (/OCR engine unavailable/i.test(msg)) {
    return 'The OCR engine is not available on the server right now, so scans and photos cannot be read. Text PDFs, DOCX and TXT files still work, and you can paste your text below.';
  }
  if (err?.status === 429) return 'You are analysing too quickly. Wait a minute and try again.';
  return msg || 'The resume could not be analysed. Please try again.';
};

export const ResumeAnalyzerPage = () => {
  const { user, isAuthenticated, isStudent, requireAuth } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [paths, setPaths] = useState([]);
  const [role, setRole] = useState('');
  const [jd, setJd] = useState('');
  const [jdOpen, setJdOpen] = useState(false);

  const [busy, setBusy] = useState(null); // null | 'file' | 'text'
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [report, setReport] = useState(null); // null until a real analysis exists: no sample data
  const [text, setText] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [history, setHistory] = useState([]);

  const [pathsError, setPathsError] = useState('');
  const [pathsKey, setPathsKey] = useState(0);
  useEffect(() => {
    setPathsError('');
    careerService.getCareerPaths().then((list) => setPaths(list)).catch((err) => setPathsError(err?.message || 'Please try again.'));
  }, [pathsKey]);

  // default the target role to the student's chosen career path
  useEffect(() => {
    if (role || paths.length === 0) return;
    const mine = paths.find((p) => p.title === user?.currentPath || p.id === user?.currentPath);
    if (mine) setRole(mine.title);
  }, [paths, user, role]);

  const refreshHistory = () => {
    if (!isStudent) return;
    resumeService.getHistory().then(setHistory).catch(() => setHistory([]));
  };
  useEffect(refreshHistory, [isStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const show = (result) => {
    setReport(result);
    setText(result.extractedText);
    setEditorOpen(result.ocrUsed);
    refreshHistory();
  };

  const needRole = () => {
    if (role) return false;
    setError('Choose the role you are applying for first. The score is measured against that role.');
    return true;
  };

  const handleFileSelected = async (picked) => {
    if (!picked) return;
    setError(null);
    const ext = extOf(picked.name);
    if (!EXTENSIONS.includes(ext)) {
      setError('That file type is not supported. Upload a PDF, DOCX, TXT, PNG, JPG or WEBP resume.');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError('That file is larger than 8 MB. Use a smaller file or a lower resolution photo.');
      return;
    }
    if (needRole()) return;
    setFile(picked);
    setPreviewUrl(IMAGE_EXT.includes(ext) ? URL.createObjectURL(picked) : null);
    setBusy('file');
    try {
      const result = await resumeService.analyzeResume(picked, role, jd);
      show(result);
      addToast(`Resume read. ATS-style score: ${result.overallScore}/100`, 'success');
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const rescore = async () => {
    setError(null);
    if (!text.trim() || needRole()) return;
    setBusy('text');
    try {
      const result = await resumeService.analyzeText(text, role, jd);
      setReport(result);
      setEditorOpen(true);
      refreshHistory();
      addToast(`Re-scored: ${result.overallScore}/100`, 'success');
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(null);
    }
  };

  const handleUploadClick = () => requireAuth(() => fileInputRef.current?.click(), '/resume-analyzer');

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    requireAuth(() => handleFileSelected(e.dataTransfer.files?.[0]), '/resume-analyzer');
  };

  const clear = () => {
    setReport(null); setFile(null); setPreviewUrl(null); setText(''); setError(null); setEditorOpen(false);
  };

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <input type="file" ref={fileInputRef} data-testid="resume-file-input" aria-label="Resume file" onChange={(e) => handleFileSelected(e.target.files[0])} style={{ display: 'none' }} accept={ACCEPT} />

      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '960px', margin: '0 auto' }}>
          {pathsError && <ErrorBanner title="The role list could not be loaded." message={pathsError} onRetry={() => setPathsKey((k) => k + 1)} />}

          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                ATS-style score (estimate)
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
              Resume Analyzer
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
              Upload a PDF, DOCX, TXT, or a scan or photo of your resume. You get a transparent score, ranked fixes and the skills it found, measured against the role you choose.
            </p>
          </div>

          {/* TARGET ROLE + OPTIONAL JOB DESCRIPTION */}
          <div style={{ ...panel, marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label htmlFor="resume-role" style={label}>Target role</label>
                <select id="resume-role" data-testid="resume-role" value={role} onChange={(e) => setRole(e.target.value)} style={field}>
                  <option value="">Choose a role...</option>
                  {paths.map((p) => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => setJdOpen((o) => !o)} aria-expanded={jdOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-emerald)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', justifySelf: 'start', padding: '0.6rem 0' }}>
                {jdOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Match a job description (optional)
              </button>
            </div>
            {jdOpen && (
              <div style={{ marginTop: '0.75rem' }}>
                <label htmlFor="resume-jd" style={label}>Job description</label>
                <textarea id="resume-jd" data-testid="resume-jd" value={jd} onChange={(e) => setJd(e.target.value)} rows={5} maxLength={8000} placeholder="Paste the job description here to see which of its keywords your resume covers." style={{ ...field, resize: 'vertical' }} />
              </div>
            )}
          </div>

          {/* UPLOAD DROPZONE */}
          <div
            className="card-static"
            data-testid="dropzone"
            style={{
              padding: '2rem 1.5rem',
              backgroundColor: isDragging ? 'var(--color-emerald-alpha)' : 'var(--color-white)',
              borderRadius: 'var(--radius-2xl)',
              border: `2px dashed ${isDragging ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
              textAlign: 'center',
              cursor: busy ? 'progress' : 'pointer',
              marginBottom: '1.5rem',
            }}
            onClick={busy ? undefined : handleUploadClick}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-lime-soft)', color: 'var(--color-deep-forest)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <Upload size={22} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: 'var(--color-deep-forest)', margin: '0 0 0.3rem 0' }}>
              Drop your resume here, or click to browse
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-green)', margin: '0 0 1rem' }}>
              PDF, DOCX, TXT, PNG, JPG or WEBP, up to 8 MB. Only the first 4 PDF pages are read. Your file is not stored.
            </p>
            <Button variant="primary" size="md" icon={Upload} loading={busy === 'file'}>
              {isAuthenticated ? 'Choose a file' : 'Sign in to upload'}
            </Button>

            {busy && (
              <div role="status" data-testid="progress" style={{ marginTop: '1rem' }}>
                <div style={{ height: '6px', borderRadius: '99px', background: 'var(--color-ivory-muted)', overflow: 'hidden', maxWidth: '360px', margin: '0 auto' }}>
                  <div style={{ width: '40%', height: '100%', background: 'var(--color-emerald)', borderRadius: '99px', animation: 'resume-slide 1.2s ease-in-out infinite' }} />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', margin: '8px 0 0' }}>
                  {busy === 'file' ? 'Reading your resume... scans and photos use OCR and can take up to 40 seconds.' : 'Re-scoring your edited text...'}
                </p>
              </div>
            )}
          </div>
          <style>{'@keyframes resume-slide { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }'}</style>

          {/* FILE + IMAGE PREVIEW */}
          {file && (
            <div data-testid="file-preview" style={{ ...panel, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview of your uploaded resume" style={{ width: '88px', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)' }} />
              ) : (
                <FileText size={40} color="var(--color-emerald)" />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)', overflowWrap: 'anywhere' }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>{(file.size / 1024).toFixed(0)} KB</div>
              </div>
              <button type="button" onClick={clear} aria-label="Remove file and clear results" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-green)' }}><X size={18} /></button>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div role="alert" data-testid="resume-error" style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#991B1B' }}>
              <AlertCircle size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>This resume could not be analysed</strong>
                <span style={{ fontSize: '0.9rem' }}>{error}</span>
              </div>
            </div>
          )}

          {/* EMPTY STATE: nothing is shown until there is a real analysis */}
          {!report && !busy && !error && (
            <div data-testid="empty-state">
              <EmptyState
                title="No resume analysed yet"
                description="Choose your target role and upload a resume. Your score, fixes and skills will appear here. Nothing on this page is sample data."
              />
              {history.length > 0 && <div style={{ marginTop: '1.5rem' }}><HistoryChart history={history} /></div>}
            </div>
          )}

          {/* REPORT */}
          {report && (
            <div data-testid="report" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <ScoreOverview report={report} />
              <OcrNotice report={report} />

              {/* Edit the extracted text and re-score */}
              <div style={panel} data-testid="text-editor">
                <button type="button" onClick={() => setEditorOpen((o) => !o)} aria-expanded={editorOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)', padding: 0 }}>
                  {editorOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Edit extracted text and re-score
                </button>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', margin: '4px 0 0' }}>
                  OCR text can contain mistakes, please review it. Fix anything that was misread, then re-score. You do not need to upload the file again.
                </p>
                {editorOpen && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <textarea data-testid="resume-text" aria-label="Extracted resume text" value={text} onChange={(e) => setText(e.target.value)} rows={12} maxLength={60000} style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }} />
                    <div style={{ marginTop: '0.6rem' }}>
                      <Button variant="primary" size="sm" icon={RefreshCw} onClick={rescore} loading={busy === 'text'} disabled={!text.trim() || Boolean(busy)} data-testid="rescore">Re-score this text</Button>
                    </div>
                  </div>
                )}
              </div>

              <CategoryBars categories={report.categories} />
              <RankedFixes fixes={report.fixes} />
              <SkillChips skills={report.skills} />
              <KeywordGap report={report} />
              <BulletCoach tips={report.bulletCoach} />
              <LearningSteps steps={report.learningSteps} />
              <PracticeForCompany analysisId={report.analysisId} />
              <HistoryChart history={history} />
              <CompanyMatches matches={report.companyMatches} />
              <div style={{ textAlign: 'center' }}>
                <Link to="/roadmap" style={{ color: 'var(--color-emerald)', fontWeight: 700, fontSize: '0.9rem' }}>Build a roadmap to close these gaps &rarr;</Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResumeAnalyzerPage;
