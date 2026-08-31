import { useState, type ReactNode } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Search,
  CalendarDays,
  CalendarRange,
  Settings,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PageKey } from '@/types';

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'rooms', label: 'Find Rooms', icon: Search },
  { key: 'calendar', label: 'Availability', icon: CalendarDays },
  { key: 'my-bookings', label: 'My Bookings', icon: CalendarRange },
  { key: 'admin-rooms', label: 'Room Management', icon: Settings, adminOnly: true },
  { key: 'admin-users', label: 'User Management', icon: Users, adminOnly: true },
  { key: 'admin-reports', label: 'Reports', icon: BarChart3, adminOnly: true },
];

const mobileTabs: NavItem[] = [
  { key: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { key: 'rooms', label: 'Rooms', icon: Search },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'my-bookings', label: 'Bookings', icon: CalendarRange },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { currentUser, logout, page, navigate } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!currentUser) return <>{children}</>;

  const visibleNav = navItems.filter((n) => !n.adminOnly || currentUser.role === 'admin');

  function handleNav(p: PageKey) {
    navigate(p);
    setMobileNavOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800 tracking-tight">CCLBS</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Booking System</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>
          {visibleNav.slice(0, 4).map((item) => (
            <NavButton key={item.key} item={item} active={page === item.key} onClick={() => handleNav(item.key)} />
          ))}

          {currentUser.role === 'admin' && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Administration</p>
              {visibleNav.slice(4).map((item) => (
                <NavButton key={item.key} item={item} active={page === item.key} onClick={() => handleNav(item.key)} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex w-full items-center gap-3 rounded-lg p-2.5 hover:bg-slate-100 transition-colors focus-ring"
            >
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size="md" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 truncate capitalize">{currentUser.role}</p>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', profileOpen && 'rotate-180')} />
            </button>
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-slate-200 bg-white shadow-pop py-1 animate-scale-in">
                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-ring"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-pop animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <p className="text-base font-bold text-slate-800">CCLBS</p>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-ring">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => (
                <NavButton key={item.key} item={item} active={page === item.key} onClick={() => handleNav(item.key)} />
              ))}
              <button
                onClick={() => { setMobileNavOpen(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 mt-4 focus-ring"
              >
                <LogOut className="h-4.5 w-4.5" />
                Sign out
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 h-16 px-4 sm:px-6 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-ring"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-800">
                {navItems.find((n) => n.key === page)?.label || 'Page'}
              </h1>
              <p className="hidden sm:block text-xs text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-ring">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
            </button>
            <div className="lg:hidden">
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-1.5 safe-area">
        {mobileTabs.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors focus-ring',
                active ? 'text-brand-700' : 'text-slate-400',
              )}
            >
              <item.icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        {currentUser.role === 'admin' && (
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-400 focus-ring"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all focus-ring',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
      )}
    >
      <item.icon className={cn('h-4.5 w-4.5 shrink-0', active && 'stroke-[2.5]')} />
      {item.label}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />}
    </button>
  );
}
