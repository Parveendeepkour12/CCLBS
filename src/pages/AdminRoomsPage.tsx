import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Power, PowerOff, X, Monitor, DoorOpen, Presentation, Users, MapPin, Check } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Button, Input, Select, EmptyState, Modal, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Room } from '@/types';

const roomTypeIcons: Record<string, typeof Monitor> = {
  'computer-lab': Monitor,
  classroom: DoorOpen,
  'lecture-hall': Presentation,
  seminar: Users,
};

const allEquipment = [
  'Projector', 'Whiteboard', 'Smart Board', 'Air Conditioning', 'Video Conferencing',
  'Microphone', 'Audio System', 'Wheelchair Access', 'Printer Access', '3D Printer',
  '40 PCs', '30 PCs', '35 Macs', '28 PCs',
];

export function AdminRoomsPage() {
  const { rooms, addRoom, updateRoom, toggleRoomActive } = useApp();
  const [search, setSearch] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading] = useState(false);

  const buildings = useMemo(() => [...new Set(rooms.map((r) => r.building))], [rooms]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
      }
      if (filterBuilding !== 'all' && r.building !== filterBuilding) return false;
      return true;
    });
  }, [rooms, search, filterBuilding]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Room Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage all rooms, equipment, and availability.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="pl-10"
          />
        </div>
        <Select value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)} className="sm:w-48">
          <option value="all">All buildings</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No rooms found"
          message="Try adjusting your search or add a new room."
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Room</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Building</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Capacity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Equipment</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((room) => {
                  const Icon = roomTypeIcons[room.type] || DoorOpen;
                  return (
                    <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img src={room.image} alt={room.name} className="h-10 w-14 rounded-lg object-cover" />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{room.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{room.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{room.building}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          <Icon className="h-3.5 w-3.5" />
                          {roomTypeLabel(room.type)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{room.capacity}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {room.equipment.slice(0, 2).map((eq) => (
                            <span key={eq} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{eq}</span>
                          ))}
                          {room.equipment.length > 2 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">+{room.equipment.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                          room.active ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500',
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', room.active ? 'bg-teal-500' : 'bg-slate-400')} />
                          {room.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingRoom(room)} className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700 focus-ring" aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleRoomActive(room.id)} className={cn('rounded-lg p-2 focus-ring', room.active ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-600')} aria-label="Toggle active">
                            {room.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filtered.map((room) => {
              const Icon = roomTypeIcons[room.type] || DoorOpen;
              return (
                <div key={room.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <img src={room.image} alt={room.name} className="h-12 w-16 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{room.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{room.code}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          <Icon className="h-3 w-3" />{roomTypeLabel(room.type)}
                        </span>
                        <span className="text-xs text-slate-500">{room.capacity} seats</span>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', room.active ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500')}>
                          {room.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setEditingRoom(room)} className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 focus-ring">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleRoomActive(room.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 focus-ring">
                        {room.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add/Edit modal */}
      {(editingRoom || isAdding) && (
        <RoomFormModal
          room={editingRoom}
          buildings={buildings}
          onClose={() => { setEditingRoom(null); setIsAdding(false); }}
          onSave={(data) => {
            if (editingRoom) updateRoom(editingRoom.id, data);
            else addRoom(data as Omit<Room, 'id'>);
            setEditingRoom(null);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function RoomFormModal({
  room,
  buildings,
  onClose,
  onSave,
}: {
  room: Room | null;
  buildings: string[];
  onClose: () => void;
  onSave: (data: Partial<Room>) => void;
}) {
  const [name, setName] = useState(room?.name || '');
  const [code, setCode] = useState(room?.code || '');
  const [building, setBuilding] = useState(room?.building || buildings[0] || '');
  const [floor, setFloor] = useState(room?.floor || 1);
  const [capacity, setCapacity] = useState(room?.capacity || 30);
  const [type, setType] = useState<Room['type']>(room?.type || 'classroom');
  const [equipment, setEquipment] = useState<string[]>(room?.equipment || []);
  const [description, setDescription] = useState(room?.description || '');
  const [image, setImage] = useState(room?.image || 'https://images.pexels.com/photos/3747486/pexels-photo-3747486.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');

  function toggleEq(eq: string) {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  return (
    <Modal onClose={onClose} title={room ? 'Edit Room' : 'Add New Room'}>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Room Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computer Lab E" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Room Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CL-E101" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Building</label>
            <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="e.g. Engineering Block" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Floor</label>
            <Input type="number" value={floor} onChange={(e) => setFloor(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Capacity</label>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Room Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value as Room['type'])}>
              <option value="classroom">Classroom</option>
              <option value="computer-lab">Computer Lab</option>
              <option value="lecture-hall">Lecture Hall</option>
              <option value="seminar">Seminar Room</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Equipment</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin rounded-lg border border-slate-200 p-2.5">
            {allEquipment.map((eq) => (
              <button
                key={eq}
                onClick={() => toggleEq(eq)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus-ring',
                  equipment.includes(eq) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:border-slate-400',
                )}
              >
                {equipment.includes(eq) && <Check className="h-3 w-3 inline mr-1" />}
                {eq}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief room description…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
      </div>
      <div className="flex gap-3 px-6 pb-6">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={!name.trim() || !code.trim()}
          onClick={() => onSave({ name, code, building, floor, capacity, type, equipment, description, image, active: room?.active ?? true })}
        >
          {room ? 'Save Changes' : 'Add Room'}
        </Button>
      </div>
    </Modal>
  );
}

function roomTypeLabel(type: string): string {
  return { 'computer-lab': 'Computer Lab', classroom: 'Classroom', 'lecture-hall': 'Lecture Hall', seminar: 'Seminar' }[type] || 'Room';
}
