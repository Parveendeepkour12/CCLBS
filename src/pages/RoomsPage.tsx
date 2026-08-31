import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, MapPin, Users, Monitor, DoorOpen, Presentation, X } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Button, Select, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Room, ViewMode } from '@/types';

const roomTypeIcons: Record<string, typeof Monitor> = {
  'computer-lab': Monitor,
  classroom: DoorOpen,
  'lecture-hall': Presentation,
  seminar: Users,
};

const allEquipment = [
  'Projector',
  'Whiteboard',
  'Smart Board',
  'Air Conditioning',
  'Video Conferencing',
  'Microphone',
  'Audio System',
  'Wheelchair Access',
  'Printer Access',
  '3D Printer',
];

export function RoomsPage() {
  const { rooms, navigate } = useApp();
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('all');
  const [type, setType] = useState('all');
  const [minCapacity, setMinCapacity] = useState(0);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading] = useState(false);

  const buildings = useMemo(() => [...new Set(rooms.map((r) => r.building))], [rooms]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (!r.active) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (building !== 'all' && r.building !== building) return false;
      if (type !== 'all' && r.type !== type) return false;
      if (r.capacity < minCapacity) return false;
      if (selectedEquipment.length > 0 && !selectedEquipment.every((e) => r.equipment.includes(e))) return false;
      return true;
    });
  }, [rooms, search, building, type, minCapacity, selectedEquipment]);

  function toggleEquipment(eq: string) {
    setSelectedEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  function clearFilters() {
    setSearch('');
    setBuilding('all');
    setType('all');
    setMinCapacity(0);
    setSelectedEquipment([]);
  }

  const activeFilterCount =
    (building !== 'all' ? 1 : 0) +
    (type !== 'all' ? 1 : 0) +
    (minCapacity > 0 ? 1 : 0) +
    selectedEquipment.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Search + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms by name or code…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="relative">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={cn('p-2.5 transition-colors focus-ring', view === 'grid' ? 'bg-brand-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('p-2.5 transition-colors focus-ring', view === 'list' ? 'bg-brand-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Filter Rooms</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs font-medium text-brand-700 hover:text-brand-800 focus-ring rounded flex items-center gap-1">
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Building</label>
              <Select value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option value="all">All buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Room Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">All types</option>
                <option value="computer-lab">Computer Lab</option>
                <option value="classroom">Classroom</option>
                <option value="lecture-hall">Lecture Hall</option>
                <option value="seminar">Seminar Room</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Min. Capacity: {minCapacity}</label>
              <input
                type="range"
                min={0}
                max={200}
                step={10}
                value={minCapacity}
                onChange={(e) => setMinCapacity(Number(e.target.value))}
                className="w-full accent-brand-700 mt-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Equipment</label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                {allEquipment.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => toggleEquipment(eq)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus-ring',
                      selectedEquipment.includes(eq)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400',
                    )}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <p className="text-sm text-slate-500">
        {loading ? 'Searching…' : `${filtered.length} room${filtered.length !== 1 ? 's' : ''} found`}
      </p>

      {/* Results */}
      {loading ? (
        <div className={view === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-64' : 'h-24'} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No rooms match your filters"
          message="Try adjusting your search criteria or clearing some filters to see more rooms."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((room) => (
            <RoomCard key={room.id} room={room} onBook={() => navigate('calendar')} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((room) => (
            <RoomRow key={room.id} room={room} onBook={() => navigate('calendar')} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onBook }: { room: Room; onBook: () => void }) {
  const Icon = roomTypeIcons[room.type] || DoorOpen;
  return (
    <Card hover className="overflow-hidden group flex flex-col">
      <div className="relative h-44 overflow-hidden">
        <img
          src={room.image}
          alt={room.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-xs font-medium text-slate-700">
          <Icon className="h-3.5 w-3.5 text-brand-700" />
          {roomTypeLabel(room.type)}
        </div>
        <div className="absolute top-3 right-3 rounded-full bg-brand-700/90 backdrop-blur px-2.5 py-1 text-xs font-semibold text-white">
          {room.code}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-slate-800">{room.name}</h3>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {room.building} · Floor {room.floor}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {room.capacity}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2 line-clamp-2 flex-1">{room.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {room.equipment.slice(0, 3).map((eq) => (
            <span key={eq} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {eq}
            </span>
          ))}
          {room.equipment.length > 3 && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              +{room.equipment.length - 3}
            </span>
          )}
        </div>
        <Button size="sm" className="mt-4 w-full" onClick={onBook}>
          Check Availability
        </Button>
      </div>
    </Card>
  );
}

function RoomRow({ room, onBook }: { room: Room; onBook: () => void }) {
  const Icon = roomTypeIcons[room.type] || DoorOpen;
  return (
    <Card hover className="p-3 flex items-center gap-4">
      <img src={room.image} alt={room.name} className="h-16 w-24 rounded-lg object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{room.name}</h3>
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">{room.code}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" />
            {roomTypeLabel(room.type)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {room.building}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {room.capacity} seats
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {room.equipment.slice(0, 4).map((eq) => (
            <span key={eq} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {eq}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={onBook} className="shrink-0">
        Book
      </Button>
    </Card>
  );
}

function roomTypeLabel(type: string): string {
  return { 'computer-lab': 'Computer Lab', classroom: 'Classroom', 'lecture-hall': 'Lecture Hall', seminar: 'Seminar' }[type] || 'Room';
}
