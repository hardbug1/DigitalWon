import React from 'react';

interface Wallet {
  id: string;
  address: string;
  balance: number;
}

const mockWallets: Wallet[] = [
  { id: '1', address: '0x1234...abcd', balance: 500000 },
  { id: '2', address: '0xabcd...5678', balance: 250000 },
];

const WalletList: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-bold mb-4">내 지갑 목록</h2>
    <ul className="divide-y">
      {mockWallets.map((wallet) => (
        <li key={wallet.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between">
          <span className="font-mono text-sm">{wallet.address}</span>
          <span className="text-blue-700 font-bold">{wallet.balance.toLocaleString()} KRWX</span>
        </li>
      ))}
    </ul>
  </div>
);

export default WalletList; 