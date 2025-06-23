// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title KRWXStableCoin
 * @dev 원화(KRW) 페깅 스테이블 코인 컨트랙트
 * 
 * 기능:
 * - ERC20 표준 토큰
 * - 발행/소각 기능 (MINTER_ROLE)
 * - 일시정지 기능 (PAUSER_ROLE)
 * - 블랙리스트 기능 (BLACKLISTER_ROLE)
 * - 수수료 기능
 * - 리엔트런시 방지
 */
contract KRWXStableCoin is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {
    // 역할 정의
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE = keccak256("BLACKLISTER_ROLE");
    
    // 블랙리스트 매핑
    mapping(address => bool) private _blacklisted;
    
    // 수수료 설정
    uint256 public transferFeeRate = 0; // 기본 0% (베이시스 포인트: 10000 = 100%)
    uint256 public constant MAX_FEE_RATE = 100; // 최대 1%
    address public feeRecipient;
    
    // 이벤트
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /**
     * @dev 생성자
     * @param initialSupply 초기 공급량
     * @param admin 관리자 주소
     * @param feeRecipient_ 수수료 수령 주소
     */
    constructor(
        uint256 initialSupply,
        address admin,
        address feeRecipient_
    ) ERC20("Korean Won Stablecoin", "KRWX") {
        require(admin != address(0), "Admin cannot be zero address");
        require(feeRecipient_ != address(0), "Fee recipient cannot be zero address");
        
        // 역할 설정
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(BLACKLISTER_ROLE, admin);
        
        // 수수료 수령자 설정
        feeRecipient = feeRecipient_;
        
        // 초기 토큰 발행
        if (initialSupply > 0) {
            _mint(admin, initialSupply);
            emit Mint(admin, initialSupply);
        }
    }

    /**
     * @dev 토큰 발행
     * @param to 수령자 주소
     * @param amount 발행량
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(!_blacklisted[to], "Cannot mint to blacklisted address");
        
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev 토큰 소각
     * @param from 소각 대상 주소
     * @param amount 소각량
     */
    function burnFrom(address from, uint256 amount) public override onlyRole(MINTER_ROLE) {
        require(from != address(0), "Cannot burn from zero address");
        require(!_blacklisted[from], "Cannot burn from blacklisted address");
        
        _burn(from, amount);
        emit Burn(from, amount);
    }

    /**
     * @dev 컨트랙트 일시정지
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시정지 해제
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev 주소를 블랙리스트에 추가
     * @param account 블랙리스트에 추가할 주소
     */
    function blacklist(address account) public onlyRole(BLACKLISTER_ROLE) {
        require(account != address(0), "Cannot blacklist zero address");
        require(!_blacklisted[account], "Account already blacklisted");
        
        _blacklisted[account] = true;
        emit Blacklisted(account);
    }

    /**
     * @dev 주소를 블랙리스트에서 제거
     * @param account 블랙리스트에서 제거할 주소
     */
    function unBlacklist(address account) public onlyRole(BLACKLISTER_ROLE) {
        require(_blacklisted[account], "Account not blacklisted");
        
        _blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    /**
     * @dev 블랙리스트 상태 확인
     * @param account 확인할 주소
     * @return 블랙리스트 여부
     */
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    /**
     * @dev 전송 수수료율 설정
     * @param newRate 새로운 수수료율 (베이시스 포인트)
     */
    function setTransferFeeRate(uint256 newRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRate <= MAX_FEE_RATE, "Fee rate too high");
        
        uint256 oldRate = transferFeeRate;
        transferFeeRate = newRate;
        emit FeeRateUpdated(oldRate, newRate);
    }

    /**
     * @dev 수수료 수령자 변경
     * @param newRecipient 새로운 수수료 수령자
     */
    function setFeeRecipient(address newRecipient) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Fee recipient cannot be zero address");
        
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @dev 전송 함수 오버라이드 (수수료 및 블랙리스트 체크)
     */
    function _transfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        require(!_blacklisted[from], "Sender is blacklisted");
        require(!_blacklisted[to], "Recipient is blacklisted");
        
        if (transferFeeRate > 0 && from != feeRecipient && to != feeRecipient) {
            uint256 fee = (amount * transferFeeRate) / 10000;
            uint256 transferAmount = amount - fee;
            
            super._transfer(from, to, transferAmount);
            if (fee > 0) {
                super._transfer(from, feeRecipient, fee);
            }
        } else {
            super._transfer(from, to, amount);
        }
    }

    /**
     * @dev 십진수 반환 (KRW는 소수점 없음)
     */
    function decimals() public pure override returns (uint8) {
        return 18; // 일반적인 ERC20 토큰과 호환성을 위해 18자리 사용
    }

    /**
     * @dev 인터페이스 지원 확인
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev 배치 전송 (가스 효율성)
     * @param recipients 수령자 배열
     * @param amounts 금액 배열
     */
    function batchTransfer(address[] memory recipients, uint256[] memory amounts) 
        public 
        nonReentrant 
        returns (bool) 
    {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot transfer to zero address");
            require(amounts[i] > 0, "Amount must be greater than zero");
            
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
        
        return true;
    }

    /**
     * @dev 비상 회수 함수 (관리자만 사용 가능)
     * @param token 회수할 토큰 주소 (0x0이면 ETH)
     * @param amount 회수량
     */
    function emergencyRecover(address token, uint256 amount) 
        public 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        nonReentrant 
    {
        if (token == address(0)) {
            // ETH 회수
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(msg.sender).transfer(amount);
        } else {
            // ERC20 토큰 회수
            IERC20(token).transfer(msg.sender, amount);
        }
    }
} 