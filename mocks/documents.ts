export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'xls' | 'jpg' | 'png';
  size: string;
  date: string;
  url?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  documentCount: number;
  documents: Document[];
  color: string;
}

export const projectFolders: Folder[] = [
  {
    id: '1',
    name: 'Chính sách bán hàng',
    icon: '📋',
    documentCount: 5,
    color: '#3B82F6',
    documents: [
      {
        id: 'd1',
        name: 'Chính sách thanh toán 2024',
        type: 'pdf',
        size: '2.4 MB',
        date: '15/03/2024',
      },
      {
        id: 'd2',
        name: 'Chính sách ưu đãi khách hàng',
        type: 'pdf',
        size: '1.8 MB',
        date: '10/03/2024',
      },
      {
        id: 'd3',
        name: 'Quy định bảo lưu căn hộ',
        type: 'doc',
        size: '850 KB',
        date: '08/03/2024',
      },
      {
        id: 'd4',
        name: 'Chính sách chiết khấu',
        type: 'xls',
        size: '1.2 MB',
        date: '05/03/2024',
      },
      {
        id: 'd5',
        name: 'Hướng dẫn quy trình mua',
        type: 'pdf',
        size: '3.1 MB',
        date: '01/03/2024',
      },
    ],
  },
  {
    id: '2',
    name: 'Hợp đồng mẫu',
    icon: '📝',
    documentCount: 4,
    color: '#10B981',
    documents: [
      {
        id: 'd6',
        name: 'Hợp đồng mua bán căn hộ',
        type: 'pdf',
        size: '4.2 MB',
        date: '20/03/2024',
      },
      {
        id: 'd7',
        name: 'Phụ lục hợp đồng',
        type: 'pdf',
        size: '1.5 MB',
        date: '20/03/2024',
      },
      {
        id: 'd8',
        name: 'Biên bản bàn giao',
        type: 'doc',
        size: '920 KB',
        date: '18/03/2024',
      },
      {
        id: 'd9',
        name: 'Cam kết bảo hành',
        type: 'pdf',
        size: '780 KB',
        date: '15/03/2024',
      },
    ],
  },
  {
    id: '3',
    name: 'Thiết kế căn hộ',
    icon: '🏗️',
    documentCount: 8,
    color: '#F59E0B',
    documents: [
      {
        id: 'd10',
        name: 'Mặt bằng tầng 1-5',
        type: 'pdf',
        size: '5.6 MB',
        date: '25/03/2024',
      },
      {
        id: 'd11',
        name: 'Mặt bằng tầng 6-10',
        type: 'pdf',
        size: '5.8 MB',
        date: '25/03/2024',
      },
      {
        id: 'd12',
        name: 'Thiết kế nội thất mẫu',
        type: 'jpg',
        size: '3.2 MB',
        date: '22/03/2024',
      },
      {
        id: 'd13',
        name: 'Sơ đồ điện nước',
        type: 'pdf',
        size: '2.9 MB',
        date: '20/03/2024',
      },
      {
        id: 'd14',
        name: 'Phối cảnh 3D căn hộ',
        type: 'png',
        size: '6.4 MB',
        date: '18/03/2024',
      },
      {
        id: 'd15',
        name: 'Bản vẽ kỹ thuật',
        type: 'pdf',
        size: '4.7 MB',
        date: '15/03/2024',
      },
      {
        id: 'd16',
        name: 'Catalog nội thất',
        type: 'pdf',
        size: '8.2 MB',
        date: '12/03/2024',
      },
      {
        id: 'd17',
        name: 'Danh sách vật liệu',
        type: 'xls',
        size: '1.1 MB',
        date: '10/03/2024',
      },
    ],
  },
  {
    id: '4',
    name: 'Tiện ích dự án',
    icon: '🏊',
    documentCount: 3,
    color: '#8B5CF6',
    documents: [
      {
        id: 'd18',
        name: 'Sơ đồ tiện ích tổng thể',
        type: 'pdf',
        size: '3.8 MB',
        date: '22/03/2024',
      },
      {
        id: 'd19',
        name: 'Hình ảnh tiện ích',
        type: 'jpg',
        size: '7.5 MB',
        date: '20/03/2024',
      },
      {
        id: 'd20',
        name: 'Quy định sử dụng tiện ích',
        type: 'pdf',
        size: '1.2 MB',
        date: '18/03/2024',
      },
    ],
  },
  {
    id: '5',
    name: 'Pháp lý dự án',
    icon: '⚖️',
    documentCount: 6,
    color: '#EF4444',
    documents: [
      {
        id: 'd21',
        name: 'Giấy phép xây dựng',
        type: 'pdf',
        size: '2.1 MB',
        date: '01/03/2024',
      },
      {
        id: 'd22',
        name: 'Giấy chứng nhận đầu tư',
        type: 'pdf',
        size: '1.9 MB',
        date: '01/03/2024',
      },
      {
        id: 'd23',
        name: 'Quyết định phê duyệt',
        type: 'pdf',
        size: '1.5 MB',
        date: '28/02/2024',
      },
      {
        id: 'd24',
        name: 'Chứng nhận quyền sử dụng đất',
        type: 'pdf',
        size: '2.8 MB',
        date: '25/02/2024',
      },
      {
        id: 'd25',
        name: 'Báo cáo thẩm định',
        type: 'pdf',
        size: '4.2 MB',
        date: '20/02/2024',
      },
      {
        id: 'd26',
        name: 'Giấy phép kinh doanh',
        type: 'pdf',
        size: '1.1 MB',
        date: '15/02/2024',
      },
    ],
  },
  {
    id: '6',
    name: 'Tiến độ thi công',
    icon: '📊',
    documentCount: 4,
    color: '#06B6D4',
    documents: [
      {
        id: 'd27',
        name: 'Báo cáo tiến độ Q1 2024',
        type: 'pdf',
        size: '3.5 MB',
        date: '28/03/2024',
      },
      {
        id: 'd28',
        name: 'Hình ảnh hiện trạng tháng 3',
        type: 'jpg',
        size: '8.9 MB',
        date: '25/03/2024',
      },
      {
        id: 'd29',
        name: 'Kế hoạch thi công Q2',
        type: 'xls',
        size: '1.8 MB',
        date: '20/03/2024',
      },
      {
        id: 'd30',
        name: 'Biên bản nghiệm thu',
        type: 'pdf',
        size: '2.4 MB',
        date: '15/03/2024',
      },
    ],
  },
];
