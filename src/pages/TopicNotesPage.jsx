import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { topicNotesService } from '../services/topicNotesService';
import {
  FileText,
  Download,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const KNOWN_TOPICS = [
  'Core Computer Science',
  'SQL & Databases',
  'General Aptitude',
  'Arrays',
  'Strings',
  'Stacks',
  'Linked Lists',
  'System Design & Architecture',
];

const normalizeKey = (val = '') => val.toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveTopic = (raw = '') => {
  const norm = normalizeKey(raw);
  const found = KNOWN_TOPICS.find((t) => normalizeKey(t) === norm);
  if (found) return found;
  const partial = KNOWN_TOPICS.find((t) => normalizeKey(t).includes(norm) || norm.includes(normalizeKey(t)));
  if (partial) return partial;
  return decodeURIComponent(raw).replace(/[-_]+/g, ' ').trim();
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (raw) => {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
      ? raw
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return raw;
  }
};

export const TopicNotesPage = () => {
  const { topicKey } = useParams();
  const { isAuthenticated, user } = useAuth();
  const canonicalTopic = resolveTopic(topicKey);

  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchNotes = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await topicNotesService.getNotesForTopic(canonicalTopic);
        if (alive) setNotes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) {
          setLoadError(err?.message || 'Failed to load study notes.');
          setNotes([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchNotes();
    return () => {
      alive = false;
    };
  }, [canonicalTopic, reloadKey]);

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1100px', margin: '0 auto' }}>
          
          {/* Back Navigation */}
          <div style={{ marginBottom: '1.25rem' }}>
            <Link
              to="/previous-questions"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                color: 'var(--color-muted-green)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} />
              Back to Previous Placement Questions
            </Link>
          </div>

          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--accent)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
                  Topic Study Materials
                </span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {canonicalTopic}
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-muted-green)', marginTop: '6px', maxWidth: '680px' }}>
                Study notes and reference materials published by platform administrators for placement technical interview preparation.
              </p>
            </div>

            {user?.role === 'admin' && (
              <Link to="/admin/content?tab=notes">
                <Button variant="lime" size="sm" icon={Layers}>
                  Manage Topic Notes ↗
                </Button>
              </Link>
            )}
          </div>

          {/* Error Banner */}
          {loadError && (
            <ErrorBanner
              title="Could not load topic notes"
              message={loadError}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {/* Loading State */}
          {loading && (
            <LoadingState
              message={`Loading study notes for ${canonicalTopic}...`}
              subtitle="Fetching published reference documents"
            />
          )}

          {/* Empty State */}
          {!loading && !loadError && notes && notes.length === 0 && (
            <EmptyState
              title={`No notes for ${canonicalTopic}`}
              description="Notes for this topic will be added soon"
              actionText="Back to Questions"
              onAction={() => window.location.assign('/previous-questions')}
            />
          )}

          {/* Notes Cards List */}
          {!loading && notes && notes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {notes.map((note) => {
                const downloadUrl = topicNotesService.getDownloadUrl(note.id);

                return (
                  <div
                    key={note.id}
                    className="card-static"
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--surface)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={22} />
                        </div>
                        <div>
                          <h3
                            style={{
                              fontSize: '1.2rem',
                              fontFamily: 'var(--font-serif)',
                              color: 'var(--text)',
                              margin: '0 0 4px 0',
                            }}
                          >
                            {note.title}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                            <Badge variant="lime" size="sm">
                              {note.topic}
                            </Badge>
                            {note.created_at && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={13} />
                                {formatDate(note.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Download / Open Action */}
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <Button variant="lime" size="sm" icon={Download}>
                          Download / Open ↗
                        </Button>
                      </a>
                    </div>

                    {/* Description */}
                    {note.description && (
                      <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text)', lineHeight: 1.55 }}>
                        {note.description}
                      </p>
                    )}

                    {/* File metadata footer */}
                    {note.filename && (
                      <div
                        style={{
                          padding: '0.65rem 0.9rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--color-border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.825rem',
                          color: 'var(--color-muted-green)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text)' }}>
                          <FileText size={15} color="var(--accent)" />
                          {note.filename}
                        </span>
                        <span>{formatFileSize(note.file_size)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TopicNotesPage;
