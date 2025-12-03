// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CollateralManager
 * @notice Manages collateral deposits and liquidations
 * @dev Handles multiple collateral types with different LTV ratios
 */
contract CollateralManager is Ownable {
    constructor() Ownable(msg.sender) {}

    struct CollateralConfig {
        address token;
        uint256 ltv; // Loan-to-value ratio (e.g., 7500 = 75%)
        uint256 liquidationThreshold; // Threshold for liquidation (e.g., 8000 = 80%)
        bool enabled;
    }

    mapping(address => CollateralConfig) public collateralConfigs;
    mapping(address => mapping(address => uint256)) public collateralBalances; // user => token => amount
    mapping(address => uint256) public totalCollateralValue; // user => total value in USD

    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant LIQUIDATION_BONUS = 500; // 5% bonus for liquidators (basis points)

    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);
    event CollateralLiquidated(
        address indexed user,
        address indexed collateralToken,
        address indexed debtToken,
        uint256 collateralAmount,
        uint256 debtAmount
    );

    /**
     * @notice Configure a collateral token
     */
    function configureCollateral(
        address token,
        uint256 ltv,
        uint256 liquidationThreshold
    ) external onlyOwner {
        require(ltv < liquidationThreshold, "Invalid thresholds");
        require(liquidationThreshold <= 10000, "Threshold too high");
        
        collateralConfigs[token] = CollateralConfig({
            token: token,
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            enabled: true
        });
    }

    /**
     * @notice Deposit collateral
     */
    function depositCollateral(address token, uint256 amount) external {
        CollateralConfig memory config = collateralConfigs[token];
        require(config.enabled, "Collateral not enabled");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        collateralBalances[msg.sender][token] += amount;
        
        // Update total collateral value (simplified - would use oracle in production)
        totalCollateralValue[msg.sender] += amount;
        
        emit CollateralDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw collateral
     */
    function withdrawCollateral(address token, uint256 amount) external {
        require(collateralBalances[msg.sender][token] >= amount, "Insufficient collateral");
        
        collateralBalances[msg.sender][token] -= amount;
        totalCollateralValue[msg.sender] -= amount;
        
        IERC20(token).transfer(msg.sender, amount);
        
        emit CollateralWithdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Get maximum borrowable amount for a user
     */
    function getMaxBorrow(address user) external view returns (uint256) {
        uint256 collateralValue = totalCollateralValue[user];
        // Use the lowest LTV among all collateral types (simplified)
        // In production, would calculate weighted LTV
        return (collateralValue * 7500) / 10000; // 75% LTV
    }

    /**
     * @notice Check if a position is liquidatable
     */
    function isLiquidatable(address user, uint256 debtValue) public view returns (bool) {
        uint256 collateralValue = totalCollateralValue[user];
        if (collateralValue == 0) return false;
        
        // Position is liquidatable if debt exceeds liquidation threshold
        uint256 healthFactor = (collateralValue * 10000) / debtValue;
        return healthFactor < 8000; // 80% threshold
    }

    /**
     * @notice Liquidate a position
     */
    function liquidate(
        address user,
        address collateralToken,
        address debtToken,
        uint256 debtAmount
    ) external {
        require(isLiquidatable(user, debtAmount), "Position not liquidatable");
        
        uint256 collateralAmount = (debtAmount * (10000 + LIQUIDATION_BONUS)) / 10000;
        
        require(collateralBalances[user][collateralToken] >= collateralAmount, "Insufficient collateral");
        
        collateralBalances[user][collateralToken] -= collateralAmount;
        totalCollateralValue[user] -= collateralAmount;
        
        // Transfer debt token from liquidator
        IERC20(debtToken).transferFrom(msg.sender, address(this), debtAmount);
        
        // Transfer collateral to liquidator
        IERC20(collateralToken).transfer(msg.sender, collateralAmount);
        
        emit CollateralLiquidated(user, collateralToken, debtToken, collateralAmount, debtAmount);
    }
}

