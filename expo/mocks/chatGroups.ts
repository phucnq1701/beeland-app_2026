export interface ChatMember {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'member';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'document';
  attachments?: {
    id: string;
    name: string;
    type: string;
    uri: string;
    size?: number;
  }[];
  status: 'sent' | 'delivered' | 'read';
}

export interface ChatGroup {
  id: string;
  name: string;
  type: 'group' | 'direct';
  members: ChatMember[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: Date;
  avatar?: string;
}

export const currentUserId = 'user-1';

export const chatGroups: ChatGroup[] = [
  {
    id: 'group-1',
    name: 'Dự án Vinhomes Grand Park',
    type: 'group',
    members: [
      { id: 'user-1', name: 'Nguyễn Văn A', role: 'admin' },
      { id: 'user-2', name: 'Trần Thị B', role: 'member' },
      { id: 'user-3', name: 'Lê Văn C', role: 'member' },
      { id: 'user-4', name: 'Phạm Thị D', role: 'member' },
    ],
    lastMessage: {
      id: 'msg-1',
      senderId: 'user-2',
      senderName: 'Trần Thị B',
      content: 'Đã cập nhật bảng giá mới cho tòa S3',
      timestamp: new Date('2024-01-20T14:30:00'),
      type: 'text',
      status: 'read',
    },
    unreadCount: 2,
    createdAt: new Date('2024-01-15T10:00:00'),
  },
  {
    id: 'group-2',
    name: 'Trần Thị B',
    type: 'direct',
    members: [
      { id: 'user-1', name: 'Nguyễn Văn A', role: 'member' },
      { id: 'user-2', name: 'Trần Thị B', role: 'member' },
    ],
    lastMessage: {
      id: 'msg-2',
      senderId: 'user-2',
      senderName: 'Trần Thị B',
      content: 'Khách hàng vừa xác nhận đặt cọc',
      timestamp: new Date('2024-01-20T13:15:00'),
      type: 'text',
      status: 'delivered',
    },
    unreadCount: 0,
    createdAt: new Date('2024-01-10T09:00:00'),
  },
  {
    id: 'group-3',
    name: 'Team Marketing',
    type: 'group',
    members: [
      { id: 'user-1', name: 'Nguyễn Văn A', role: 'member' },
      { id: 'user-5', name: 'Hoàng Văn E', role: 'admin' },
      { id: 'user-6', name: 'Đỗ Thị F', role: 'member' },
    ],
    lastMessage: {
      id: 'msg-3',
      senderId: 'user-5',
      senderName: 'Hoàng Văn E',
      content: 'Đã gửi tài liệu chiến dịch Q1',
      timestamp: new Date('2024-01-20T10:45:00'),
      type: 'document',
      status: 'read',
      attachments: [
        {
          id: 'doc-1',
          name: 'Chien_dich_Q1_2024.pdf',
          type: 'application/pdf',
          uri: 'https://example.com/doc1.pdf',
          size: 2048000,
        },
      ],
    },
    unreadCount: 0,
    createdAt: new Date('2024-01-08T14:00:00'),
  },
  {
    id: 'group-4',
    name: 'Lê Văn C',
    type: 'direct',
    members: [
      { id: 'user-1', name: 'Nguyễn Văn A', role: 'member' },
      { id: 'user-3', name: 'Lê Văn C', role: 'member' },
    ],
    lastMessage: {
      id: 'msg-4',
      senderId: 'user-1',
      senderName: 'Nguyễn Văn A',
      content: 'Cảm ơn bạn!',
      timestamp: new Date('2024-01-19T16:20:00'),
      type: 'text',
      status: 'read',
    },
    unreadCount: 0,
    createdAt: new Date('2024-01-12T11:00:00'),
  },
  {
    id: 'group-5',
    name: 'Dự án Masteri Thảo Điền',
    type: 'group',
    members: [
      { id: 'user-1', name: 'Nguyễn Văn A', role: 'admin' },
      { id: 'user-7', name: 'Võ Văn G', role: 'member' },
      { id: 'user-8', name: 'Mai Thị H', role: 'member' },
    ],
    lastMessage: {
      id: 'msg-5',
      senderId: 'user-7',
      senderName: 'Võ Văn G',
      content: 'Hình ảnh tiến độ thi công',
      timestamp: new Date('2024-01-18T09:30:00'),
      type: 'image',
      status: 'read',
    },
    unreadCount: 0,
    createdAt: new Date('2024-01-05T08:00:00'),
  },
];

const generateDemoMessages = (): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  const users = [
    { id: 'user-1', name: 'Nguyễn Văn A' },
    { id: 'user-2', name: 'Trần Thị B' },
    { id: 'user-3', name: 'Lê Văn C' },
    { id: 'user-4', name: 'Phạm Thị D' },
    { id: 'user-5', name: 'Hoàng Văn E' },
  ];
  
