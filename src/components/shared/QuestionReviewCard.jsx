import React, { useState } from 'react';
import { Check, Edit, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';

export const QuestionReviewCard = ({
  question,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  className = '',
}) => {
  const { addToast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(question.status || 'Needs Review');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(question.title);

  const handleApprove = async () => {
    try {
      if (onApprove) await onApprove(question.id);
      setCurrentStatus('Approved');
    } catch {
      // the page already told the admin why; the card stays in its current state
    }
  };

  const handleReject = async () => {
    try {
      if (onReject) await onReject(question.id);
      setCurrentStatus('Rejected');
    } catch {
      // the page already told the admin why
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    addToast(`Question #${question.number} updated.`, 'info');
    if (onEdit) onEdit(question.id, editedTitle);
  };

  return (
    <div
      data-testid="review-card"
      data-status={currentStatus}
      className={`card-floating ${className}`}
      style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-white)',
        border: '1px solid var(--color-border-subtle)',
        marginBottom: '1rem',
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--color-emerald)',
              backgroundColor: 'var(--color-lime-soft)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Question #{question.number}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
            {question.paperName}
          </span>
        </div>

        <Badge variant={currentStatus}>{currentStatus}</Badge>
      </div>

      {question.low_confidence && (
        <div
          role="note"
          data-testid="low-confidence"
          style={{ marginBottom: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-md)', background: '#FFFBEB', color: '#92400E', fontSize: '0.8rem', fontWeight: 600 }}
        >
          Read from a scan with low OCR confidence ({question.ocr_confidence}%). Check the wording against the original before approving.
        </div>
      )}

      {/* Question Title / Edit Input */}
      {isEditing ? (
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-emerald)',
              fontSize: '0.925rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <h4
          style={{
            fontSize: '1.15rem',
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-deep-forest)',
            lineHeight: 1.35,
            marginBottom: '1rem',
          }}
        >
          {editedTitle}
        </h4>
      )}

      {/* Metadata Pill Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
        }}
      >
        <div
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          Topic: <strong style={{ color: 'var(--color-deep-forest)' }}>{question.topic}</strong>
        </div>
        {question.subtopic && (
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--color-ivory-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            Subtopic: <strong style={{ color: 'var(--color-emerald)' }}>{question.subtopic}</strong>
          </div>
        )}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          Difficulty: <strong style={{ color: question.difficulty === 'Hard' ? 'var(--color-error)' : 'var(--color-dark-emerald)' }}>{question.difficulty}</strong>
        </div>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          Type: <strong style={{ color: 'var(--color-deep-forest)' }}>{question.type}</strong>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.5rem',
        }}
      >
        {currentStatus !== 'Approved' && currentStatus !== 'Published' && onApprove && (
          <Button
            variant="lime"
            size="sm"
            onClick={handleApprove}
            icon={Check}
          >
            Approve
          </Button>
        )}
        {currentStatus !== 'Rejected' && onReject && (
          <Button variant="outline" size="sm" onClick={handleReject} icon={X}>
            Reject
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} icon={Edit}>
            Edit
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(question.id)} icon={Trash2} style={{ color: 'var(--color-error)' }}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};
