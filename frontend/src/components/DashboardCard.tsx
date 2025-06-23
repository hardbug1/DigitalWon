import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value }) => (
  <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
    <span className="text-gray-500 text-sm mb-2">{title}</span>
    <span className="text-2xl font-bold">{value}</span>
  </div>
);

export default DashboardCard; 