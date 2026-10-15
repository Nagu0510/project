// Builds "TCS NQT (2025)" from a company, an exam name and a year without repeating any of them.
// Mirrors format_exam_origin in backend/app/services/question_matching_service.py.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function formatExamOrigin(company, exam, year) {
  const short = String(company || '').split('(')[0].trim(); // "TCS (Tata Consultancy Services)" -> "TCS"
  let name = String(exam || '').trim();
  const yearText = year === null || year === undefined || year === 0 ? '' : String(year).trim();

  if (yearText) {
    // drop the year wherever the exam name already carries it ("— 2025", "(2025)", "2025"), then tidy separators
    name = name
      .replace(new RegExp(`\\s*[(\\[]?\\s*(?<!\\d)${escapeRegExp(yearText)}(?!\\d)\\s*[)\\]]?`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-—–:,]+|[\s\-—–:,]+$/g, '');
  }

  const hasCompany = short && new RegExp(`(?<!\\w)${escapeRegExp(short)}(?!\\w)`, 'i').test(name);
  const label = [hasCompany ? '' : short, name].filter(Boolean).join(' ') || 'Previous placement paper';
  return yearText ? `${label} (${yearText})` : label;
}

export default formatExamOrigin;
