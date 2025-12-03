// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InterestRateModel
 * @notice Dynamic interest rate model for lending pools
 * @dev Implements a linear interest rate model with utilization-based rates
 */
contract InterestRateModel {
    uint256 public constant BASE_RATE = 1e16; // 1% base rate
    uint256 public constant SLOPE_1 = 4e16; // 4% slope for low utilization
    uint256 public constant SLOPE_2 = 75e16; // 75% slope for high utilization
    uint256 public constant OPTIMAL_UTILIZATION = 80e16; // 80% optimal utilization

    /**
     * @notice Calculate the current borrow rate based on utilization
     * @param totalBorrows Total amount borrowed
     * @param totalDeposits Total amount deposited
     * @return The current borrow rate (scaled by 1e18)
     */
    function getBorrowRate(uint256 totalBorrows, uint256 totalDeposits) 
        public 
        pure 
        returns (uint256) 
    {
        if (totalDeposits == 0) return BASE_RATE;
        
        uint256 utilization = (totalBorrows * 1e18) / totalDeposits;
        
        if (utilization <= OPTIMAL_UTILIZATION) {
            // Linear increase from BASE_RATE to BASE_RATE + SLOPE_1 at optimal
            return BASE_RATE + (utilization * SLOPE_1) / OPTIMAL_UTILIZATION;
        } else {
            // Steeper increase after optimal utilization
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
            uint256 excessRate = (excessUtilization * SLOPE_2) / (1e18 - OPTIMAL_UTILIZATION);
            return BASE_RATE + SLOPE_1 + excessRate;
        }
    }

    /**
     * @notice Calculate the supply rate based on borrow rate and utilization
     * @param borrowRate The current borrow rate
     * @param utilization The current utilization rate
     * @return The supply rate (scaled by 1e18)
     */
    function getSupplyRate(uint256 borrowRate, uint256 utilization) 
        public 
        pure 
        returns (uint256) 
    {
        // Supply rate = borrow rate * utilization * (1 - reserve factor)
        // Reserve factor of 10% (0.1)
        uint256 reserveFactor = 1e17; // 10%
        return (borrowRate * utilization * (1e18 - reserveFactor)) / 1e36;
    }
}


