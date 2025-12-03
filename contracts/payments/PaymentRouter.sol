// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentRouter
 * @notice Cross-border payment and payout system
 * @dev Handles remittances, payouts, and cross-border transfers
 */
contract PaymentRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    constructor() Ownable(msg.sender) {}

    struct Payment {
        address sender;
        address recipient;
        address token;
        uint256 amount;
        uint256 fee;
        uint256 timestamp;
        bool executed;
        bool cancelled;
        string paymentId; // External payment reference
    }

    mapping(bytes32 => Payment) public payments;
    mapping(address => bool) public authorizedRouters;
    mapping(address => uint256) public fees; // token => fee in basis points
    uint256 public constant MAX_FEE_BPS = 100; // 1% max fee

    event PaymentCreated(
        bytes32 indexed paymentHash,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        string paymentId
    );
    event PaymentExecuted(bytes32 indexed paymentHash);
    event PaymentCancelled(bytes32 indexed paymentHash);
    event FeeUpdated(address indexed token, uint256 feeBps);
    event RouterAuthorized(address indexed router, bool authorized);

    /**
     * @notice Set fee for a token
     */
    function setFee(address token, uint256 feeBps) external onlyOwner {
        require(feeBps <= MAX_FEE_BPS, "Fee too high");
        fees[token] = feeBps;
        emit FeeUpdated(token, feeBps);
    }

    /**
     * @notice Authorize a payment router
     */
    function authorizeRouter(address router, bool authorized) external onlyOwner {
        authorizedRouters[router] = authorized;
        emit RouterAuthorized(router, authorized);
    }

    /**
     * @notice Create a payment
     */
    function createPayment(
        address recipient,
        address token,
        uint256 amount,
        string memory paymentId
    ) external nonReentrant returns (bytes32) {
        require(amount > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient");

        uint256 fee = (amount * fees[token]) / 10000;
        uint256 netAmount = amount - fee;

        bytes32 paymentHash = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                token,
                amount,
                paymentId,
                block.timestamp
            )
        );

        payments[paymentHash] = Payment({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: netAmount,
            fee: fee,
            timestamp: block.timestamp,
            executed: false,
            cancelled: false,
            paymentId: paymentId
        });

        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit PaymentCreated(paymentHash, msg.sender, recipient, token, amount, paymentId);
        return paymentHash;
    }

    /**
     * @notice Execute a payment
     */
    function executePayment(bytes32 paymentHash) external nonReentrant {
        Payment storage payment = payments[paymentHash];
        require(!payment.executed, "Already executed");
        require(!payment.cancelled, "Payment was cancelled");
        require(
            msg.sender == payment.recipient || authorizedRouters[msg.sender],
            "Unauthorized"
        );

        payment.executed = true;

        // Transfer to recipient
        IERC20(payment.token).safeTransfer(payment.recipient, payment.amount);

        // Fee goes to contract (can be withdrawn by owner)
        if (payment.fee > 0) {
            IERC20(payment.token).safeTransfer(address(this), payment.fee);
        }

        emit PaymentExecuted(paymentHash);
    }

    /**
     * @notice Cancel a payment (only sender can cancel if not executed)
     */
    function cancelPayment(bytes32 paymentHash) external nonReentrant {
        Payment storage payment = payments[paymentHash];
        require(!payment.executed, "Payment already executed");
        require(!payment.cancelled, "Payment already cancelled");
        require(msg.sender == payment.sender, "Only sender can cancel");

        payment.cancelled = true;

        // Refund full amount (including fee) to sender
        IERC20(payment.token).safeTransfer(payment.sender, payment.amount + payment.fee);

        emit PaymentCancelled(paymentHash);
    }

    /**
     * @notice Batch create payments
     */
    function batchCreatePayments(
        address[] memory recipients,
        address token,
        uint256[] memory amounts,
        string[] memory paymentIds
    ) external nonReentrant returns (bytes32[] memory) {
        require(
            recipients.length == amounts.length && amounts.length == paymentIds.length,
            "Array length mismatch"
        );

        bytes32[] memory paymentHashes = new bytes32[](recipients.length);
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            totalAmount += amounts[i];
            paymentHashes[i] = this.createPayment(recipients[i], token, amounts[i], paymentIds[i]);
        }

        // Transfer total amount once
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        return paymentHashes;
    }

    /**
     * @notice Batch execute payments
     */
    function batchExecutePayments(bytes32[] memory paymentHashes) external nonReentrant {
        for (uint256 i = 0; i < paymentHashes.length; i++) {
            this.executePayment(paymentHashes[i]);
        }
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdrawFees(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner(), balance);
    }

    /**
     * @notice Get payment details
     */
    function getPayment(bytes32 paymentHash) external view returns (Payment memory) {
        return payments[paymentHash];
    }
}