  const contents = [
    'Chào mọi người!',
    'Đã cập nhật thông tin dự án',
    'Khách hàng vừa xác nhận',
    'Cảm ơn bạn!',
    'Tôi đang xử lý vấn đề này',
    'Đã hoàn thành báo cáo',
    'Có thể giúp tôi không?',
    'Rất tốt, tiếp tục nhé',
    'Meeting lúc 3pm nhé',
    'Đã gửi file qua email',
  ];

  const baseDate = new Date('2024-01-01T08:00:00');
  
  for (let i = 0; i < 1000; i++) {
    const user = users[i % users.length];
    const content = contents[i % contents.length];
    const timestamp = new Date(baseDate.getTime() + i * 60000);
    
    messages.push({
      id: `msg-demo-${i}`,
      senderId: user.id,
      senderName: user.name,
      content: `${content} - Tin nhắn #${i + 1}`,
      timestamp,
      type: 'text',
      status: 'read',
    });
  }
  
  return messages;
};

export const chatMessages: Record<string, ChatMessage[]> = {
  'group-1': generateDemoMessages(),
  'group-2': [
    {
      id: 'msg-2-1',
      senderId: 'user-2',
      senderName: 'Trần Thị B',
      content: 'Chào anh A, khách hàng Nguyễn Văn X đã xác nhận đặt cọc căn hộ A-1203',
      timestamp: new Date('2024-01-20T13:10:00'),
      type: 'text',
      status: 'delivered',
    },
    {
      id: 'msg-2-2',
      senderId: 'user-2',
      senderName: 'Trần Thị B',
      content: 'Khách hàng vừa xác nhận đặt cọc',
      timestamp: new Date('2024-01-20T13:15:00'),
      type: 'text',
      status: 'delivered',
    },
  ],
  'group-3': [
    {
      id: 'msg-3-1',
      senderId: 'user-5',
      senderName: 'Hoàng Văn E',
      content: 'Team ơi, đây là tài liệu chiến dịch Marketing Q1 năm 2024',
      timestamp: new Date('2024-01-20T10:40:00'),
      type: 'text',
      status: 'read',
    },
    {
      id: 'msg-3-2',
      senderId: 'user-5',
      senderName: 'Hoàng Văn E',
      content: 'Đã gửi tài liệu chiến dịch Q1',
      timestamp: new Date('2024-01-20T10:45:00'),
      type: 'document',
      attachments: [
        {
          id: 'doc-1',
          name: 'Chien_dich_Q1_2024.pdf',
          type: 'application/pdf',
          uri: 'https://example.com/doc1.pdf',
          size: 2048000,
        },
      ],
      status: 'read',
    },
    {
      id: 'msg-3-3',
      senderId: 'user-6',
      senderName: 'Đỗ Thị F',
      content: 'Đã nhận, cảm ơn anh E!',
      timestamp: new Date('2024-01-20T10:50:00'),
      type: 'text',
      status: 'read',
    },
  ],
  'group-4': [
    {
      id: 'msg-4-1',
      senderId: 'user-3',
      senderName: 'Lê Văn C',
      content: 'Anh ơi, cho em hỏi về chính sách thanh toán của dự án ABC',
      timestamp: new Date('2024-01-19T16:10:00'),
      type: 'text',
      status: 'read',
    },
    {
      id: 'msg-4-2',
      senderId: 'user-1',
      senderName: 'Nguyễn Văn A',
      content: 'Em xem tài liệu này nhé, có đầy đủ thông tin',
      timestamp: new Date('2024-01-19T16:15:00'),
      type: 'text',
      status: 'read',
    },
    {
      id: 'msg-4-3',
      senderId: 'user-3',
      senderName: 'Lê Văn C',
      content: 'Cảm ơn anh!',
      timestamp: new Date('2024-01-19T16:20:00'),
      type: 'text',
      status: 'read',
    },
  ],
  'group-5': [
    {
      id: 'msg-5-1',
      senderId: 'user-7',
      senderName: 'Võ Văn G',
      content: 'Đây là hình ảnh tiến độ thi công cập nhật tuần này',
      timestamp: new Date('2024-01-18T09:25:00'),
      type: 'text',
      status: 'read',
    },
    {
      id: 'msg-5-2',
      senderId: 'user-7',
      senderName: 'Võ Văn G',
      content: 'Hình ảnh tiến độ thi công',
      timestamp: new Date('2024-01-18T09:30:00'),
      type: 'image',
      attachments: [
        {
          id: 'img-1',
          name: 'tien_do_thang_1.jpg',
          type: 'image/jpeg',
          uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800',
        },
      ],
      status: 'read',
    },
    {
      id: 'msg-5-3',
      senderId: 'user-1',
      senderName: 'Nguyễn Văn A',
      content: 'Tiến độ rất tốt, cảm ơn anh G',
      timestamp: new Date('2024-01-18T09:35:00'),
      type: 'text',
      status: 'read',
    },
  ],
};
