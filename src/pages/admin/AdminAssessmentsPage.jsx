import React, { useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { FileCheck2, Plus, Clock, Users, Play, Edit3, Trash2 } from 'lucide-react';

export const AdminAssessmentsPage = () => {
  const { addToast } = useToast();
  const assessments = [
    { id: 'asm-1', title: 'Full Stack & Backend Diagnostic', questions: 5, duration: '15 Mins', attempts: 842, avgScore: '82%', status: 'Active' },
    { id: 'asm-2', title: 'TCS NQT Full Placement Mock', questions: 30, duration: '45 Mins', attempts: 1250, avgScore: '74%', status: 'Active' },
    { id: 'asm-3', title: 'Infosys SP Coding Challenge', questions: 3, duration: '60 Mins', attempts: 610, avgScore: '68%', status: 'Active' },
    { id: 'asm-4', title: 'Accenture Cognitive & Technical', questions: 20, duration: '30 Mins', attempts: 490, avgScore: '86%', status: 'Active' },
    { id: 'asm-5', title: 'Core Java & OOP Evaluation', questions: 15, duration: '20 Mins', attempts: 720, avgScore: '79%', status: 'Draft' },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                  Skill Evaluation Management
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Diagnostic Assessments Pool
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Configure active student skill assessments, timer constraints, and passing criteria thresholds.
              </p>
            </div>

            <Button variant="primary" size="md" icon={Plus} onClick={() => addToast('Create assessment wizard initialized', 'info')}>
              Create Assessment Track
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {assessments.map((asm) => (
              <div
                key={asm.id}
                className="card-static"
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                      {asm.title}
                    </h3>
                    <Badge variant={asm.status === 'Active' ? 'success' : 'neutral'}>{asm.status}</Badge>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)', display: 'flex', gap: '12px' }}>
                    <span>{asm.questions} Questions</span>
                    <span>·</span>
                    <span>Duration: {asm.duration}</span>
                    <span>·</span>
                    <span>{asm.attempts} Student Attempts</span>
                    <span>·</span>
                    <span>Avg Score: <strong style={{ color: 'var(--color-emerald)' }}>{asm.avgScore}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="outline" size="sm" icon={Edit3} onClick={() => addToast(`Editing ${asm.title}`, 'info')}>
                    Edit
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => addToast(`Analytics for ${asm.title}`, 'info')}>
                    View Analytics
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
