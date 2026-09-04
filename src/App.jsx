import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';

// AuthGate & Route Guards
import { AuthModal } from './components/common/AuthModal';
import { StudentRoute } from './components/common/StudentRoute';
import { AdminRoute } from './components/common/AdminRoute';

// Public & Preview Pages
import { LandingPage } from './pages/LandingPage';
import { FeaturesPage } from './pages/public/FeaturesPage';
import { AboutPage } from './pages/public/AboutPage';
import { CareerPathsPage } from './pages/CareerPathsPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import { CodingPracticePage } from './pages/CodingPracticePage';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { PlacementTrackerPage } from './pages/PlacementTrackerPage';
import { PreviousQuestionsPage } from './pages/PreviousQuestionsPage';
import { CompanyInsightsPage } from './pages/CompanyInsightsPage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Student Protected Pages
import { DashboardPage } from './pages/DashboardPage';
import { AssessmentResultsPage } from './pages/AssessmentResultsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

// Admin Protected Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminQuestionPapersPage } from './pages/admin/AdminQuestionPapersPage';
import { AdminQuestionBankPage } from './pages/admin/AdminQuestionBankPage';
import { AdminAssessmentsPage } from './pages/admin/AdminAssessmentsPage';
import { AdminCompaniesPage } from './pages/admin/AdminCompaniesPage';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

export function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            {/* Global AuthGate Modal */}
            <AuthModal />

            <Routes>
              {/* ================= PUBLIC EXPLORATION & PREVIEWS ================= */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/career-paths" element={<CareerPathsPage />} />
              
              {/* Roadmap Public & Preview */}
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/roadmap-preview" element={<RoadmapPage />} />

              {/* Assessment Public & Preview */}
              <Route path="/assessment" element={<SkillAssessmentPage />} />
              <Route path="/assessment-preview" element={<SkillAssessmentPage />} />

              {/* Practice IDE Public & Preview */}
              <Route path="/practice" element={<CodingPracticePage />} />
              <Route path="/practice-preview" element={<CodingPracticePage />} />

              {/* Resume Analyzer Public & Preview */}
              <Route path="/resume-analyzer" element={<ResumeAnalyzerPage />} />
              <Route path="/resume-analyzer-preview" element={<ResumeAnalyzerPage />} />

              {/* Placement Tracker Public & Preview */}
              <Route path="/placement-tracker" element={<PlacementTrackerPage />} />
              <Route path="/placements" element={<PlacementTrackerPage />} />
              <Route path="/placements-preview" element={<PlacementTrackerPage />} />

              {/* Previous Questions Public & Preview */}
              <Route path="/previous-questions" element={<PreviousQuestionsPage />} />
              <Route path="/previous-questions-preview" element={<PreviousQuestionsPage />} />

              {/* Company Insights Public */}
              <Route path="/company-prep/:companyId" element={<CompanyInsightsPage />} />
              <Route path="/company-prep" element={<CompanyInsightsPage />} />

              {/* Public Authentication */}
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* ================= STUDENT PROTECTED ROUTES ================= */}
              <Route
                path="/dashboard"
                element={
                  <StudentRoute>
                    <DashboardPage />
                  </StudentRoute>
                }
              />
              <Route
                path="/assessment-results"
                element={
                  <StudentRoute>
                    <AssessmentResultsPage />
                  </StudentRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <StudentRoute>
                    <ProfilePage />
                  </StudentRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <StudentRoute>
                    <SettingsPage />
                  </StudentRoute>
                }
              />

              {/* ================= ADMIN PROTECTED ROUTES ================= */}
              <Route
                path="/admin/dashboard"
                element={
                  <AdminRoute>
                    <AdminDashboardPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/question-papers"
                element={
                  <AdminRoute>
                    <AdminQuestionPapersPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/question-bank"
                element={
                  <AdminRoute>
                    <AdminQuestionBankPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/assessments"
                element={
                  <AdminRoute>
                    <AdminAssessmentsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/companies"
                element={
                  <AdminRoute>
                    <AdminCompaniesPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <AdminRoute>
                    <AdminStudentsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <AdminRoute>
                    <AdminAnalyticsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <AdminRoute>
                    <AdminSettingsPage />
                  </AdminRoute>
                }
              />

              {/* Legacy Route Redirects */}
              <Route path="/question-papers" element={<Navigate to="/admin/question-papers" replace />} />
              <Route path="/admin/questions" element={<AdminRoute><AdminQuestionPapersPage /></AdminRoute>} />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
