import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';

import DashboardLayout from './layouts/DashboardLayout';
import WelcomePage from './components/WelcomePage';
import LoginPage from './pages/auth/LoginPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUserManagerPage from './pages/admin/AdminUserManagerPage';
import AdminDepartmentManagerPage from './pages/admin/AdminDepartmentManagerPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';
import AdminProjectsPage from './pages/admin/AdminProjectsPage';
import MeetingsPage from './pages/common/MeetingsPage';
import CalendarPage from './pages/common/CalendarPage';
import GlobalSearchPage from './pages/common/GlobalSearchPage';
import ReportsAnalyticsPage from './pages/common/ReportsAnalyticsPage';
import ActivityTimePage from './pages/common/ActivityTimePage';

import LeaderDashboardPage from './pages/teamLeader/LeaderDashboardPage';
import LeaderTeamManagementPage from './pages/teamLeader/LeaderTeamManagementPage';
import LeaderAssignTaskPage from './pages/teamLeader/LeaderAssignTaskPage';
import LeaderTaskTrackingPage from './pages/teamLeader/LeaderTaskTrackingPage';
import LeaderCollaborationPage from './pages/teamLeader/LeaderCollaborationPage';

import MemberDashboardPage from './pages/teamMember/MemberDashboardPage';
import MemberTodoListPage from './pages/teamMember/MemberTodoListPage';
import MemberAIAssistantPage from './pages/teamMember/MemberAIAssistantPage';
import MemberMyTasksPage from './pages/teamMember/MemberMyTasksPage';
import MemberAcknowledgmentsPage from './pages/teamMember/MemberAcknowledgmentsPage';
import MemberTaskHistoryPage from './pages/teamMember/MemberTaskHistoryPage';
import MemberCollaborationPage from './pages/teamMember/MemberCollaborationPage';

import ProfilePage from './pages/common/ProfilePage';
import ThemeToggle from './components/ThemeToggle';

import './App.css';
import './styles/taskflow.css';
import './styles/meetings.css';

