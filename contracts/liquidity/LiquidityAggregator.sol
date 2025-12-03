// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../fx/FXPool.sol";
import "../lending/LendingPool.sol";

/**
 * @title LiquidityAggregator
 * @notice Aggregates liquidity from multiple protocols
 * @dev Routes trades across lending pools, FX pools, and other DeFi protocols
 */
contract LiquidityAggregator is Ownable {
    using SafeERC20 for IERC20;

    constructor() Ownable(msg.sender) {}

    struct Protocol {
        address protocol;
        string protocolType; // "LENDING", "FX", "DEX"
        bool enabled;
    }

    mapping(address => Protocol) public protocols;
    address[] public protocolList;

    event ProtocolAdded(address indexed protocol, string protocolType);
    event ProtocolRemoved(address indexed protocol);
    event TradeExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address protocol
    );

    /**
     * @notice Add a protocol to the aggregator
     */
    function addProtocol(address protocol, string memory protocolType) external onlyOwner {
        protocols[protocol] = Protocol({
            protocol: protocol,
            protocolType: protocolType,
            enabled: true
        });
        protocolList.push(protocol);
        emit ProtocolAdded(protocol, protocolType);
    }

    /**
     * @notice Remove a protocol
     */
    function removeProtocol(address protocol) external onlyOwner {
        protocols[protocol].enabled = false;
        emit ProtocolRemoved(protocol);
    }

    /**
     * @notice Get quote from a specific protocol
     */
    function getQuote(
        address protocol,
        address tokenIn,
        address /* tokenOut */,
        uint256 amountIn
    ) public view returns (uint256) {
        Protocol memory p = protocols[protocol];
        if (!p.enabled) return 0;

        if (keccak256(bytes(p.protocolType)) == keccak256(bytes("FX"))) {
            return _getFXQuote(protocol, tokenIn, amountIn);
        } else if (keccak256(bytes(p.protocolType)) == keccak256(bytes("LENDING"))) {
            // For lending, would need to check available liquidity
            return 0; // Simplified
        }
        
        return 0;
    }

    /**
     * @notice Get best quote across all protocols
     */
    function getBestQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 bestAmount, address bestProtocol) {
        bestAmount = 0;
        bestProtocol = address(0);

        for (uint256 i = 0; i < protocolList.length; i++) {
            address protocol = protocolList[i];
            if (!protocols[protocol].enabled) continue;

            uint256 quote = getQuote(protocol, tokenIn, tokenOut, amountIn);
            if (quote > bestAmount) {
                bestAmount = quote;
                bestProtocol = protocol;
            }
        }

        return (bestAmount, bestProtocol);
    }

    /**
     * @notice Execute trade through best protocol
     */
    function executeTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) public returns (uint256) {
        (uint256 bestAmount, address bestProtocol) = this.getBestQuote(tokenIn, tokenOut, amountIn);
        require(bestAmount >= minAmountOut, "Slippage exceeded");
        require(bestProtocol != address(0), "No liquidity available");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        Protocol memory p = protocols[bestProtocol];
        uint256 amountOut;

        if (keccak256(bytes(p.protocolType)) == keccak256(bytes("FX"))) {
            IERC20(tokenIn).forceApprove(bestProtocol, amountIn);
            amountOut = FXPool(bestProtocol).swap(tokenIn, amountIn);
        } else {
            revert("Unsupported protocol type");
        }

        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit TradeExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, bestProtocol);
        return amountOut;
    }

    /**
     * @notice Get FX quote
     */
    function _getFXQuote(
        address pool,
        address tokenIn,
        uint256 amountIn
    ) internal view returns (uint256) {
        (uint256 reserveA, uint256 reserveB) = FXPool(pool).getReserves();
        address tokenA = address(FXPool(pool).tokenA());
        
        if (tokenIn == tokenA) {
            return FXPool(pool).getAmountOut(amountIn, reserveA, reserveB);
        } else {
            return FXPool(pool).getAmountOut(amountIn, reserveB, reserveA);
        }
    }

    /**
     * @notice Split trade across multiple protocols for optimal execution
     */
    function executeSplitTrade(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        // Simplified - would implement optimal split algorithm
        return executeTrade(tokenIn, tokenOut, totalAmountIn, minAmountOut);
    }
}

