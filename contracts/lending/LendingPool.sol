// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./InterestRateModel.sol";
import "./CollateralManager.sol";

/**
 * @title LendingPool
 * @notice Core lending pool for deposits and borrows
 * @dev Manages liquidity, interest accrual, and borrowing
 */
contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    InterestRateModel public interestRateModel;
    CollateralManager public collateralManager;

    struct Market {
        IERC20 token;
        uint256 totalDeposits;
        uint256 totalBorrows;
        uint256 reserveFactor; // Reserve factor (e.g., 1000 = 10%)
        bool enabled;
    }

    mapping(address => Market) public markets;
    mapping(address => mapping(address => uint256)) public deposits; // user => token => amount
    mapping(address => mapping(address => uint256)) public borrows; // user => token => amount
    mapping(address => uint256) public lastUpdateTime;
    mapping(address => uint256) public borrowIndex; // Accumulated interest index

    uint256 public constant SECONDS_PER_YEAR = 31536000;
    uint256 public constant PRECISION = 1e18;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);

    constructor(address _interestRateModel, address _collateralManager) Ownable(msg.sender) {
        interestRateModel = InterestRateModel(_interestRateModel);
        collateralManager = CollateralManager(_collateralManager);
    }

    /**
     * @notice Add a new market
     */
    function addMarket(address token, uint256 reserveFactor) external onlyOwner {
        markets[token] = Market({
            token: IERC20(token),
            totalDeposits: 0,
            totalBorrows: 0,
            reserveFactor: reserveFactor,
            enabled: true
        });
        borrowIndex[token] = PRECISION;
        lastUpdateTime[token] = block.timestamp;
    }

    /**
     * @notice Deposit tokens to the pool
     */
    function deposit(address token, uint256 amount) external {
        Market storage market = markets[token];
        require(market.enabled, "Market not enabled");
        
        _accrueInterest(token);
        
        market.token.safeTransferFrom(msg.sender, address(this), amount);
        market.totalDeposits += amount;
        deposits[msg.sender][token] += amount;
        
        emit Deposit(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw tokens from the pool
     */
    function withdraw(address token, uint256 amount) external {
        Market storage market = markets[token];
        require(deposits[msg.sender][token] >= amount, "Insufficient balance");
        
        _accrueInterest(token);
        
        deposits[msg.sender][token] -= amount;
        market.totalDeposits -= amount;
        
        market.token.safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, token, amount);
    }

    /**
     * @notice Borrow tokens from the pool
     */
    function borrow(address token, uint256 amount) external {
        Market storage market = markets[token];
        require(market.enabled, "Market not enabled");
        
        _accrueInterest(token);
        
        // Check collateral requirements
        uint256 maxBorrow = collateralManager.getMaxBorrow(msg.sender);
        uint256 currentBorrow = _getBorrowBalance(msg.sender, token);
        require(currentBorrow + amount <= maxBorrow, "Exceeds borrow limit");
        
        require(market.totalDeposits >= market.totalBorrows + amount, "Insufficient liquidity");
        
        borrows[msg.sender][token] += amount;
        market.totalBorrows += amount;
        
        market.token.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, token, amount);
    }

    /**
     * @notice Repay borrowed tokens
     */
    function repay(address token, uint256 amount) external {
        Market storage market = markets[token];
        
        _accrueInterest(token);
        
        uint256 borrowBalance = _getBorrowBalance(msg.sender, token);
        uint256 repayAmount = amount > borrowBalance ? borrowBalance : amount;
        
        market.token.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        borrows[msg.sender][token] = borrowBalance - repayAmount;
        market.totalBorrows -= repayAmount;
        
        emit Repay(msg.sender, token, repayAmount);
    }

    /**
     * @notice Get current borrow balance including interest
     */
    function getBorrowBalance(address user, address token) external view returns (uint256) {
        return _getBorrowBalance(user, token);
    }

    /**
     * @notice Get current deposit balance including interest
     */
    function getDepositBalance(address user, address token) external view returns (uint256) {
        uint256 supplyRate = _getSupplyRate(token);
        uint256 timeDelta = block.timestamp - lastUpdateTime[token];
        uint256 interestFactor = (supplyRate * timeDelta) / SECONDS_PER_YEAR;
        return deposits[user][token] + (deposits[user][token] * interestFactor) / PRECISION;
    }

    /**
     * @notice Accrue interest for a market
     */
    function _accrueInterest(address token) internal {
        Market storage market = markets[token];
        if (market.totalBorrows == 0) {
            lastUpdateTime[token] = block.timestamp;
            return;
        }
        
        uint256 borrowRate = interestRateModel.getBorrowRate(
            market.totalBorrows,
            market.totalDeposits
        );
        
        uint256 timeDelta = block.timestamp - lastUpdateTime[token];
        uint256 interestFactor = (borrowRate * timeDelta) / SECONDS_PER_YEAR;
        
        uint256 interestAccrued = (market.totalBorrows * interestFactor) / PRECISION;
        market.totalBorrows += interestAccrued;
        borrowIndex[token] = (borrowIndex[token] * (PRECISION + interestFactor)) / PRECISION;
        
        lastUpdateTime[token] = block.timestamp;
    }

    /**
     * @notice Get borrow balance with accrued interest
     */
    function _getBorrowBalance(address user, address token) internal view returns (uint256) {
        uint256 principal = borrows[user][token];
        if (principal == 0) return 0;
        
        uint256 currentIndex = borrowIndex[token];
        // Simplified - would use stored index per user in production
        return (principal * currentIndex) / PRECISION;
    }

    /**
     * @notice Get current supply rate
     */
    function _getSupplyRate(address token) internal view returns (uint256) {
        Market memory market = markets[token];
        if (market.totalDeposits == 0) return 0;
        
        uint256 utilization = (market.totalBorrows * PRECISION) / market.totalDeposits;
        uint256 borrowRate = interestRateModel.getBorrowRate(
            market.totalBorrows,
            market.totalDeposits
        );
        return interestRateModel.getSupplyRate(borrowRate, utilization);
    }
}

