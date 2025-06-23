import React from 'react';

interface Notification {
  id: string;
  message: string;
  date: string;
}

const mockNotifications: Notification[] = [
  { id: '1', message: '송금이 완료되었습니다.', date: '2024-06-01 10:00' },
  { id: '2', message: '지갑에 100,000 KRWX가 입금되었습니다.', date: '2024-05-31 18:30' },
];

const NotificationList: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-bold mb-4">알림</h2>
    <ul className="divide-y">
      {mockNotifications.map((n) => (
        <li key={n.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between">
          <span>{n.message}</span>
          <span className="text-xs text-gray-400">{n.date}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default NotificationList; 