// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TokenizedAsset
 * @notice Represents tokenized securities, funds, or structured products
 * @dev ERC20 token with additional compliance and transfer restrictions
 */
contract TokenizedAsset is ERC20, Ownable, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant TRANSFER_AGENT_ROLE = keccak256("TRANSFER_AGENT_ROLE");

    struct AssetInfo {
        string assetType; // "SECURITY", "FUND", "STRUCTURED_PRODUCT"
        string symbol;
        string name;
        uint256 totalSupply;
        bool transferable;
        bool whitelistEnabled;
    }

    AssetInfo public assetInfo;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;

    event AssetIssued(address indexed to, uint256 amount, string assetType);
    event WhitelistUpdated(address indexed account, bool status);
    event BlacklistUpdated(address indexed account, bool status);
    event TransferabilityUpdated(bool status);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _assetType,
        address _owner
    ) ERC20(_name, _symbol) Ownable(_owner) {
        assetInfo = AssetInfo({
            assetType: _assetType,
            symbol: _symbol,
            name: _name,
            totalSupply: 0,
            transferable: true,
            whitelistEnabled: false
        });
        
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(ISSUER_ROLE, _owner);
    }

    /**
     * @notice Issue new tokens (only by issuer)
     */
    function issue(address to, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
        assetInfo.totalSupply += amount;
        emit AssetIssued(to, amount, assetInfo.assetType);
    }

    /**
     * @notice Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        assetInfo.totalSupply -= amount;
    }

    /**
     * @notice Override transfer with compliance checks
     */
    function _update(address from, address to, uint256 value) internal override {
        require(!blacklist[from] && !blacklist[to], "Address blacklisted");
        
        if (assetInfo.whitelistEnabled) {
            require(whitelist[from] || from == address(0), "Sender not whitelisted");
            require(whitelist[to] || to == address(0), "Recipient not whitelisted");
        }
        
        require(assetInfo.transferable || from == address(0) || to == address(0), "Transfers disabled");
        
        super._update(from, to, value);
    }

    /**
     * @notice Update whitelist status
     */
    function updateWhitelist(address account, bool status) external onlyRole(TRANSFER_AGENT_ROLE) {
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /**
     * @notice Update blacklist status
     */
    function updateBlacklist(address account, bool status) external onlyRole(TRANSFER_AGENT_ROLE) {
        blacklist[account] = status;
        emit BlacklistUpdated(account, status);
    }

    /**
     * @notice Enable/disable transfers
     */
    function setTransferable(bool _transferable) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetInfo.transferable = _transferable;
        emit TransferabilityUpdated(_transferable);
    }

    /**
     * @notice Enable/disable whitelist
     */
    function setWhitelistEnabled(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetInfo.whitelistEnabled = _enabled;
    }
}


