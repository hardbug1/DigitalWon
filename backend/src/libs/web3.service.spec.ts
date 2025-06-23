import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Web3Service } from './web3.service';

describe('Web3Service', () => {
  let service: Web3Service;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Web3Service,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<Web3Service>(Web3Service);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('initializeProvider', () => {
    it('RPC URL로 provider를 초기화해야 함', () => {
      const rpcUrl = 'https://mainnet.infura.io/v3/test-key';
      mockConfigService.get.mockReturnValue(rpcUrl);

      service.initializeProvider();

      expect(mockConfigService.get).toHaveBeenCalledWith('BLOCKCHAIN_RPC_URL');
      expect(service.getProvider()).toBeDefined();
    });
  });

  describe('getBalance', () => {
    it('지갑 주소의 잔액을 조회해야 함', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const expectedBalance = '1000000000000000000'; // 1 ETH in wei

      // Mock provider
      const mockProvider = {
        getBalance: jest.fn().mockResolvedValue(expectedBalance),
      };
      service['provider'] = mockProvider as any;

      const balance = await service.getBalance(address);

      expect(mockProvider.getBalance).toHaveBeenCalledWith(address);
      expect(balance).toBe(expectedBalance);
    });

    it('유효하지 않은 주소로 조회 시 에러가 발생해야 함', async () => {
      const invalidAddress = 'invalid-address';
      
      const mockProvider = {
        getBalance: jest.fn().mockRejectedValue(new Error('Invalid address')),
      };
      service['provider'] = mockProvider as any;

      await expect(service.getBalance(invalidAddress)).rejects.toThrow('Invalid address');
    });
  });

  describe('sendTransaction', () => {
    it('트랜잭션을 전송해야 함', async () => {
      const transactionData = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: '1000000000000000000', // 1 ETH
        gasLimit: '21000',
        gasPrice: '20000000000', // 20 Gwei
      };
      const expectedTxHash = '0x123456789abcdef...';

      const mockWallet = {
        sendTransaction: jest.fn().mockResolvedValue({
          hash: expectedTxHash,
          wait: jest.fn().mockResolvedValue({
            transactionHash: expectedTxHash,
            status: 1,
          }),
        }),
      };
      service['wallet'] = mockWallet as any;

      const result = await service.sendTransaction(transactionData);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(transactionData);
      expect(result.hash).toBe(expectedTxHash);
    });

    it('트랜잭션 전송 실패 시 에러가 발생해야 함', async () => {
      const transactionData = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: '1000000000000000000',
        gasLimit: '21000',
        gasPrice: '20000000000',
      };

      const mockWallet = {
        sendTransaction: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      };
      service['wallet'] = mockWallet as any;

      await expect(service.sendTransaction(transactionData)).rejects.toThrow('Transaction failed');
    });
  });

  describe('getTransactionReceipt', () => {
    it('트랜잭션 영수증을 조회해야 함', async () => {
      const txHash = '0x123456789abcdef...';
      const expectedReceipt = {
        transactionHash: txHash,
        status: 1,
        blockNumber: 123456,
        gasUsed: '21000',
      };

      const mockProvider = {
        getTransactionReceipt: jest.fn().mockResolvedValue(expectedReceipt),
      };
      service['provider'] = mockProvider as any;

      const receipt = await service.getTransactionReceipt(txHash);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(receipt).toEqual(expectedReceipt);
    });

    it('존재하지 않는 트랜잭션 해시로 조회 시 null을 반환해야 함', async () => {
      const txHash = '0xinvalid-hash';

      const mockProvider = {
        getTransactionReceipt: jest.fn().mockResolvedValue(null),
      };
      service['provider'] = mockProvider as any;

      const receipt = await service.getTransactionReceipt(txHash);

      expect(receipt).toBeNull();
    });
  });

  describe('estimateGas', () => {
    it('가스 사용량을 추정해야 함', async () => {
      const transactionData = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: '1000000000000000000',
      };
      const expectedGasEstimate = '21000';

      const mockProvider = {
        estimateGas: jest.fn().mockResolvedValue(expectedGasEstimate),
      };
      service['provider'] = mockProvider as any;

      const gasEstimate = await service.estimateGas(transactionData);

      expect(mockProvider.estimateGas).toHaveBeenCalledWith(transactionData);
      expect(gasEstimate).toBe(expectedGasEstimate);
    });
  });
}); 