import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const QuestionPaperIntelligencePage = () => {
  const { isAdmin } = useAuth();
  
  if (isAdmin) {
    return <Navigate to="/admin/question-papers" replace />;
  }
  
  return <Navigate to="/previous-questions" replace />;
};
