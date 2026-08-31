import { GraduationCap, Home, Search } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  const { navigate } = useApp();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <GraduationCap className="h-10 w-10" />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-bold border-2 border-white">
          404
        </div>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Button onClick={() => navigate('dashboard')}>
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Button variant="outline" onClick={() => navigate('rooms')}>
          <Search className="h-4 w-4" />
          Find a Room
        </Button>
      </div>
    </div>
  );
}
