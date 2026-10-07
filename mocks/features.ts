import { LucideIcon, Building2, DoorOpen, Calendar, CalendarCheck, Lock, BookOpen, Users, DollarSign, FileText, BarChart3, Landmark, MessageSquareText } from 'lucide-react-native';

export interface Feature {
  id: string;
  title: string;
  icon: LucideIcon;
  backgroundColor: string;
  iconColor: string;
}

export const features: Feature[] = [
  {
    id: '1',
    title: 'Dự án',
    icon: Building2,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    iconColor: '#F97316',
  },
  {
    id: '2',
    title: 'Sản phẩm',
    icon: DoorOpen,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    iconColor: '#3B82F6',
  },
  {
    id: '3',
    title: 'Lịch hẹn',
    icon: Calendar,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    iconColor: '#10B981',
  },
  {
    id: '4',
    title: 'Lock căn',
    icon: Lock,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    iconColor: '#F59E0B',
  },
  {
    id: '5',
    title: 'Booking',
    icon: BookOpen,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    iconColor: '#3B82F6',
  },
  {
    id: '6',
    title: 'Khách hàng',
    icon: Users,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    iconColor: '#EC4899',
  },
  {
    id: '7',
    title: 'Hoa hồng',
    icon: DollarSign,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    iconColor: '#22C55E',
  },
  {
    id: '8',
    title: 'Hợp đồng',
    icon: FileText,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    iconColor: '#8B5CF6',
  },
  {
    id: '9',
    title: 'Báo cáo',
    icon: BarChart3,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    iconColor: '#EF4444',
  },

  {
    id: '13',
    title: 'Đặt cọc',
    icon: Landmark,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    iconColor: '#06B6D4',
  },
  {
    id: '14',
    title: 'Đặt lịch ký',
    icon: CalendarCheck,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    iconColor: '#6366F1',
  },
  {
    id: '15',
    title: 'Yêu cầu KH',
    icon: MessageSquareText,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    iconColor: '#14B8A6',
  },
];
