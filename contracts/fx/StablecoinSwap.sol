// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./FXPool.sol";

/**
 * @title StablecoinSwap
 * @notice Multi-pool stablecoin swap router
 * @dev Routes swaps across multiple FX pools for optimal rates
 */
contract StablecoinSwap is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => address)) public pools; // tokenA => tokenB => pool
    address[] public registeredPools;

    event PoolRegistered(address indexed pool, address indexed tokenA, address indexed tokenB);
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new FX pool
     */
    function registerPool(address pool, address tokenA, address tokenB) external onlyOwner {
        require(pool != address(0), "Invalid pool");
        pools[tokenA][tokenB] = pool;
        pools[tokenB][tokenA] = pool;
        registeredPools.push(pool);
        emit PoolRegistered(pool, tokenA, tokenB);
    }

    /**
     * @notice Swap tokens directly through a pool
     */
    function swapDirect(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        address pool = pools[tokenIn][tokenOut];
        require(pool != address(0), "Pool not found");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(pool, amountIn);

        uint256 amountOut = FXPool(pool).swap(tokenIn, amountIn);
        require(amountOut >= minAmountOut, "Slippage exceeded");

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }

    /**
     * @notice Get quote for a swap
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        address pool = pools[tokenIn][tokenOut];
        if (pool == address(0)) return 0;

        (uint256 reserveA, uint256 reserveB) = FXPool(pool).getReserves();
        address tokenA = address(FXPool(pool).tokenA());
        
        if (tokenIn == tokenA) {
            return FXPool(pool).getAmountOut(amountIn, reserveA, reserveB);
        } else {
            return FXPool(pool).getAmountOut(amountIn, reserveB, reserveA);
        }
    }

    /**
     * @notice Get best quote across all pools
     */
    function getBestQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 bestAmount, address bestPool) {
        bestAmount = 0;
        
        // Direct pool
        address directPool = pools[tokenIn][tokenOut];
        if (directPool != address(0)) {
            uint256 directAmount = this.getQuote(tokenIn, tokenOut, amountIn);
            if (directAmount > bestAmount) {
                bestAmount = directAmount;
                bestPool = directPool;
            }
        }

        // Could add multi-hop routing here
        return (bestAmount, bestPool);
    }
}

