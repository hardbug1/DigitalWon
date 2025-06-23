const { ethers } = require("hardhat");

async function main() {
  console.log("KRWX 스테이블 코인 배포를 시작합니다...");

  // 계정 정보 가져오기
  const [deployer] = await ethers.getSigners();
  console.log("배포 계정:", deployer.address);
  console.log("계정 잔액:", (await deployer.getBalance()).toString());

  // 컨트랙트 팩토리 가져오기
  const KRWXStableCoin = await ethers.getContractFactory("KRWXStableCoin");

  // 배포 매개변수
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000"); // 초기 공급량: 1M KRWX
  const ADMIN_ADDRESS = deployer.address; // 관리자 주소 (배포자)
  const FEE_RECIPIENT = deployer.address; // 수수료 수령자 (배포자)

  console.log("배포 매개변수:");
  console.log("- 초기 공급량:", ethers.utils.formatEther(INITIAL_SUPPLY), "KRWX");
  console.log("- 관리자 주소:", ADMIN_ADDRESS);
  console.log("- 수수료 수령자:", FEE_RECIPIENT);

  // 컨트랙트 배포
  const krwxToken = await KRWXStableCoin.deploy(
    INITIAL_SUPPLY,
    ADMIN_ADDRESS,
    FEE_RECIPIENT
  );

  await krwxToken.deployed();

  console.log("KRWX 스테이블 코인이 다음 주소에 배포되었습니다:", krwxToken.address);

  // 배포 정보 확인
  console.log("\n=== 배포 정보 확인 ===");
  console.log("토큰명:", await krwxToken.name());
  console.log("심볼:", await krwxToken.symbol());
  console.log("총 공급량:", ethers.utils.formatEther(await krwxToken.totalSupply()), "KRWX");
  console.log("관리자 잔액:", ethers.utils.formatEther(await krwxToken.balanceOf(ADMIN_ADDRESS)), "KRWX");
  
  // 역할 확인
  const DEFAULT_ADMIN_ROLE = await krwxToken.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await krwxToken.MINTER_ROLE();
  const PAUSER_ROLE = await krwxToken.PAUSER_ROLE();
  const BLACKLISTER_ROLE = await krwxToken.BLACKLISTER_ROLE();

  console.log("역할 설정 확인:");
  console.log("- DEFAULT_ADMIN_ROLE:", await krwxToken.hasRole(DEFAULT_ADMIN_ROLE, ADMIN_ADDRESS));
  console.log("- MINTER_ROLE:", await krwxToken.hasRole(MINTER_ROLE, ADMIN_ADDRESS));
  console.log("- PAUSER_ROLE:", await krwxToken.hasRole(PAUSER_ROLE, ADMIN_ADDRESS));
  console.log("- BLACKLISTER_ROLE:", await krwxToken.hasRole(BLACKLISTER_ROLE, ADMIN_ADDRESS));

  // 컨트랙트 정보를 파일에 저장
  const deployInfo = {
    network: network.name,
    contractAddress: krwxToken.address,
    deployerAddress: deployer.address,
    transactionHash: krwxToken.deployTransaction.hash,
    blockNumber: krwxToken.deployTransaction.blockNumber,
    gasUsed: krwxToken.deployTransaction.gasLimit.toString(),
    timestamp: new Date().toISOString(),
    contractInfo: {
      name: await krwxToken.name(),
      symbol: await krwxToken.symbol(),
      decimals: await krwxToken.decimals(),
      totalSupply: ethers.utils.formatEther(await krwxToken.totalSupply()),
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    `deployment-${network.name}-${Date.now()}.json`,
    JSON.stringify(deployInfo, null, 2)
  );

  console.log("\n배포 정보가 JSON 파일에 저장되었습니다.");

  // 검증을 위한 정보 출력 (Etherscan 등)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n=== 검증을 위한 정보 ===");
    console.log("다음 명령어로 컨트랙트를 검증할 수 있습니다:");
    console.log(`npx hardhat verify --network ${network.name} ${krwxToken.address} "${INITIAL_SUPPLY}" "${ADMIN_ADDRESS}" "${FEE_RECIPIENT}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("배포 중 오류 발생:", error);
    process.exit(1);
  }); 