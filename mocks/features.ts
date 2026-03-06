import { LucideIcon, Building2, Home, Calendar, Lock, BookOpen, Users, DollarSign, FileText, BarChart3, Image, CheckCircle, Receipt } from 'lucide-react-native';

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
    icon: Home,
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
    id: '10',
    title: 'Thư viện ảnh',
    icon: Image,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    iconColor: '#10B981',
  },
  {
    id: '11',
    title: 'Bàn giao',
    icon: CheckCircle,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    iconColor: '#0EA5E9',
  },
  {
    id: '12',
    title: 'Phiếu thu',
    icon: Receipt,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    iconColor: '#EF4444',
  },
];
