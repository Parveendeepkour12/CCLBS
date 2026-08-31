import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, ArrowRight, ShieldCheck, CalendarCheck, LayoutGrid } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui';

export function LoginPage() {
  const { login } = useApp();
  const [universityId, setUniversityId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!universityId.trim() || !password.trim()) {
      setError('Please enter both your University ID and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(universityId.trim());
    }, 700);
  }

  function handleSSO() {
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('20210001');
    }, 700);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden bg-brand-800">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 70%, #0D9488 0%, transparent 50%)',
        }} />
        <div className="relative">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">CCLBS</p>
              <p className="text-xs text-brand-200">Booking System</p>
            </div>
          </div>
        </div>

        <div className="relative text-white max-w-md">
          <h1 className="text-3xl font-bold leading-tight mb-4">
            Book classrooms and labs in seconds.
          </h1>
          <p className="text-brand-200 text-base leading-relaxed mb-8">
            Real-time availability, conflict-free scheduling, and instant confirmations — all in one place for students, faculty, and administrators.
          </p>
          <div className="space-y-3">
            {[
              { icon: CalendarCheck, text: 'Live availability calendar with drag-to-book' },
              { icon: LayoutGrid, text: 'Filter rooms by building, capacity, and equipment' },
              { icon: ShieldCheck, text: 'Role-based access for students, faculty & admins' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-brand-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur shrink-0">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-brand-300 text-xs">
          © 2026 University Booking Services. All rights reserved.
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">CCLBS</p>
              <p className="text-xs text-slate-500">Booking System</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1.5">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-8">Sign in to manage your room bookings.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">University ID</label>
              <input
                type="text"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                placeholder="e.g. 20210001"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-ring rounded"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-600 animate-fade-in">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Remember me
              </label>
              <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-800 focus-ring rounded">
                Forgot password?
              </button>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            onClick={handleSSO}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus-ring disabled:opacity-50"
          >
            <ShieldCheck className="h-4.5 w-4.5 text-brand-700" />
            Sign in with University SSO
          </button>

          <p className="mt-8 text-center text-xs text-slate-400">
            Demo: enter any ID (e.g. <span className="font-medium text-slate-500">20210001</span> for admin,{' '}
            <span className="font-medium text-slate-500">20210045</span> for faculty,{' '}
            <span className="font-medium text-slate-500">20210120</span> for student)
          </p>
        </div>
      </div>
    </div>
  );
}
