import DashboardCard from '@/components/DashboardCard';

export default function DashboardPage() {
  return (
    <main className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <DashboardCard title="잔고(KRWX)" value={"1,000,000"} />
      <DashboardCard title="최근 결제" value={"3건"} />
      <DashboardCard title="알림" value={"2개"} />
    </main>
  );
} 