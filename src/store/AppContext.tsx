import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, Booking, PageKey, Room } from '@/types';
import { users, rooms, initialBookings, CURRENT_USER_ID, makeBookingCode } from '@/data/mockData';

interface AppState {
  currentUser: User | null;
  login: (universityId: string) => void;
  logout: () => void;

  page: PageKey;
  navigate: (page: PageKey) => void;

  rooms: Room[];
  users: User[];
  bookings: Booking[];
  addBooking: (b: Omit<Booking, 'id' | 'code' | 'createdAt' | 'userId' | 'userName'>) => Booking;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  cancelBooking: (id: string) => void;
  approveBooking: (id: string) => void;
  rejectBooking: (id: string) => void;
  addRoom: (r: Omit<Room, 'id'>) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  toggleRoomActive: (id: string) => void;
  updateUserRole: (id: string, role: User['role']) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [page, setPage] = useState<PageKey>('dashboard');
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [roomList, setRoomList] = useState<Room[]>(rooms);

  const login = useCallback((universityId: string) => {
    const user = users.find((u) => u.universityId === universityId) || users[0];
    setCurrentUser(user);
    setPage('dashboard');
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setPage('dashboard');
  }, []);

  const navigate = useCallback((p: PageKey) => setPage(p), []);

  const addBooking: AppState['addBooking'] = useCallback(
    (b) => {
      const user = currentUser || users.find((u) => u.id === CURRENT_USER_ID)!;
      const newBooking: Booking = {
        ...b,
        id: 'b' + Date.now(),
        code: makeBookingCode(),
        userId: user.id,
        userName: user.name,
        createdAt: new Date().toISOString(),
      };
      setBookings((prev) => [newBooking, ...prev]);
      return newBooking;
    },
    [currentUser],
  );

  const updateBooking: AppState['updateBooking'] = useCallback((id, patch) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const cancelBooking = useCallback((id: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
  }, []);

  const approveBooking = useCallback((id: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'confirmed' } : b)));
  }, []);

  const rejectBooking = useCallback((id: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'rejected' } : b)));
  }, []);

  const addRoom: AppState['addRoom'] = useCallback((r) => {
    const newRoom: Room = { ...r, id: 'r' + Date.now() };
    setRoomList((prev) => [newRoom, ...prev]);
  }, []);

  const updateRoom: AppState['updateRoom'] = useCallback((id, patch) => {
    setRoomList((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const toggleRoomActive = useCallback((id: string) => {
    setRoomList((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }, []);

  const updateUserRole = useCallback((id: string, role: User['role']) => {
    const idx = users.findIndex((u) => u.id === id);
    if (idx >= 0) users[idx] = { ...users[idx], role };
  }, []);

  const value: AppState = {
    currentUser: currentUser,
    login,
    logout,
    page,
    navigate,
    rooms: roomList,
    users,
    bookings,
    addBooking,
    updateBooking,
    cancelBooking,
    approveBooking,
    rejectBooking,
    addRoom,
    updateRoom,
    toggleRoomActive,
    updateUserRole,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useApp must be used within AppStateProvider');
  return ctx;
}