const THEME_STORAGE_KEY = 'taskflow-theme-preference';

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch (error) {
    console.error('Failed to read the saved theme:', error);
    return 'dark';
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [theme, setTheme] = useState(readSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Failed to save the selected theme:', error);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  // Sync initial authMode based on pathname
  useEffect(() => {
    if (location.pathname === '/admin/login') {
      setAuthMode('admin-login');
    } else if (location.pathname === '/signup') {
      setAuthMode('login');
      navigate('/login', { replace: true });
    } else if (location.pathname === '/login') {
      setAuthMode('login');
    }
  }, [location.pathname, navigate]);

  // Session check on load
  const checkSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await api.session();
      if (res?.user && res.user.isActive !== false) {
        setUser(res.user);
        setCurrentTab('dashboard');
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Handle regular user / member / leader login
  const handleLogin = async (identifier, password) => {
    setAuthError('');
    setAuthNotice('');
    const res = await api.login(identifier, password);
    if (res?.user) {
      setUser(res.user);
      setCurrentTab('dashboard');
      navigate('/');
    }
  };

  // Handle dedicated Admin login
  const handleAdminLogin = async (identifier, password) => {
    setAuthError('');
    setAuthNotice('');
    const res = await api.login(identifier, password, true);
    if (res?.user) {
      if (res.user.role !== 'admin') {
        throw new Error('This account does not have Administrator privileges. Please use the standard login.');
      }
      setUser(res.user);
      setCurrentTab('dashboard');
      navigate('/');
    }
  };

  // Handle confirmed Logout
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setAuthMode('login');
      setCurrentTab('dashboard');
      navigate('/login');
    }
  };

  // Loading Screen
  if (authLoading) {
    return (
      <div className="tf-auth-container" data-theme={theme}>
        <ThemeToggle theme={theme} onToggleTheme={toggleTheme} />
        <div className="tf-loading-box">
          <div className="tf-spin" style={{ width: 36, height: 36, border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ marginTop: 14, fontWeight: 600, color: '#475569' }}>Loading Team Task Management System…</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Views
  if (!user) {
    if (location.pathname === '/') {
      return (
        <WelcomePage
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogin={() => navigate('/login')}
        />
      );
    }

    if (authMode === 'admin-login') {
      return (
        <AdminLoginPage
          theme={theme}
          onToggleTheme={toggleTheme}
          onAdminLogin={handleAdminLogin}
          onNavigateToLogin={() => {
            setAuthMode('login');
            navigate('/login');
          }}
          error={authError}
          notice={authNotice}
        />
      );
    }

    // Default: LoginPage
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogin={handleLogin}
        onNavigateHome={() => navigate('/')}
        onNavigateToAdminLogin={() => {
          setAuthMode('admin-login');
          navigate('/admin/login');
        }}
        error={authError}
        notice={authNotice}
      />
    );
  }

  // Authenticated Role-Based Views
  const role = user.role || 'team_member';

  const renderRolePage = () => {
    // 1. ADMIN ROLE
    if (role === 'admin') {
      switch (currentTab) {
        case 'dashboard':
          return <AdminDashboardPage />;
        case 'users':
          return <AdminUserManagerPage />;
        case 'departments':
          return <AdminDepartmentManagerPage />;
        case 'audit-logs':
          return <AdminAuditLogsPage />;
        case 'collaboration':
          return <AdminProjectsPage />;
        case 'calendar':
          return <CalendarPage role={role} />;
        case 'search':
          return <GlobalSearchPage role={role} />;
        case 'reports':
          return <ReportsAnalyticsPage role={role} user={user} />;
        case 'activity':
          return <ActivityTimePage role={role} />;
        case 'meetings':
          return <MeetingsPage user={user} />;
        case 'profile':
          return <ProfilePage user={user} onUserUpdated={setUser} onBack={() => setCurrentTab('dashboard')} />;
        default:
          return <AdminDashboardPage />;
      }
    }

    // 2. TEAM LEADER ROLE
    if (role === 'team_leader') {
      switch (currentTab) {
        case 'dashboard':
          return <LeaderDashboardPage />;
        case 'team':
          return <LeaderTeamManagementPage />;
        case 'assign-task':
          return <LeaderAssignTaskPage />;
        case 'tasks':
          return <LeaderTaskTrackingPage />;
        case 'collaboration':
          return <LeaderCollaborationPage />;
        case 'calendar':
          return <CalendarPage role={role} />;
        case 'search':
          return <GlobalSearchPage role={role} />;
        case 'reports':
          return <ReportsAnalyticsPage role={role} user={user} />;
        case 'activity':
          return <ActivityTimePage role={role} />;
        case 'meetings':
          return <MeetingsPage user={user} />;
        case 'profile':
          return <ProfilePage user={user} onUserUpdated={setUser} onBack={() => setCurrentTab('dashboard')} />;
        default:
          return <LeaderDashboardPage onNavigateTab={setCurrentTab} />;
      }
    }

    // 3. TEAM MEMBER ROLE
    switch (currentTab) {
      case 'dashboard':
        return <MemberDashboardPage onNavigateTab={setCurrentTab} />;
      case 'todo-list':
        return <MemberTodoListPage />;
      case 'ai-assistant':
        return <MemberAIAssistantPage />;
      case 'tasks':
        return <MemberMyTasksPage />;
      case 'collaboration':
        return <MemberCollaborationPage />;
      case 'acknowledgments':
        return <MemberAcknowledgmentsPage onNavigateTab={setCurrentTab} />;
      case 'history':
        return <MemberTaskHistoryPage />;
      case 'calendar':
        return <CalendarPage role={role} />;
      case 'search':
        return <GlobalSearchPage role={role} />;
      case 'reports':
        return <ReportsAnalyticsPage role={role} user={user} />;
      case 'activity':
        return <ActivityTimePage role={role} />;
      case 'meetings':
        return <MeetingsPage user={user} />;
      case 'profile':
        return <ProfilePage user={user} onUserUpdated={setUser} onBack={() => setCurrentTab('dashboard')} />;
      default:
        return <MemberDashboardPage onNavigateTab={setCurrentTab} />;
    }
  };

  return (
    <DashboardLayout
      user={user}
      theme={theme}
      onToggleTheme={toggleTheme}
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      onLogout={handleLogout}
    >
      {renderRolePage()}
    </DashboardLayout>
  );
}

export default App;
