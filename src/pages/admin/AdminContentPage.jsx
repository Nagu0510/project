import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { LoadingState } from '../../components/common/LoadingState';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit3, EyeOff, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

// ---- small helpers -----------------------------------------------------------------------------------
const splitList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);
const lines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);
const fieldStyle = { width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.9rem', fontFamily: 'inherit', background: 'var(--color-white)', color: 'var(--color-deep-forest)' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginBottom: '4px' };
const PAGE_SIZE = 20;

const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: '0.9rem' }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '3px' }}>{hint}</div>}
  </div>
);

/** What the server said was wrong, as a list the admin can act on. */
const FormErrors = ({ errors }) => (errors.length === 0 ? null : (
  <div role="alert" data-testid="form-errors" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: '#FEF2F2', border: '1.5px solid #F87171', color: '#991B1B', fontSize: '0.85rem' }}>
    <strong>Please fix the problems below:</strong>
    <ul style={{ margin: '6px 0 0 1.1rem', padding: 0 }}>
      {errors.map((e) => <li key={e}>{e}</li>)}
    </ul>
  </div>
));

const errorsOf = (err) => (Array.isArray(err?.detail?.errors) && err.detail.errors.length ? err.detail.errors : [err?.message || 'Something went wrong. Please try again.']);

// ---- questions --------------------------------------------------------------------------------------------
const blankQuestion = () => ({
  id: '', skill: '', topic: '', difficulty: 'Easy', question_type: 'Conceptual', question_text: '', code: '', language: '',
  options: ['', '', '', ''], correct_option_index: 0, explanation: '', practice: true, companies: [],
});

