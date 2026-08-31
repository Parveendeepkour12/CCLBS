import { AppStateProvider, useApp } from '@/store/AppContext';
import { AppShell } from '@/components/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RoomsPage } from '@/pages/RoomsPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { MyBookingsPage } from '@/pages/MyBookingsPage';
import { AdminRoomsPage } from '@/pages/AdminRoomsPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminReportsPage } from '@/pages/AdminReportsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function Router() {
  const { currentUser, page } = useApp();

  if (!currentUser) return <LoginPage />;

  let content;
  switch (page) {
    case 'dashboard':
      content = <DashboardPage />;
      break;
    case 'rooms':
      content = <RoomsPage />;
      break;
    case 'calendar':
      content = <CalendarPage />;
      break;
    case 'my-bookings':
      content = <MyBookingsPage />;
      break;
    case 'admin-rooms':
      content = currentUser.role === 'admin' ? <AdminRoomsPage /> : <NotFoundPage />;
      break;
    case 'admin-users':
      content = currentUser.role === 'admin' ? <AdminUsersPage /> : <NotFoundPage />;
      break;
    case 'admin-reports':
      content = currentUser.role === 'admin' ? <AdminReportsPage /> : <NotFoundPage />;
      break;
    default:
      content = <NotFoundPage />;
  }

  return <AppShell>{content}</AppShell>;
}

function App() {
  return (
    <AppStateProvider>
      <Router />
    </AppStateProvider>
  );
}

export default App;
