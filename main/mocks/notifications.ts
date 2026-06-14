export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  type: 'project' | 'product' | 'system' | 'message';
}

export const notifications: Notification[] = [
  {
    id: '1',
    title: 'Dự án mới được thêm',
    description: 'Dự án "Vinhomes Central Park" đã được thêm vào hệ thống',
    time: '5 phút trước',
    isRead: false,
    type: 'project',
  },
  {
    id: '2',
    title: 'Cập nhật giá sản phẩm',
    description: 'Sản phẩm "Căn hộ 2PN" đã được cập nhật giá mới',
    time: '1 giờ trước',
    isRead: false,
    type: 'product',
  },
  {
    id: '3',
    title: 'Tin nhắn mới',
    description: 'Bạn có tin nhắn mới từ khách hàng Nguyễn Văn A',
    time: '2 giờ trước',
    isRead: false,
    type: 'message',
  },
  {
    id: '4',
    title: 'Báo cáo tháng 12',
    description: 'Báo cáo doanh số tháng 12 đã sẵn sàng để xem',
    time: '1 ngày trước',
    isRead: true,
    type: 'system',
  },
  {
    id: '5',
    title: 'Cập nhật hệ thống',
    description: 'Hệ thống đã được cập nhật phiên bản mới 2.5.0',
    time: '2 ngày trước',
    isRead: true,
    type: 'system',
  },
  {
    id: '6',
    title: 'Dự án được duyệt',
    description: 'Dự án "Masteri Thảo Điền" đã được duyệt và công bố',
    time: '3 ngày trước',
    isRead: true,
    type: 'project',
  },
  {
    id: '7',
    title: 'Sản phẩm mới',
    description: '5 sản phẩm mới đã được thêm vào dự án "The Sun Avenue"',
    time: '4 ngày trước',
    isRead: true,
    type: 'product',
  },
  {
    id: '8',
    title: 'Phản hồi từ khách hàng',
    description: 'Khách hàng đã đánh giá 5 sao cho sản phẩm của bạn',
    time: '5 ngày trước',
    isRead: true,
    type: 'message',
  },
];
