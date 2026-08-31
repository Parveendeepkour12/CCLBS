export type Role = 'student' | 'faculty' | 'admin';

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'rejected';

export interface User {
  id: string;
  universityId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  avatarColor: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: number;
  capacity: number;
  type: 'classroom' | 'computer-lab' | 'lecture-hall' | 'seminar';
  equipment: string[];
  image: string;
  active: boolean;
  description: string;
}

export interface Booking {
  id: string;
  code: string;
  roomId: string;
  userId: string;
  userName: string;
  date: string; // ISO date YYYY-MM-DD
  startHour: number; // 0-23
  endHour: number; // 0-23
  purpose: string;
  status: BookingStatus;
  createdAt: string;
}

export type ViewMode = 'grid' | 'list';
export type CalendarView = 'week' | 'day';
export type PageKey =
  | 'dashboard'
  | 'rooms'
  | 'calendar'
  | 'my-bookings'
  | 'admin-rooms'
  | 'admin-users'
  | 'admin-reports'
  | '404';
