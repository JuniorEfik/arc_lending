// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DeliveryVsPayment
 * @notice Atomic settlement for tokenized assets (DvP)
 * @dev Ensures simultaneous delivery of asset and payment
 */
contract DeliveryVsPayment is Ownable {
    using SafeERC20 for IERC20;

    constructor() Ownable(msg.sender) {}

    struct Settlement {
        address buyer;
        address seller;
        address assetToken;
        address paymentToken;
        uint256 assetAmount;
        uint256 paymentAmount;
        uint256 deadline;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => Settlement) public settlements;
    mapping(address => uint256) public nonces;

    event SettlementCreated(
        bytes32 indexed settlementId,
        address indexed buyer,
        address indexed seller,
        address assetToken,
        address paymentToken,
        uint256 assetAmount,
        uint256 paymentAmount
    );
    event SettlementExecuted(bytes32 indexed settlementId);
    event SettlementCancelled(bytes32 indexed settlementId);

    /**
     * @notice Create a DvP settlement
     */
    function createSettlement(
        address seller,
        address assetToken,
        address paymentToken,
        uint256 assetAmount,
        uint256 paymentAmount,
        uint256 deadline
    ) external returns (bytes32) {
        require(deadline > block.timestamp, "Invalid deadline");
        require(assetAmount > 0 && paymentAmount > 0, "Invalid amounts");

        bytes32 settlementId = keccak256(
            abi.encodePacked(
                msg.sender,
                seller,
                assetToken,
                paymentToken,
                assetAmount,
                paymentAmount,
                nonces[msg.sender]++,
                block.timestamp
            )
        );

        settlements[settlementId] = Settlement({
            buyer: msg.sender,
            seller: seller,
            assetToken: assetToken,
            paymentToken: paymentToken,
            assetAmount: assetAmount,
            paymentAmount: paymentAmount,
            deadline: deadline,
            executed: false,
            cancelled: false
        });

        // Lock payment from buyer
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), paymentAmount);

        emit SettlementCreated(
            settlementId,
            msg.sender,
            seller,
            assetToken,
            paymentToken,
            assetAmount,
            paymentAmount
        );

        return settlementId;
    }

    /**
     * @notice Execute DvP settlement (atomic swap)
     */
    function executeSettlement(bytes32 settlementId) external {
        Settlement storage settlement = settlements[settlementId];
        
        require(!settlement.executed, "Already executed");
        require(!settlement.cancelled, "Settlement cancelled");
        require(block.timestamp <= settlement.deadline, "Settlement expired");
        require(msg.sender == settlement.seller, "Only seller can execute");

        // Transfer asset from seller to buyer
        IERC20(settlement.assetToken).safeTransferFrom(
            settlement.seller,
            settlement.buyer,
            settlement.assetAmount
        );

        // Transfer payment from escrow to seller
        IERC20(settlement.paymentToken).safeTransfer(
            settlement.seller,
            settlement.paymentAmount
        );

        settlement.executed = true;

        emit SettlementExecuted(settlementId);
    }

    /**
     * @notice Cancel settlement and refund buyer
     */
    function cancelSettlement(bytes32 settlementId) external {
        Settlement storage settlement = settlements[settlementId];
        
        require(!settlement.executed, "Already executed");
        require(!settlement.cancelled, "Already cancelled");
        require(
            msg.sender == settlement.buyer || msg.sender == owner(),
            "Unauthorized"
        );

        settlement.cancelled = true;

        // Refund payment to buyer
        IERC20(settlement.paymentToken).safeTransfer(
            settlement.buyer,
            settlement.paymentAmount
        );

        emit SettlementCancelled(settlementId);
    }

    /**
     * @notice Get settlement details
     */
    function getSettlement(bytes32 settlementId)
        external
        view
        returns (Settlement memory)
    {
        return settlements[settlementId];
    }
}

