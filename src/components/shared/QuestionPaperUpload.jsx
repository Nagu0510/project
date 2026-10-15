import React, { useState } from 'react';
import { Upload, FileText, X, CheckCircle2, ArrowRight, Loader2, Sparkles, Layers } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';

// Choices offered by the upload form (form options, not data)
const PAPER_COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'Capgemini', 'Deloitte', 'Amazon', 'Microsoft', 'Google', 'Other'];
const PAPER_TYPES = ['Coding', 'Technical', 'Aptitude', 'MCQ', 'Mixed'];
const PAPER_YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

export const QuestionPaperUpload = ({ onUploadComplete, onReviewQuestions }) => {
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form Fields
  const [company, setCompany] = useState('TCS');
  const [examName, setExamName] = useState('TCS NQT 2025');
  const [year, setYear] = useState('2025');
  const [paperType, setPaperType] = useState('Mixed');
  const [role, setRole] = useState('Ninja / Digital Cadre');
  const [description, setDescription] = useState('');

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [uploadedResult, setUploadedResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const steps = [
    "Uploading paper to secure workspace...",
    "Extracting questions & equations...",
    "Detecting topics & subtopics...",
    "Detecting difficulty & question patterns...",
    "Building question intelligence & cross-exam matches...",
    "Finalizing extraction pipeline...",
  ];

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile({
        rawFile: droppedFile,
        name: droppedFile.name,
        size: (droppedFile.size / (1024 * 1024)).toFixed(2) + ' MB',
      });
      addToast(`Selected file: ${droppedFile.name}`, 'info');
    }
  };

  const handleFileSelect = (e) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile({
        rawFile: selected,
        name: selected.name,
        size: (selected.size / (1024 * 1024)).toFixed(2) + ' MB',
      });
      addToast(`Selected file: ${selected.name}`, 'info');
    }
  };

  const startAnalysisSimulation = async (e) => {
    e.preventDefault();
    setUploadError(null);

    if (!file?.rawFile) {
      setUploadError('Please select a question paper file to upload.');
      addToast('Please select a question paper file to upload.', 'error');
      return;
    }
    if (file.rawFile.size > 8 * 1024 * 1024) {
      setUploadError('The file is larger than the 8 MB limit.');
      addToast('The file is larger than the 8 MB limit.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingStep(0);
    setIsCompleted(false);

    try {
      // Advance steps smoothly during processing
      const stepInterval = setInterval(() => {
        setProcessingStep((prev) => (prev < steps.length - 2 ? prev + 1 : prev));
      }, 400);

      const response = await adminService.uploadQuestionPaper(file.rawFile, {
        company,
        exam: examName,
        year: parseInt(year) || 2025,
        paperType,
        role,
        description,
      });

      clearInterval(stepInterval);
      setProcessingStep(steps.length - 1);

      setTimeout(() => {
        setIsProcessing(false);
        setIsCompleted(true);
        setUploadedResult(response);
        addToast(`Paper read: ${response.questions_count ?? 0} questions are waiting for review.${response.ocr_used ? ` OCR confidence ${response.ocr_confidence}%.` : ''}`, response.warnings?.length ? 'warning' : 'success');
        if (onUploadComplete) {
          onUploadComplete(response);
        }
      }, 500);

    } catch (err) {
      setIsProcessing(false);
      setIsCompleted(false);
      const errMsg = err?.message || 'Failed to upload and extract question paper.';
      setUploadError(errMsg);
      addToast(errMsg, 'error');
    }
  };

  const resetForm = () => {
    setFile(null);
    setIsCompleted(false);
    setIsProcessing(false);
    setProcessingStep(0);
    setUploadedResult(null);
    setUploadError(null);
  };

  return (
    <div
      className="card-static"
      style={{
        padding: '2rem',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {!isProcessing && !isCompleted ? (
        <form onSubmit={startAnalysisSimulation}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
              Upload Previous Question Paper
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-green)', marginTop: '4px' }}>
              Upload placement question sheets, campus drive papers, or coding tests for automatic AI intelligence extraction.
            </p>
          </div>

          {uploadError && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #F87171',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                color: '#991B1B',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span>
              <span>{uploadError}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            style={{
              padding: '2rem 1.5rem',
              borderRadius: 'var(--radius-lg)',
              border: `2px dashed ${isDragging ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
              backgroundColor: isDragging ? 'var(--color-emerald-alpha)' : 'var(--color-ivory-surface)',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '1.5rem',
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('paper-file-input')?.click()}
          >
            <input
              id="paper-file-input"
              type="file"
              accept=".pdf,.docx,.txt,.json,.png,.jpg,.jpeg,.webp" data-testid="paper-file-input"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {!file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-emerald)',
                    marginBottom: '0.75rem',
                  }}
                >
                  <Upload size={24} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
                  Drag and drop your question paper here
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 600, marginTop: '2px' }}>
                  or Browse files
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '6px' }}>
                  PDF · DOCX · TXT · JSON · PNG · JPG · WEBP, 8 MB at most. Scans and photos are read with OCR. Every extracted question starts as Needs Review.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-white)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  maxWidth: '460px',
                  margin: '0 auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={22} color="var(--color-emerald)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)' }}>
                      {file.size}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-error)',
                    padding: '4px',
                  }}
                  title="Remove file"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Form Fields Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <Select
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              options={PAPER_COMPANIES}
              required
            />

            <Input
              label="Exam / Drive Name"
              placeholder="e.g. TCS NQT 2025"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              required
            />

            <Select
              label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={PAPER_YEARS}
              required
            />

            <Select
              label="Paper Type"
              value={paperType}
              onChange={(e) => setPaperType(e.target.value)}
              options={PAPER_TYPES}
              required
            />

            <Input
              label="Target Role (Optional)"
              placeholder="e.g. Digital / Ninja / SDE"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />

            <Input
              label="Description (Optional)"
              placeholder="e.g. 1st Slot Morning Assessment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={Sparkles}
              iconPosition="right"
            >
              Upload & Analyze Paper ↗
            </Button>
          </div>
        </form>
      ) : isProcessing ? (
        /* Processing Simulation State */
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(15, 118, 110, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <Loader2 size={32} color="var(--color-emerald)" className="animate-spin" />
          </div>

          <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
            Extracting Question Intelligence
          </h3>
          <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginBottom: '1.75rem' }}>
            Parsing sections, identifying programming paradigms, and indexing topic vectors.
          </p>

          <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
            {steps.map((stepText, idx) => {
              const isDone = idx < processingStep;
              const isCurrent = idx === processingStep;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isCurrent ? 'var(--color-lime-soft)' : isDone ? 'var(--color-ivory-surface)' : 'transparent',
                    border: `1px solid ${isCurrent ? 'rgba(199, 243, 107, 0.5)' : isDone ? 'var(--color-border-subtle)' : 'transparent'}`,
                    opacity: idx > processingStep ? 0.35 : 1,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={18} color="#10B981" />
                  ) : isCurrent ? (
                    <Loader2 size={18} color="var(--color-emerald)" className="animate-spin" />
                  ) : (
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid var(--color-border-medium)', display: 'inline-block' }} />
                  )}
                  <span style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 700 : 500, color: 'var(--color-deep-forest)' }}>
                    {stepText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Completed Extraction State */
        <div style={{ padding: '2rem 1rem', textAlign: 'center' }} className="animate-fade-in">
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-lime-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-deep-forest)',
              margin: '0 auto 1.25rem',
            }}
          >
            <CheckCircle2 size={34} color="var(--color-emerald)" />
          </div>

          <h3 style={{ fontSize: '1.6rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.4rem 0' }}>
            Paper analyzed successfully
          </h3>
          <p style={{ fontSize: '1.05rem', color: 'var(--color-emerald)', fontWeight: 700, marginBottom: '1.5rem' }}>
            120 questions detected & indexed
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="primary"
              size="md"
              icon={Sparkles}
              onClick={() => {
                if (onReviewQuestions) onReviewQuestions();
              }}
            >
              Review Questions
            </Button>
            <Button variant="outline" size="md" onClick={resetForm}>
              Back to Papers
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
