// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title InstitutionalSettlement
 * @notice Enterprise-grade settlement system for institutional trading
 * @dev Supports multi-party settlements, compliance, and audit trails
 */
contract InstitutionalSettlement is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    struct SettlementOrder {
        address initiator;
        address[] parties;
        address[] tokens;
        uint256[] amounts;
        address[] recipients;
        uint256 deadline;
        bytes32 complianceHash; // KYC/AML compliance reference
        bool executed;
        bool cancelled;
        uint256 createdAt;
    }

    mapping(bytes32 => SettlementOrder) public settlements;
    mapping(bytes32 => bool) public complianceApprovals;
    mapping(address => uint256) public nonces;

    event SettlementCreated(
        bytes32 indexed settlementId,
        address indexed initiator,
        uint256 partyCount
    );
    event SettlementExecuted(bytes32 indexed settlementId);
    event SettlementCancelled(bytes32 indexed settlementId);
    event ComplianceApproved(bytes32 indexed settlementId, bytes32 complianceHash);
    event ComplianceRejected(bytes32 indexed settlementId);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
    }

    /**
     * @notice Create a multi-party settlement
     */
    function createSettlement(
        address[] memory parties,
        address[] memory tokens,
        uint256[] memory amounts,
        address[] memory recipients,
        uint256 deadline,
        bytes32 complianceHash
    ) external returns (bytes32) {
        require(parties.length > 0, "No parties");
        require(
            tokens.length == amounts.length && amounts.length == recipients.length,
            "Array length mismatch"
        );
        require(deadline > block.timestamp, "Invalid deadline");

        bytes32 settlementId = keccak256(
            abi.encodePacked(
                msg.sender,
                parties,
                tokens,
                amounts,
                recipients,
                nonces[msg.sender]++,
                block.timestamp
            )
        );

        settlements[settlementId] = SettlementOrder({
            initiator: msg.sender,
            parties: parties,
            tokens: tokens,
            amounts: amounts,
            recipients: recipients,
            deadline: deadline,
            complianceHash: complianceHash,
            executed: false,
            cancelled: false,
            createdAt: block.timestamp
        });

        emit SettlementCreated(settlementId, msg.sender, parties.length);
        return settlementId;
    }

    /**
     * @notice Approve compliance for a settlement
     */
    function approveCompliance(bytes32 settlementId) external onlyRole(COMPLIANCE_ROLE) {
        SettlementOrder storage settlement = settlements[settlementId];
        require(settlement.initiator != address(0), "Settlement not found");
        require(!settlement.executed && !settlement.cancelled, "Settlement finalized");

        complianceApprovals[settlementId] = true;
        emit ComplianceApproved(settlementId, settlement.complianceHash);
    }

    /**
     * @notice Reject compliance for a settlement
     */
    function rejectCompliance(bytes32 settlementId) external onlyRole(COMPLIANCE_ROLE) {
        SettlementOrder storage settlement = settlements[settlementId];
        require(settlement.initiator != address(0), "Settlement not found");
        
        settlement.cancelled = true;
        emit ComplianceRejected(settlementId);
    }

    /**
     * @notice Execute settlement (requires compliance approval)
     */
    function executeSettlement(bytes32 settlementId) external nonReentrant onlyRole(SETTLER_ROLE) {
        SettlementOrder storage settlement = settlements[settlementId];
        
        require(settlement.initiator != address(0), "Settlement not found");
        require(!settlement.executed, "Already executed");
        require(!settlement.cancelled, "Settlement cancelled");
        require(block.timestamp <= settlement.deadline, "Settlement expired");
        require(complianceApprovals[settlementId], "Compliance not approved");

        // Execute all transfers
        for (uint256 i = 0; i < settlement.tokens.length; i++) {
            IERC20(settlement.tokens[i]).safeTransferFrom(
                settlement.parties[i % settlement.parties.length],
                settlement.recipients[i],
                settlement.amounts[i]
            );
        }

        settlement.executed = true;
        emit SettlementExecuted(settlementId);
    }

    /**
     * @notice Cancel settlement
     */
    function cancelSettlement(bytes32 settlementId) external {
        SettlementOrder storage settlement = settlements[settlementId];
        require(settlement.initiator != address(0), "Settlement not found");
        require(
            msg.sender == settlement.initiator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        require(!settlement.executed, "Already executed");

        settlement.cancelled = true;
        emit SettlementCancelled(settlementId);
    }

    /**
     * @notice Get settlement details
     */
    function getSettlement(bytes32 settlementId)
        external
        view
        returns (SettlementOrder memory)
    {
        return settlements[settlementId];
    }

    /**
     * @notice Batch execute multiple settlements
     */
    function batchExecuteSettlements(bytes32[] memory settlementIds) external nonReentrant onlyRole(SETTLER_ROLE) {
        for (uint256 i = 0; i < settlementIds.length; i++) {
            this.executeSettlement(settlementIds[i]);
        }
    }

    /**
     * @notice Check if settlement is ready for execution
     */
    function isReadyForExecution(bytes32 settlementId) external view returns (bool) {
        SettlementOrder memory settlement = settlements[settlementId];
        return (
            settlement.initiator != address(0) &&
            !settlement.executed &&
            !settlement.cancelled &&
            block.timestamp <= settlement.deadline &&
            complianceApprovals[settlementId]
        );
    }
}


