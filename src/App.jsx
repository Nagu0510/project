import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';

// AuthGate & Route Guards & Common UI
import { AuthModal } from './components/common/AuthModal';
import { StudentRoute } from './components/common/StudentRoute';
import { AdminRoute } from './components/common/AdminRoute';
import { LoadingState } from './components/common/LoadingState';

// Synchronous Core Public Landing
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';

// Lazy Loaded Features & Protected Pages (Code Splitting)
const FeaturesPage = lazy(() => import('./pages/public/FeaturesPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const CareerPathsPage = lazy(() => import('./pages/CareerPathsPage'));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'));
const SkillAssessmentPage = lazy(() => import('./pages/SkillAssessmentPage'));
const CodingPracticePage = lazy(() => import('./pages/CodingPracticePage'));
const ResumeAnalyzerPage = lazy(() => import('./pages/ResumeAnalyzerPage'));
const PlacementTrackerPage = lazy(() => import('./pages/PlacementTrackerPage'));
const PreviousQuestionsPage = lazy(() => import('./pages/PreviousQuestionsPage'));
const CompanyInsightsPage = lazy(() => import('./pages/CompanyInsightsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Lazy Loaded Student Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AssessmentResultsPage = lazy(() => import('./pages/AssessmentResultsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Lazy Loaded Admin Pages
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminQuestionPapersPage = lazy(() => import('./pages/admin/AdminQuestionPapersPage'));
const AdminQuestionBankPage = lazy(() => import('./pages/admin/AdminQuestionBankPage'));
const AdminAssessmentsPage = lazy(() => import('./pages/admin/AdminAssessmentsPage'));
const AdminCompaniesPage = lazy(() => import('./pages/admin/AdminCompaniesPage'));
const AdminStudentsPage = lazy(() => import('./pages/admin/AdminStudentsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

export function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            {/* Global AuthGate Modal */}
            <AuthModal />

            <Suspense fallback={<LoadingState message="Loading SkillSense AI..." subtitle="Preparing workspace resources" />}>
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
            </Suspense>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
