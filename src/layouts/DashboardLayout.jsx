import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ScrollText,
  PlusCircle,
  ListTodo,
  CheckSquare,
  History,
  LogOut,
  Menu,
  X,
  Layers,
  Video,
  CalendarDays,
  Search,
  BarChart3,
  FolderKanban,
} from 'lucide-react';
import NotificationDropdown from '../components/NotificationDropdown';
import ConfirmModal from '../components/ConfirmModal';
import ThemeToggle from '../components/ThemeToggle';
import GlobalSearchTopbar from '../components/GlobalSearchTopbar';
import SmartAssistantDock from '../components/SmartAssistantDock';
import ActivityTracker from '../components/ActivityTracker';

function DashboardLayout({
  user,
  currentTab,
  onSelectTab,
  onLogout,
  theme,
  onToggleTheme,
  children,
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const role = user?.role || 'team_member';

  // Navigation items by role according to requirements
  const getNavItems = () => {
    if (role === 'admin') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'departments', label: 'Department Management', icon: Briefcase },
        { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
        { id: 'collaboration', label: 'Team Collaboration', icon: FolderKanban },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'search', label: 'Advance Search', icon: Search },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'activity', label: 'Activity Time', icon: History },
        { id: 'meetings', label: 'Meetings', icon: Video },
      ];
    }
    if (role === 'team_leader') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'team', label: 'Team Management', icon: Users },
        { id: 'assign-task', label: 'Assign Tasks', icon: PlusCircle },
        { id: 'tasks', label: 'Task Tracking', icon: ListTodo },
        { id: 'collaboration', label: 'Team Collaboration', icon: FolderKanban },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'search', label: 'Advance Search', icon: Search },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'activity', label: 'Activity Time', icon: History },
        { id: 'meetings', label: 'Meetings', icon: Video },
      ];
    }
    // Team Member
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'todo-list', label: 'Todo List', icon: ListTodo },
      { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
      { id: 'collaboration', label: 'Team Collaboration', icon: FolderKanban },
      { id: 'history', label: 'Task History', icon: History },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
      { id: 'search', label: 'Advance Search', icon: Search },
      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { id: 'activity', label: 'Activity Time', icon: History },
      { id: 'meetings', label: 'Meetings', icon: Video },
    ];
  };

  const navItems = getNavItems();

  const handleNavClick = (tabId) => {
    onSelectTab(tabId);
    setMobileSidebarOpen(false);
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await onLogout();
  };

  return (
    <div className="tf-dashboard-shell" data-theme={theme}>
      <ActivityTracker userId={user?.id} />
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="tf-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dark Navy-Blue Left Sidebar */}
      <aside className={`tf-sidebar ${mobileSidebarOpen ? 'tf-sidebar-mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="tf-sidebar-brand">
          <div className="tf-brand-icon">
            <Layers size={22} className="tf-brand-symbol" />
          </div>
          <div className="tf-brand-info">
            <h2 className="tf-brand-name">Team Task</h2>
            <span className="tf-brand-tagline">Management System</span>
          </div>
          <button
            type="button"
            className="tf-mobile-close-btn"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="tf-sidebar-nav" aria-label="Main Navigation">
          <div className="tf-nav-section-title">MAIN MENU</div>
          <ul className="tf-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`tf-nav-btn ${isActive ? 'tf-nav-active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon size={18} className="tf-nav-icon" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer with Logout Button */}
        <div className="tf-sidebar-footer">
          <button
            type="button"
            className="tf-logout-btn"
            onClick={handleLogoutClick}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="tf-main-wrapper">
        {/* Top Navigation Bar */}
        <header className="tf-topbar">
          <div className="tf-topbar-left">
            <button
              type="button"
              className="tf-hamburger-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={22} />
            </button>
            <div className="tf-page-title-box">
              <h1 className="tf-page-title">
                {currentTab === 'profile'
                  ? 'Profile'
                  : navItems.find((item) => item.id === currentTab)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Global Search Bar at Top of the Page */}
          <div className="tf-topbar-center">
            <GlobalSearchTopbar role={role} onSelectTab={handleNavClick} />
          </div>

          <div className="tf-topbar-right">
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
            {/* In-app Notification Dropdown */}
            <NotificationDropdown onSelectTab={handleNavClick} />

            {/* Profile Chip */}
            <div
              className="tf-profile-chip"
              onClick={() => handleNavClick('profile')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleNavClick('profile')}
              title="View profile"
            >
              <div className="tf-chip-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt={user.name} />
                ) : (
                  <span>{user?.name?.slice(0, 2).toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="tf-chip-info">
                <span className="tf-chip-name">{user?.name}</span>
                <span className="tf-chip-role">
                  {role === 'admin' ? 'Admin' : role === 'team_leader' ? 'Team Leader' : 'Team Member'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="tf-content-area">
          {children}
        </main>
      </div>

      {/* Floating Smart Assistant Dock */}
      <SmartAssistantDock role={role} />

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Yes, Logout"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
}

export default DashboardLayout;