const QuestionsTab = ({ meta }) => {
  const { addToast } = useToast();
  const [filters, setFilters] = useState({ skill: '', difficulty: '', active: '', search: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null); // null | {mode: 'create'|'edit', form}
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    adminService.listContentQuestions({ ...filters, page, pageSize: PAGE_SIZE })
      .then((data) => alive && setRows(Array.isArray(data) ? data : []))
      .catch((err) => { if (alive) { setLoadError(err?.message || 'Please try again.'); setRows([]); } });
    return () => { alive = false; };
  }, [filters, page, reload]);

  const topicsFor = (skill) => [...new Set([...(meta.skill_topics[skill] || []), ...(meta.topics_in_use[skill] || [])])];

  const openCreate = () => { setErrors([]); setEditing({ mode: 'create', form: blankQuestion() }); };
  const openEdit = (q) => {
    setErrors([]);
    setEditing({ mode: 'edit', form: { ...blankQuestion(), ...q, code: q.code || '', language: q.language || '', companies: q.companies || [] } });
  };

  const save = async (e) => {
    e.preventDefault();
    const f = editing.form;
    const body = {
      id: editing.mode === 'create' ? (f.id.trim() || undefined) : undefined,
      skill: f.skill, topic: f.topic, difficulty: f.difficulty, question_type: f.question_type, question_text: f.question_text,
      code: f.code.trim() ? f.code : null, language: f.language.trim() || null,
      options: f.options, correct_option_index: Number(f.correct_option_index), explanation: f.explanation, practice: f.practice, companies: f.companies,
    };
    setSaving(true);
    setErrors([]);
    try {
      if (editing.mode === 'create') await adminService.createContentQuestion(body);
      else await adminService.updateContentQuestion(f.id, body);
      addToast(editing.mode === 'create' ? 'Question created.' : 'Question saved.', 'success');
      setEditing(null);
      setReload((n) => n + 1);
    } catch (err) {
      setErrors(errorsOf(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (q) => {
    try {
      await adminService.setContentQuestionActive(q.id, !q.active);
      addToast(q.active ? `${q.id} deactivated: students no longer see it.` : `${q.id} is active again.`, 'info');
      setReload((n) => n + 1);
    } catch (err) {
      addToast(err?.message || 'Could not change the question.', 'error');
    }
  };

  const setF = (patch) => setEditing((cur) => ({ ...cur, form: { ...cur.form, ...patch } }));

  return (
    <div data-testid="questions-tab">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div><label style={labelStyle} htmlFor="q-skill">Skill</label>
          <select id="q-skill" style={fieldStyle} value={filters.skill} onChange={(e) => { setPage(1); setFilters({ ...filters, skill: e.target.value }); }}>
            <option value="">All skills</option>
            {Object.keys(meta.skill_topics).map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label style={labelStyle} htmlFor="q-diff">Difficulty</label>
          <select id="q-diff" style={fieldStyle} value={filters.difficulty} onChange={(e) => { setPage(1); setFilters({ ...filters, difficulty: e.target.value }); }}>
            <option value="">Any</option>
            {meta.difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select></div>
        <div><label style={labelStyle} htmlFor="q-active">Status</label>
          <select id="q-active" style={fieldStyle} value={filters.active} onChange={(e) => { setPage(1); setFilters({ ...filters, active: e.target.value }); }}>
            <option value="">Active and inactive</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select></div>
        <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle} htmlFor="q-search">Search</label>
          <input id="q-search" style={fieldStyle} value={filters.search} placeholder="Text, id or topic" onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} /></div>
        <Button variant="primary" size="md" icon={Plus} onClick={openCreate} data-testid="new-question">New question</Button>
      </div>

      {loadError && <ErrorBanner title="Questions could not be loaded." message={loadError} onRetry={() => setReload((n) => n + 1)} />}
      {rows === null && <LoadingState message="Loading questions..." subtitle="One moment" />}
      {rows !== null && !loadError && rows.length === 0 && <EmptyState title="No questions match" description="Change the filters or create a new question." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {(rows || []).map((q) => (
          <div key={q.id} data-testid="question-row" data-active={q.active} className="card-static" style={{ padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-white)', border: '1px solid var(--color-border-subtle)', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', opacity: q.active ? 1 : 0.65 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 700 }}>{q.id} · {q.skill} · {q.topic} · {q.difficulty} · {q.question_type}{q.edited_by_admin ? ' · edited by admin' : ''}</div>
              <div style={{ color: 'var(--color-deep-forest)', fontSize: '0.92rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question_text}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Badge variant={q.active ? 'success' : 'neutral'} size="sm">{q.active ? 'Active' : 'Deactivated'}</Badge>
              <Button variant="outline" size="sm" icon={Edit3} onClick={() => openEdit(q)}>Edit</Button>
              <Button variant="ghost" size="sm" icon={q.active ? EyeOff : Eye} onClick={() => toggleActive(q)}>{q.active ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem', alignItems: 'center' }}>
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-deep-forest)' }}>Page {page}</span>
        <Button variant="outline" size="sm" icon={ChevronRight} iconPosition="right" disabled={!rows || rows.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>Next</Button>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.mode === 'create' ? 'New question' : `Edit ${editing.form.id}`} subtitle="Checked with the same rules as the seed data check.">
          <form onSubmit={save} data-testid="question-form">
            <FormErrors errors={errors} />
            {editing.mode === 'create' && (
              <Field label="Id (optional)" hint="Left empty, one is generated.">
                <input style={fieldStyle} value={editing.form.id} onChange={(e) => setF({ id: e.target.value })} data-testid="q-id" />
              </Field>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <Field label="Skill">
                <select style={fieldStyle} value={editing.form.skill} data-testid="q-skill-field" onChange={(e) => setF({ skill: e.target.value, topic: '' })}>
                  <option value="">Choose...</option>
                  {Object.keys(meta.skill_topics).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Topic">
                <select style={fieldStyle} value={editing.form.topic} data-testid="q-topic-field" onChange={(e) => setF({ topic: e.target.value })}>
                  <option value="">Choose...</option>
                  {topicsFor(editing.form.skill).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Difficulty">
                <select style={fieldStyle} value={editing.form.difficulty} onChange={(e) => setF({ difficulty: e.target.value })}>
                  {meta.difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select style={fieldStyle} value={editing.form.question_type} onChange={(e) => setF({ question_type: e.target.value })}>
                  {meta.question_types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Question">
              <textarea style={fieldStyle} rows={3} value={editing.form.question_text} data-testid="q-text" onChange={(e) => setF({ question_text: e.target.value })} />
            </Field>
            <Field label="Code (for Code Output and Find the Error questions)">
              <textarea style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }} rows={3} value={editing.form.code} onChange={(e) => setF({ code: e.target.value })} />
            </Field>
            <Field label="Code language (optional)">
              <input style={fieldStyle} value={editing.form.language} placeholder="python, javascript, c, cpp, java" onChange={(e) => setF({ language: e.target.value })} />
            </Field>
            <Field label="Options (choose the correct one)" hint="Exactly 4, all different.">
              {editing.form.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input type="radio" name="correct" aria-label={`Option ${i + 1} is correct`} checked={Number(editing.form.correct_option_index) === i} onChange={() => setF({ correct_option_index: i })} />
                  <input style={fieldStyle} value={opt} placeholder={`Option ${i + 1}`} data-testid={`q-option-${i}`} onChange={(e) => setF({ options: editing.form.options.map((o, j) => (j === i ? e.target.value : o)) })} />
                </div>
              ))}
            </Field>
            <Field label="Explanation (shown after the answer)">
              <textarea style={fieldStyle} rows={2} value={editing.form.explanation} data-testid="q-explanation" onChange={(e) => setF({ explanation: e.target.value })} />
            </Field>
            <Field label="Company style tags (pattern-inspired practice, not real past questions)">
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {meta.companies.map((c) => (
                  <label key={c} style={{ fontSize: '0.85rem', color: 'var(--color-deep-forest)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input type="checkbox" checked={editing.form.companies.includes(c)} onChange={(e) => setF({ companies: e.target.checked ? [...editing.form.companies, c] : editing.form.companies.filter((x) => x !== c) })} /> {c}
                  </label>
                ))}
              </div>
            </Field>
            <label style={{ fontSize: '0.88rem', color: 'var(--color-deep-forest)', display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '1rem' }}>
              <input type="checkbox" checked={editing.form.practice} onChange={(e) => setF({ practice: e.target.checked })} /> Available in practice mode (unticked: graded assessments only)
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button variant="outline" size="md" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="md" disabled={saving} data-testid="save-question">{saving ? 'Saving...' : 'Save question'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ---- courses -----------------------------------------------------------------------------------------------------
const courseToForm = (c) => ({
  slug: c?.slug || '', title: c?.title || '', level: c?.level || 'Beginner', description: c?.description || '',
  skills: (c?.skills || []).join(', '), prerequisites: (c?.prerequisites || []).join(', '), assessment_skills: (c?.assessment_skills || []).join(', '),
  practice_topics: (c?.practice_topics || []).join(', '), outcomes: (c?.outcomes || []).join('\n'),
  modules: (c?.modules || []).map((m) => `${m.title} | ${(m.topics || []).join(', ')} | ${m.hours}`).join('\n'),
  resources: (c?.resources || []).map((r) => `${r.provider} | ${r.url}`).join('\n'),
});

const formToCourse = (f, existing) => {
  const problems = [];
  const modules = lines(f.modules).map((line, i) => {
    const [title = '', topics = '', hours = ''] = line.split('|').map((p) => p.trim());
    if (!title || Number.isNaN(Number(hours)) || hours === '') problems.push(`Module line ${i + 1} must look like: Title | topic one, topic two | hours`);
    return { id: existing?.modules?.[i]?.id || null, title, topics: splitList(topics), hours: Number(hours) || 0 };
  });
  const resources = lines(f.resources).map((line, i) => {
    const [provider = '', url = ''] = line.split('|').map((p) => p.trim());
    if (!provider || !url) problems.push(`Resource line ${i + 1} must look like: Provider | https://provider.org/`);
    return { provider, url };
  });
  return {
    problems,
    body: {
      slug: f.slug.trim(), title: f.title, level: f.level, description: f.description, skills: splitList(f.skills), prerequisites: splitList(f.prerequisites),
      assessment_skills: splitList(f.assessment_skills), practice_topics: splitList(f.practice_topics), outcomes: lines(f.outcomes), modules, resources,
    },
  };
};

const CoursesTab = ({ meta }) => {
  const { addToast } = useToast();
  const [courses, setCourses] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    adminService.listContentCourses()
      .then((data) => alive && setCourses(Array.isArray(data) ? data : []))
      .catch((err) => { if (alive) { setLoadError(err?.message || 'Please try again.'); setCourses([]); } });
    return () => { alive = false; };
  }, [reload]);

  const save = async (e) => {
    e.preventDefault();
    const { body, problems } = formToCourse(editing.form, editing.existing);
    if (problems.length) { setErrors(problems); return; }
    setSaving(true);
    setErrors([]);
    try {
      if (editing.existing) await adminService.updateContentCourse(editing.existing.slug, body);
      else await adminService.createContentCourse(body);
      addToast('Course saved.', 'success');
      setEditing(null);
      setReload((n) => n + 1);
    } catch (err) {
      setErrors(errorsOf(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await adminService.setContentCourseActive(c.slug, !c.active);
      addToast(c.active ? `${c.title} hidden from the catalogue.` : `${c.title} is back in the catalogue.`, 'info');
      setReload((n) => n + 1);
    } catch (err) {
      addToast(err?.message || 'Could not change the course.', 'error');
    }
  };

  const setF = (patch) => setEditing((cur) => ({ ...cur, form: { ...cur.form, ...patch } }));

  return (
    <div data-testid="courses-tab">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Button variant="primary" size="md" icon={Plus} onClick={() => { setErrors([]); setEditing({ existing: null, form: courseToForm(null) }); }} data-testid="new-course">New course</Button>
      </div>
      {loadError && <ErrorBanner title="Courses could not be loaded." message={loadError} onRetry={() => setReload((n) => n + 1)} />}
      {courses === null && <LoadingState message="Loading courses..." subtitle="One moment" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {(courses || []).map((c) => (
          <div key={c.slug} data-testid="course-row" data-active={c.active} className="card-static" style={{ padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-white)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', opacity: c.active ? 1 : 0.65 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>{c.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>{c.slug} · {c.level} · {(c.modules || []).length} modules{c.edited_by_admin ? ' · edited by admin' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Badge variant={c.active ? 'success' : 'neutral'} size="sm">{c.active ? 'Active' : 'Deactivated'}</Badge>
              <Button variant="outline" size="sm" icon={Edit3} onClick={() => { setErrors([]); setEditing({ existing: c, form: courseToForm(c) }); }}>Edit</Button>
              <Button variant="ghost" size="sm" icon={c.active ? EyeOff : Eye} onClick={() => toggle(c)}>{c.active ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.existing ? `Edit ${editing.existing.title}` : 'New course'} subtitle="6 to 10 modules, 2 or 3 provider home pages, skills from the skill catalogue.">
          <form onSubmit={save} data-testid="course-form">
            <FormErrors errors={errors} />
            <Field label="Slug" hint="Lowercase letters, digits and dashes. It cannot change later.">
              <input style={fieldStyle} value={editing.form.slug} disabled={Boolean(editing.existing)} data-testid="c-slug" onChange={(e) => setF({ slug: e.target.value })} />
            </Field>
            <Field label="Title"><input style={fieldStyle} value={editing.form.title} data-testid="c-title" onChange={(e) => setF({ title: e.target.value })} /></Field>
            <Field label="Level">
              <select style={fieldStyle} value={editing.form.level} onChange={(e) => setF({ level: e.target.value })}>
                {meta.course_levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea style={fieldStyle} rows={2} value={editing.form.description} onChange={(e) => setF({ description: e.target.value })} /></Field>
            <Field label="Skills (comma separated)" hint={`Must be names from the skill catalogue, e.g. ${meta.catalogue_skills.slice(0, 6).join(', ')}`}>
              <input style={fieldStyle} value={editing.form.skills} data-testid="c-skills" onChange={(e) => setF({ skills: e.target.value })} />
            </Field>
            <Field label="Prerequisite course slugs (comma separated)"><input style={fieldStyle} value={editing.form.prerequisites} onChange={(e) => setF({ prerequisites: e.target.value })} /></Field>
            <Field label="Assessment skills (comma separated)" hint={`From: ${Object.keys(meta.skill_topics).join(', ')}`}><input style={fieldStyle} value={editing.form.assessment_skills} onChange={(e) => setF({ assessment_skills: e.target.value })} /></Field>
            <Field label="Practice topics (comma separated)"><input style={fieldStyle} value={editing.form.practice_topics} onChange={(e) => setF({ practice_topics: e.target.value })} /></Field>
            <Field label="Outcomes (one per line)"><textarea style={fieldStyle} rows={3} value={editing.form.outcomes} onChange={(e) => setF({ outcomes: e.target.value })} /></Field>
            <Field label="Modules (one per line)" hint="Title | topic one, topic two | hours">
              <textarea style={fieldStyle} rows={7} value={editing.form.modules} data-testid="c-modules" onChange={(e) => setF({ modules: e.target.value })} />
            </Field>
            <Field label="Resources (one per line)" hint="Provider | https://provider-home-page.org/ (the home page, never a deep link)">
              <textarea style={fieldStyle} rows={3} value={editing.form.resources} data-testid="c-resources" onChange={(e) => setF({ resources: e.target.value })} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button variant="outline" size="md" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="md" disabled={saving} data-testid="save-course">{saving ? 'Saving...' : 'Save course'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ---- career paths -----------------------------------------------------------------------------------------------------
const pathToForm = (p) => ({
  title: p.title, required_skills: (p.required_skills || []).join(', '),
  milestones: (p.milestones || []).map((m) => [m.id, m.number, m.title, (m.skills || []).join(', '), m.estimated_time || '', m.description || ''].join(' | ')).join('\n'),
});

const formToPath = (f) => {
  const problems = [];
  const milestones = lines(f.milestones).map((line, i) => {
    const [id = '', number = '', title = '', skills = '', estimated = '', ...rest] = line.split('|').map((p) => p.trim());
    if (!id || !title || Number.isNaN(Number(number)) || number === '') problems.push(`Milestone line ${i + 1} must look like: id | number | title | skill one, skill two | estimated time | description`);
    return { id, number: Number(number) || 0, title, skills: splitList(skills), estimated_time: estimated, description: rest.join(' | ') };
  });
  return { problems, body: { title: f.title.trim(), required_skills: splitList(f.required_skills), milestones } };
};

const PathsTab = () => {
  const { addToast } = useToast();
  const [paths, setPaths] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    adminService.listContentPaths()
      .then((data) => alive && setPaths(Array.isArray(data) ? data : []))
      .catch((err) => { if (alive) { setLoadError(err?.message || 'Please try again.'); setPaths([]); } });
    return () => { alive = false; };
  }, [reload]);

  const save = async (e) => {
    e.preventDefault();
    const { body, problems } = formToPath(editing.form);
    if (problems.length) { setErrors(problems); return; }
    setSaving(true);
    setErrors([]);
    try {
      await adminService.updateContentPath(editing.path.id, body);
      addToast('Career path saved.', 'success');
      setEditing(null);
      setReload((n) => n + 1);
    } catch (err) {
      setErrors(errorsOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="paths-tab">
      {loadError && <ErrorBanner title="Career paths could not be loaded." message={loadError} onRetry={() => setReload((n) => n + 1)} />}
      {paths === null && <LoadingState message="Loading career paths..." subtitle="One moment" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {(paths || []).map((p) => (
          <div key={p.id} data-testid="path-row" className="card-static" style={{ padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-white)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>{p.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>{p.id} · {(p.milestones || []).length} milestones · {(p.required_skills || []).length} required skills{p.edited_by_admin ? ' · edited by admin' : ''}</div>
            </div>
            <Button variant="outline" size="sm" icon={Edit3} onClick={() => { setErrors([]); setEditing({ path: p, form: pathToForm(p) }); }}>Edit</Button>
          </div>
        ))}
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={`Edit ${editing.path.title}`} subtitle="Saved roadmap progress follows a renamed path.">
          <form onSubmit={save} data-testid="path-form">
            <FormErrors errors={errors} />
            <Field label="Title"><input style={fieldStyle} value={editing.form.title} data-testid="p-title" onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })} /></Field>
            <Field label="Required skills (comma separated)"><input style={fieldStyle} value={editing.form.required_skills} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, required_skills: e.target.value } })} /></Field>
            <Field label="Milestones (one per line)" hint="id | number | title | skill one, skill two | estimated time | description. Numbers run 1, 2, 3 ... with no gaps.">
              <textarea style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }} rows={10} value={editing.form.milestones} data-testid="p-milestones" onChange={(e) => setEditing({ ...editing, form: { ...editing.form, milestones: e.target.value } })} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button variant="outline" size="md" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="md" disabled={saving} data-testid="save-path">{saving ? 'Saving...' : 'Save career path'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ---- the page --------------------------------------------------------------------------------------------------------------
const TABS = [['questions', 'Assessment questions'], ['courses', 'Courses'], ['paths', 'Career paths']];

export const AdminContentPage = () => {
  const [tab, setTab] = useState('questions');
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setMetaError('');
    adminService.getContentMeta()
      .then((m) => {
        if (!alive) return;
        if (!m || !m.skill_topics) throw new Error('The editor choices came back empty.');
        setMeta(m);
      })
      .catch((err) => { if (alive) setMetaError(err?.message || 'Please try again.'); });
    return () => { alive = false; };
  }, [reloadKey]);

  const content = useMemo(() => {
    if (!meta) return null;
    if (tab === 'questions') return <QuestionsTab meta={meta} />;
    if (tab === 'courses') return <CoursesTab meta={meta} />;
    return <PathsTab />;
  }, [tab, meta]);

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: 'var(--color-deep-forest)', margin: 0 }}>Content Editor</h1>
            <p style={{ color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '720px' }}>
              Create, edit and deactivate assessment questions, courses and career paths. Items you change are marked as edited by an admin, so re-seeding never overwrites them.
            </p>
          </div>
          <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {TABS.map(([key, label]) => (
              <Button key={key} variant={tab === key ? 'primary' : 'outline'} size="sm" onClick={() => setTab(key)} data-testid={`content-tab-${key}`}>{label}</Button>
            ))}
          </div>
          {metaError && <ErrorBanner title="The editor could not start." message={metaError} onRetry={() => setReloadKey((k) => k + 1)} />}
          {!meta && !metaError && <LoadingState message="Loading the editor..." subtitle="One moment" />}
          {content}
        </div>
      </main>
    </div>
  );
};

export default AdminContentPage;
