const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KRWXStableCoin", function () {
  let KRWXStableCoin;
  let krwxToken;
  let owner;
  let admin;
  let feeRecipient;
  let user1;
  let user2;
  let blacklistedUser;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000"); // 1M tokens
  const MINT_AMOUNT = ethers.utils.parseEther("10000"); // 10K tokens
  const TRANSFER_AMOUNT = ethers.utils.parseEther("1000"); // 1K tokens

  beforeEach(async function () {
    [owner, admin, feeRecipient, user1, user2, blacklistedUser] = await ethers.getSigners();

    KRWXStableCoin = await ethers.getContractFactory("KRWXStableCoin");
    krwxToken = await KRWXStableCoin.deploy(
      INITIAL_SUPPLY,
      admin.address,
      feeRecipient.address
    );
    await krwxToken.deployed();
  });

  describe("배포 및 초기 설정", function () {
    it("토큰명과 심볼이 올바르게 설정되어야 함", async function () {
      expect(await krwxToken.name()).to.equal("Korean Won Stablecoin");
      expect(await krwxToken.symbol()).to.equal("KRWX");
      expect(await krwxToken.decimals()).to.equal(18);
    });

    it("초기 공급량이 관리자에게 발행되어야 함", async function () {
      expect(await krwxToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await krwxToken.balanceOf(admin.address)).to.equal(INITIAL_SUPPLY);
    });

    it("관리자 역할이 올바르게 설정되어야 함", async function () {
      const DEFAULT_ADMIN_ROLE = await krwxToken.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await krwxToken.MINTER_ROLE();
      const PAUSER_ROLE = await krwxToken.PAUSER_ROLE();
      const BLACKLISTER_ROLE = await krwxToken.BLACKLISTER_ROLE();

      expect(await krwxToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await krwxToken.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await krwxToken.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
      expect(await krwxToken.hasRole(BLACKLISTER_ROLE, admin.address)).to.be.true;
    });

    it("수수료 수령자가 올바르게 설정되어야 함", async function () {
      expect(await krwxToken.feeRecipient()).to.equal(feeRecipient.address);
    });
  });

  describe("토큰 발행 및 소각", function () {
    it("권한이 있는 사용자가 토큰을 발행할 수 있어야 함", async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
      expect(await krwxToken.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it("권한이 없는 사용자는 토큰을 발행할 수 없어야 함", async function () {
      await expect(
        krwxToken.connect(user1).mint(user2.address, MINT_AMOUNT)
      ).to.be.revertedWith("AccessControl: account");
    });

    it("영주소로는 토큰을 발행할 수 없어야 함", async function () {
      await expect(
        krwxToken.connect(admin).mint(ethers.constants.AddressZero, MINT_AMOUNT)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("권한이 있는 사용자가 토큰을 소각할 수 있어야 함", async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
      const initialBalance = await krwxToken.balanceOf(user1.address);
      
      await krwxToken.connect(admin).burnFrom(user1.address, TRANSFER_AMOUNT);
      
      expect(await krwxToken.balanceOf(user1.address)).to.equal(
        initialBalance.sub(TRANSFER_AMOUNT)
      );
    });

    it("발행 이벤트가 발생해야 함", async function () {
      await expect(krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT))
        .to.emit(krwxToken, "Mint")
        .withArgs(user1.address, MINT_AMOUNT);
    });
  });

  describe("전송 기능", function () {
    beforeEach(async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
    });

    it("일반 전송이 정상적으로 작동해야 함", async function () {
      await krwxToken.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);
      
      expect(await krwxToken.balanceOf(user1.address)).to.equal(
        MINT_AMOUNT.sub(TRANSFER_AMOUNT)
      );
      expect(await krwxToken.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
    });

    it("잔액 부족시 전송이 실패해야 함", async function () {
      await expect(
        krwxToken.connect(user1).transfer(user2.address, MINT_AMOUNT.add(1))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("영주소로는 전송할 수 없어야 함", async function () {
      await expect(
        krwxToken.connect(user1).transfer(ethers.constants.AddressZero, TRANSFER_AMOUNT)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("배치 전송 기능", function () {
    beforeEach(async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
    });

    it("배치 전송이 정상적으로 작동해야 함", async function () {
      const recipients = [user2.address, feeRecipient.address];
      const amounts = [TRANSFER_AMOUNT, TRANSFER_AMOUNT];

      await krwxToken.connect(user1).batchTransfer(recipients, amounts);

      expect(await krwxToken.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
      expect(await krwxToken.balanceOf(feeRecipient.address)).to.equal(TRANSFER_AMOUNT);
      expect(await krwxToken.balanceOf(user1.address)).to.equal(
        MINT_AMOUNT.sub(TRANSFER_AMOUNT.mul(2))
      );
    });

    it("빈 배열로 배치 전송시 실패해야 함", async function () {
      await expect(
        krwxToken.connect(user1).batchTransfer([], [])
      ).to.be.revertedWith("Empty arrays");
    });

    it("배열 길이가 다를 경우 실패해야 함", async function () {
      await expect(
        krwxToken.connect(user1).batchTransfer([user2.address], [TRANSFER_AMOUNT, TRANSFER_AMOUNT])
      ).to.be.revertedWith("Arrays length mismatch");
    });
  });

  describe("블랙리스트 기능", function () {
    it("권한이 있는 사용자가 블랙리스트에 추가할 수 있어야 함", async function () {
      await krwxToken.connect(admin).blacklist(blacklistedUser.address);
      expect(await krwxToken.isBlacklisted(blacklistedUser.address)).to.be.true;
    });

    it("블랙리스트 이벤트가 발생해야 함", async function () {
      await expect(krwxToken.connect(admin).blacklist(blacklistedUser.address))
        .to.emit(krwxToken, "Blacklisted")
        .withArgs(blacklistedUser.address);
    });

    it("블랙리스트에서 제거할 수 있어야 함", async function () {
      await krwxToken.connect(admin).blacklist(blacklistedUser.address);
      await krwxToken.connect(admin).unBlacklist(blacklistedUser.address);
      
      expect(await krwxToken.isBlacklisted(blacklistedUser.address)).to.be.false;
    });

    it("블랙리스트된 주소는 토큰을 전송할 수 없어야 함", async function () {
      await krwxToken.connect(admin).mint(blacklistedUser.address, MINT_AMOUNT);
      await krwxToken.connect(admin).blacklist(blacklistedUser.address);

      await expect(
        krwxToken.connect(blacklistedUser).transfer(user1.address, TRANSFER_AMOUNT)
      ).to.be.revertedWith("Sender is blacklisted");
    });

    it("블랙리스트된 주소는 토큰을 받을 수 없어야 함", async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
      await krwxToken.connect(admin).blacklist(blacklistedUser.address);

      await expect(
        krwxToken.connect(user1).transfer(blacklistedUser.address, TRANSFER_AMOUNT)
      ).to.be.revertedWith("Recipient is blacklisted");
    });
  });

  describe("일시정지 기능", function () {
    beforeEach(async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
    });

    it("권한이 있는 사용자가 컨트랙트를 일시정지할 수 있어야 함", async function () {
      await krwxToken.connect(admin).pause();
      expect(await krwxToken.paused()).to.be.true;
    });

    it("일시정지 상태에서는 전송이 불가능해야 함", async function () {
      await krwxToken.connect(admin).pause();

      await expect(
        krwxToken.connect(user1).transfer(user2.address, TRANSFER_AMOUNT)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("일시정지를 해제할 수 있어야 함", async function () {
      await krwxToken.connect(admin).pause();
      await krwxToken.connect(admin).unpause();
      
      expect(await krwxToken.paused()).to.be.false;
      
      // 전송이 다시 가능해야 함
      await krwxToken.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);
      expect(await krwxToken.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
    });
  });

  describe("수수료 기능", function () {
    beforeEach(async function () {
      await krwxToken.connect(admin).mint(user1.address, MINT_AMOUNT);
    });

    it("수수료율을 설정할 수 있어야 함", async function () {
      const newFeeRate = 50; // 0.5%
      await krwxToken.connect(admin).setTransferFeeRate(newFeeRate);
      
      expect(await krwxToken.transferFeeRate()).to.equal(newFeeRate);
    });

    it("수수료율 변경 이벤트가 발생해야 함", async function () {
      const newFeeRate = 50;
      await expect(krwxToken.connect(admin).setTransferFeeRate(newFeeRate))
        .to.emit(krwxToken, "FeeRateUpdated")
        .withArgs(0, newFeeRate);
    });

    it("최대 수수료율을 초과할 수 없어야 함", async function () {
      const MAX_FEE_RATE = await krwxToken.MAX_FEE_RATE();
      
      await expect(
        krwxToken.connect(admin).setTransferFeeRate(MAX_FEE_RATE.add(1))
      ).to.be.revertedWith("Fee rate too high");
    });

    it("수수료가 적용된 전송이 작동해야 함", async function () {
      const feeRate = 50; // 0.5%
      await krwxToken.connect(admin).setTransferFeeRate(feeRate);

      const initialFeeRecipientBalance = await krwxToken.balanceOf(feeRecipient.address);
      
      await krwxToken.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);

      const expectedFee = TRANSFER_AMOUNT.mul(feeRate).div(10000);
      const expectedTransferAmount = TRANSFER_AMOUNT.sub(expectedFee);

      expect(await krwxToken.balanceOf(user2.address)).to.equal(expectedTransferAmount);
      expect(await krwxToken.balanceOf(feeRecipient.address)).to.equal(
        initialFeeRecipientBalance.add(expectedFee)
      );
    });

    it("수수료 수령자를 변경할 수 있어야 함", async function () {
      await krwxToken.connect(admin).setFeeRecipient(user2.address);
      expect(await krwxToken.feeRecipient()).to.equal(user2.address);
    });

    it("수수료 수령자 변경 이벤트가 발생해야 함", async function () {
      await expect(krwxToken.connect(admin).setFeeRecipient(user2.address))
        .to.emit(krwxToken, "FeeRecipientUpdated")
        .withArgs(feeRecipient.address, user2.address);
    });
  });

  describe("비상 회수 기능", function () {
    it("관리자가 비상 회수를 실행할 수 있어야 함", async function () {
      // 다른 ERC20 토큰을 컨트랙트에 전송 (시뮬레이션)
      // 실제로는 다른 토큰 컨트랙트가 필요하지만, 테스트를 위해 ETH 회수만 테스트
      
      // ETH를 컨트랙트에 전송
      await owner.sendTransaction({
        to: krwxToken.address,
        value: ethers.utils.parseEther("1")
      });

      const initialBalance = await admin.getBalance();
      const contractBalance = await ethers.provider.getBalance(krwxToken.address);

      await krwxToken.connect(admin).emergencyRecover(ethers.constants.AddressZero, contractBalance);

      expect(await ethers.provider.getBalance(krwxToken.address)).to.equal(0);
    });

    it("권한이 없는 사용자는 비상 회수를 실행할 수 없어야 함", async function () {
      await expect(
        krwxToken.connect(user1).emergencyRecover(ethers.constants.AddressZero, 0)
      ).to.be.revertedWith("AccessControl: account");
    });
  });

  describe("접근 제어", function () {
    it("DEFAULT_ADMIN_ROLE만 역할을 부여할 수 있어야 함", async function () {
      const MINTER_ROLE = await krwxToken.MINTER_ROLE();
      
      await krwxToken.connect(admin).grantRole(MINTER_ROLE, user1.address);
      expect(await krwxToken.hasRole(MINTER_ROLE, user1.address)).to.be.true;
    });

    it("권한이 없는 사용자는 역할을 부여할 수 없어야 함", async function () {
      const MINTER_ROLE = await krwxToken.MINTER_ROLE();
      
      await expect(
        krwxToken.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWith("AccessControl: account");
    });
  });
}); 