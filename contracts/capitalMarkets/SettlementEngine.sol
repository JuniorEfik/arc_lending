// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DeliveryVsPayment.sol";

/**
 * @title SettlementEngine
 * @notice Real-time settlement engine for capital markets
 * @dev Handles batch settlements and multi-party transactions
 */
contract SettlementEngine is Ownable {
    using SafeERC20 for IERC20;

    DeliveryVsPayment public dvp;

    struct BatchSettlement {
        bytes32[] settlementIds;
        uint256 deadline;
        bool executed;
    }

    mapping(bytes32 => BatchSettlement) public batches;
    mapping(address => bool) public authorizedSettlers;

    event BatchCreated(bytes32 indexed batchId, uint256 settlementCount);
    event BatchExecuted(bytes32 indexed batchId);
    event SettlerAuthorized(address indexed settler, bool authorized);

    constructor(address _dvp) Ownable(msg.sender) {
        dvp = DeliveryVsPayment(_dvp);
    }

    /**
     * @notice Authorize a settler
     */
    function authorizeSettler(address settler, bool authorized) external onlyOwner {
        authorizedSettlers[settler] = authorized;
        emit SettlerAuthorized(settler, authorized);
    }

    /**
     * @notice Create a batch settlement
     */
    function createBatch(
        bytes32[] memory settlementIds,
        uint256 deadline
    ) external returns (bytes32) {
        require(settlementIds.length > 0, "Empty batch");
        require(deadline > block.timestamp, "Invalid deadline");

        bytes32 batchId = keccak256(
            abi.encodePacked(settlementIds, block.timestamp, msg.sender)
        );

        batches[batchId] = BatchSettlement({
            settlementIds: settlementIds,
            deadline: deadline,
            executed: false
        });

        emit BatchCreated(batchId, settlementIds.length);
        return batchId;
    }

    /**
     * @notice Execute batch settlement
     */
    function executeBatch(bytes32 batchId) external {
        require(authorizedSettlers[msg.sender] || msg.sender == owner(), "Unauthorized");
        
        BatchSettlement storage batch = batches[batchId];
        require(!batch.executed, "Batch already executed");
        require(block.timestamp <= batch.deadline, "Batch expired");

        // Execute all settlements in the batch
        for (uint256 i = 0; i < batch.settlementIds.length; i++) {
            dvp.executeSettlement(batch.settlementIds[i]);
        }

        batch.executed = true;
        emit BatchExecuted(batchId);
    }

    /**
     * @notice Get batch details
     */
    function getBatch(bytes32 batchId)
        external
        view
        returns (BatchSettlement memory)
    {
        return batches[batchId];
    }

    /**
     * @notice Real-time settlement (single transaction)
     */
    function settleRealTime(
        address buyer,
        address seller,
        address assetToken,
        address paymentToken,
        uint256 assetAmount,
        uint256 paymentAmount
    ) external {
        require(authorizedSettlers[msg.sender] || msg.sender == owner(), "Unauthorized");

        // Transfer asset from seller to buyer
        IERC20(assetToken).safeTransferFrom(seller, buyer, assetAmount);

        // Transfer payment from buyer to seller
        IERC20(paymentToken).safeTransferFrom(buyer, seller, paymentAmount);
    }
}

