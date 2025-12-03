// Import ABIs from artifacts - these are the full ABIs from compiled contracts
// For production, you would copy these from artifacts/contracts/*/ContractName.json

export const LENDING_POOL_ABI = [
  "function deposit(address token, uint256 amount) external",
  "function withdraw(address token, uint256 amount) external",
  "function borrow(address token, uint256 amount) external",
  "function repay(address token, uint256 amount) external",
  "function getDepositBalance(address user, address token) external view returns (uint256)",
  "function getBorrowBalance(address user, address token) external view returns (uint256)",
  "function addMarket(address token, uint256 reserveFactor) external",
  "function markets(address) external view returns (tuple(address token, uint256 totalDeposits, uint256 totalBorrows, uint256 reserveFactor, bool enabled))",
  "function owner() external view returns (address)",
  "event Deposit(address indexed user, address indexed token, uint256 amount)",
  "event Withdraw(address indexed user, address indexed token, uint256 amount)",
  "event Borrow(address indexed user, address indexed token, uint256 amount)",
  "event Repay(address indexed user, address indexed token, uint256 amount)",
] as const

export const COLLATERAL_MANAGER_ABI = [
  "function depositCollateral(address token, uint256 amount) external",
  "function withdrawCollateral(address token, uint256 amount) external",
  "function getMaxBorrow(address user) external view returns (uint256)",
  "function isLiquidatable(address user, uint256 debtValue) public view returns (bool)",
  "function configureCollateral(address token, uint256 ltv, uint256 liquidationThreshold) external",
  "function collateralConfigs(address) external view returns (tuple(address token, uint256 ltv, uint256 liquidationThreshold, bool enabled))",
  "function collateralBalances(address, address) external view returns (uint256)",
  "function totalCollateralValue(address) external view returns (uint256)",
  "function owner() external view returns (address)",
  "event CollateralDeposited(address indexed user, address indexed token, uint256 amount)",
  "event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount)",
] as const

export const FX_POOL_ABI = [
  "function addLiquidity(uint256 amountA, uint256 amountB) external",
  "function addOneSidedLiquidity(address token, uint256 amount) external",
  "function rebalanceTo5050() external",
  "function removeLiquidity(uint256 amount) external",
  "function withdrawAllLiquidity(address recipient) external",
  "function resetUserTracking(address user) external",
  "function getUserLiquidity(address user) external view returns (uint256 amountA, uint256 amountB)",
  "function userLiquidityA(address) external view returns (uint256)",
  "function userLiquidityB(address) external view returns (uint256)",
  "function swap(address tokenIn, uint256 amountIn) external returns (uint256)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256)",
  "function getReserves() external view returns (uint256, uint256)",
  "function getExchangeRate() external view returns (uint256)",
  "function tokenA() external view returns (address)",
  "function tokenB() external view returns (address)",
  "function owner() external view returns (address)",
  "event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB)",
  "event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB)",
  "event Swap(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)",
] as const

export const STABLECOIN_SWAP_ABI = [
  "function swapDirect(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256)",
  "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)",
  "function getBestQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 bestAmount, address bestPool)",
  "function registerPool(address pool, address tokenA, address tokenB) external",
  "function pools(address, address) external view returns (address)",
  "function owner() external view returns (address)",
  "function registerPool(address pool, address tokenA, address tokenB) external",
  "function pools(address, address) external view returns (address)",
  "event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)",
] as const

export const PAYMENT_ROUTER_ABI = [
  "function createPayment(address recipient, address token, uint256 amount, string memory paymentId) external returns (bytes32)",
  "function executePayment(bytes32 paymentHash) external",
  "function cancelPayment(bytes32 paymentHash) external",
  "function getPayment(bytes32 paymentHash) external view returns (tuple(address sender, address recipient, address token, uint256 amount, uint256 fee, uint256 timestamp, bool executed, bool cancelled, string paymentId))",
  "function batchCreatePayments(address[] memory recipients, address token, uint256[] memory amounts, string[] memory paymentIds) external returns (bytes32[] memory)",
  "function batchExecutePayments(bytes32[] memory paymentHashes) external",
  "event PaymentCreated(bytes32 indexed paymentHash, address indexed sender, address indexed recipient, address token, uint256 amount, string paymentId)",
  "event PaymentExecuted(bytes32 indexed paymentHash)",
  "event PaymentCancelled(bytes32 indexed paymentHash)",
] as const

export const DELIVERY_VS_PAYMENT_ABI = [
  "function createSettlement(address seller, address assetToken, address paymentToken, uint256 assetAmount, uint256 paymentAmount, uint256 deadline) external returns (bytes32)",
  "function executeSettlement(bytes32 settlementId) external",
  "function cancelSettlement(bytes32 settlementId) external",
  "function getSettlement(bytes32 settlementId) external view returns (tuple(address buyer, address seller, address assetToken, address paymentToken, uint256 assetAmount, uint256 paymentAmount, uint256 deadline, bool executed, bool cancelled))",
  "event SettlementCreated(bytes32 indexed settlementId, address indexed buyer, address indexed seller, address assetToken, address paymentToken, uint256 assetAmount, uint256 paymentAmount)",
  "event SettlementExecuted(bytes32 indexed settlementId)",
] as const

export const SETTLEMENT_ENGINE_ABI = [
  "function createBatch(bytes32[] memory settlementIds, uint256 deadline) external returns (bytes32)",
  "function executeBatch(bytes32 batchId) external",
  "function settleRealTime(address buyer, address seller, address assetToken, address paymentToken, uint256 assetAmount, uint256 paymentAmount) external",
  "function getBatch(bytes32 batchId) external view returns (tuple(bytes32[] settlementIds, uint256 deadline, bool executed))",
  "event BatchCreated(bytes32 indexed batchId, uint256 settlementCount)",
  "event BatchExecuted(bytes32 indexed batchId)",
] as const

export const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const

