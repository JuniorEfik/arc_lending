// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FXPool
 * @notice Automated Market Maker for stablecoin FX trading
 * @dev Constant product formula (x * y = k) for stablecoin pairs
 */
contract FXPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public constant FEE_BPS = 30; // 0.3% fee (30 basis points)
    uint256 public constant PRECISION = 10000;
    
    // Track user liquidity deposits
    mapping(address => uint256) public userLiquidityA; // user => amount of tokenA deposited
    mapping(address => uint256) public userLiquidityB; // user => amount of tokenB deposited

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    /**
     * @notice Add liquidity to the pool
     * @dev Enforces 1:1 ratio for all liquidity additions
     */
    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        
        // Enforce 1:1 ratio - amounts must be equal
        // Allow 0.1% tolerance for rounding differences
        uint256 tolerance = amountA / 1000; // 0.1% tolerance
        uint256 difference = amountA > amountB ? amountA - amountB : amountB - amountA;
        require(difference <= tolerance, "Ratio mismatch: amounts must be in 1:1 ratio");
        
        // Use the smaller amount to ensure exact 1:1 ratio
        uint256 finalAmount = amountA < amountB ? amountA : amountB;
        
        // For first liquidity, set reserves
        if (reserveA == 0 && reserveB == 0) {
            reserveA = finalAmount;
            reserveB = finalAmount;
        } else {
            reserveA += finalAmount;
            reserveB += finalAmount;
        }

        // Transfer only the final amount (1:1 ratio)
        tokenA.safeTransferFrom(msg.sender, address(this), finalAmount);
        tokenB.safeTransferFrom(msg.sender, address(this), finalAmount);
        
        // Track user's liquidity deposits
        userLiquidityA[msg.sender] += finalAmount;
        userLiquidityB[msg.sender] += finalAmount;

        emit LiquidityAdded(msg.sender, finalAmount, finalAmount);
    }

    /**
     * @notice Add one-sided liquidity (admin only) - for rebalancing
     * @dev Allows owner to add a single token to rebalance the pool
     * The contract calculates and requires the other token to maintain ratio
     * @dev Admin liquidity is not tracked in userLiquidity mappings as it's for rebalancing
     */
    function addOneSidedLiquidity(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "Invalid amount");
        require(token == address(tokenA) || token == address(tokenB), "Invalid token");
        
        uint256 amountA;
        uint256 amountB;
        
        if (token == address(tokenA)) {
            amountA = amount;
            // Calculate required amountB to maintain ratio, or add directly if first liquidity
            if (reserveA == 0 && reserveB == 0) {
                // First liquidity - set both to same amount
                amountB = amount;
            } else if (reserveA > 0 && reserveB > 0) {
                // Calculate required amountB to maintain current ratio
                amountB = (amount * reserveB) / reserveA;
            } else {
                // One reserve is zero, set both to the same
                amountB = amount;
            }
            
            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);
            
            reserveA += amountA;
            reserveB += amountB;
            
            emit LiquidityAdded(msg.sender, amountA, amountB);
        } else {
            // token == tokenB
            amountB = amount;
            // Calculate required amountA to maintain ratio, or add directly if first liquidity
            if (reserveA == 0 && reserveB == 0) {
                // First liquidity - set both to same amount
                amountA = amount;
            } else if (reserveA > 0 && reserveB > 0) {
                // Calculate required amountA to maintain current ratio
                amountA = (amount * reserveA) / reserveB;
            } else {
                // One reserve is zero, set both to the same
                amountA = amount;
            }
            
            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);
            
            reserveA += amountA;
            reserveB += amountB;
            
            emit LiquidityAdded(msg.sender, amountA, amountB);
        }
    }

    /**
     * @notice Remove liquidity from the pool
     * @dev Users can only withdraw their own deposited liquidity
     * @dev Removes equal amounts from both tokens (1:1 ratio) based on single input amount
     * @dev If pool reserves are insufficient, only updates tracking (for cleanup)
     * @param amount Amount to remove from each token (1:1 ratio maintained)
     */
    function removeLiquidity(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        
        // Check if user has sufficient deposited liquidity for both tokens
        require(amount <= userLiquidityA[msg.sender], "Insufficient tokenA liquidity");
        require(amount <= userLiquidityB[msg.sender], "Insufficient tokenB liquidity");
        
        // Update user's liquidity tracking FIRST (before checking reserves)
        // This ensures tracking is always updated even if reserves are insufficient
        userLiquidityA[msg.sender] -= amount;
        userLiquidityB[msg.sender] -= amount;
        
        // Determine actual amounts to transfer (limited by available reserves)
        uint256 transferA = amount;
        uint256 transferB = amount;
        
        if (amount > reserveA) {
            transferA = reserveA;
        }
        if (amount > reserveB) {
            transferB = reserveB;
        }
        
        // Update pool reserves (only subtract what we can actually transfer)
        if (transferA > 0) {
            reserveA -= transferA;
        }
        if (transferB > 0) {
            reserveB -= transferB;
        }

        // Transfer tokens back to user (only what's available in reserves)
        if (transferA > 0) {
            tokenA.safeTransfer(msg.sender, transferA);
        }
        if (transferB > 0) {
            tokenB.safeTransfer(msg.sender, transferB);
        }

        emit LiquidityRemoved(msg.sender, transferA, transferB);
    }
    
    /**
     * @notice Get user's liquidity balance
     * @param user Address of the liquidity provider
     * @return amountA Amount of tokenA the user has deposited
     * @return amountB Amount of tokenB the user has deposited
     */
    function getUserLiquidity(address user) external view returns (uint256 amountA, uint256 amountB) {
        return (userLiquidityA[user], userLiquidityB[user]);
    }

    /**
     * @notice Withdraw all liquidity (admin only)
     * @dev Allows owner to withdraw all liquidity to a specified address
     * @dev Note: This does NOT update user tracking mappings. Users must use removeLiquidity to update their tracking.
     * @param recipient Address to receive the withdrawn tokens
     */
    function withdrawAllLiquidity(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(reserveA > 0 || reserveB > 0, "No liquidity to withdraw");
        
        uint256 amountA = reserveA;
        uint256 amountB = reserveB;
        
        // Reset reserves
        reserveA = 0;
        reserveB = 0;
        
        // Transfer all tokens to recipient
        if (amountA > 0) {
            tokenA.safeTransfer(recipient, amountA);
        }
        if (amountB > 0) {
            tokenB.safeTransfer(recipient, amountB);
        }
        
        emit LiquidityRemoved(recipient, amountA, amountB);
    }
    
    /**
     * @notice Reset user liquidity tracking (admin only)
     * @dev Allows owner to reset a user's tracked liquidity (for cleanup when pool is empty)
     * @param user Address of the user whose tracking should be reset
     */
    function resetUserTracking(address user) external onlyOwner {
        userLiquidityA[user] = 0;
        userLiquidityB[user] = 0;
    }

    /**
     * @notice Swap tokens
     * @dev Validates liquidity before executing swap to prevent poor exchange rates
     * @dev All validation happens BEFORE token transfers to ensure tokens never leave user's wallet if swap fails
     * @dev If tokens are somehow received before validation fails, they will be refunded
     */
    function swap(address tokenIn, uint256 amountIn) external returns (uint256) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        require(amountIn > 0, "Invalid amount");
        require(reserveA > 0 && reserveB > 0, "Pool has no liquidity");
        
        // Determine reserves and token out
        bool isTokenA = tokenIn == address(tokenA);
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        
        // Check 1: Maximum swap amount is 2 tokens (hard limit)
        // All tokens (USDC, EURC, USYC) use 6 decimals, so 2 tokens = 2 * 10^6 = 2000000
        uint256 maxSwapAmount = 2 * 1e6; // 2 tokens with 6 decimals
        require(amountIn <= maxSwapAmount, "Not more than 2 tokens can be swapped");
        
        // Check 2: Calculate expected output using constant product formula
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut > 0, "Insufficient liquidity - zero output");
        
        // Check 3: Ensure output doesn't exceed available reserve
        require(amountOut <= reserveOut, "Insufficient liquidity - output exceeds available reserve");
        
        // Check 4: Prevent swaps with extremely poor exchange rates
        // Output should be at least 40% of input value to prevent terrible swaps
        // This prevents scenarios like swapping 1 USDC and getting 0.1 EURC
        uint256 minOutputRatio = (amountIn * 40) / 100; // 40% of input
        require(amountOut >= minOutputRatio, "Insufficient liquidity - poor exchange rate");
        
        // Check 5: Ensure after swap, output reserve has at least 1.5 tokens remaining
        // This is the key check - only reject if less than 1.5 tokens would remain
        // For 6-decimal tokens, 1.5 tokens = 1.5 * 10^6 = 1500000
        uint256 minReserveThreshold = 15 * 1e5; // 1.5 tokens with 6 decimals (1.5 * 10^6)
        uint256 remainingReserve = reserveOut - amountOut;
        require(remainingReserve >= minReserveThreshold, "Insufficient liquidity - less than 1.5 tokens would remain");
        
        // ALL VALIDATION CHECKS PASSED - Now transfer tokens
        // If any check above fails, transaction reverts and tokens never leave user's wallet
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Execute swap and update reserves
        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
            tokenB.safeTransfer(msg.sender, amountOut);
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
            tokenA.safeTransfer(msg.sender, amountOut);
        }

        emit Swap(msg.sender, tokenIn, isTokenA ? address(tokenB) : address(tokenA), amountIn, amountOut);
        return amountOut;
    }

    /**
     * @notice Calculate output amount for a swap
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Invalid input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn * (PRECISION - FEE_BPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * PRECISION) + amountInWithFee;
        
        return numerator / denominator;
    }

    /**
     * @notice Get current exchange rate
     */
    function getExchangeRate() external view returns (uint256) {
        if (reserveB == 0) return 0;
        return (reserveA * 1e18) / reserveB;
    }

    /**
     * @notice Rebalance pool to 50:50 ratio (admin only)
     * @dev Adds liquidity to make both reserves equal
     * This function calculates the exact amounts needed to achieve 50:50 balance
     */
    function rebalanceTo5050() external onlyOwner {
        require(reserveA > 0 && reserveB > 0, "Pool must have liquidity");
        
        uint256 amountA;
        uint256 amountB;
        
        if (reserveA > reserveB) {
            // ReserveA is higher, add only tokenB to match reserveA
            amountA = 0;
            amountB = reserveA - reserveB;
        } else if (reserveB > reserveA) {
            // ReserveB is higher, add only tokenA to match reserveB
            amountA = reserveB - reserveA;
            amountB = 0;
        } else {
            // Already balanced
            return;
        }
        
        // Transfer tokens
        if (amountA > 0) {
            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            reserveA += amountA;
        }
        if (amountB > 0) {
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);
            reserveB += amountB;
        }
        
        emit LiquidityAdded(msg.sender, amountA, amountB);
    }

    /**
     * @notice Get reserves
     */
    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }
}

