// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

contract L2INT is
    Initializable,
    AccessControlUpgradeable,
    Ownable2StepUpgradeable,
    ERC20Upgradeable
{
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    uint256 public mintCap;

    event NewMintCap(uint256 oldMintCap, uint256 newMintCap);

    error SameMintCap();
    error ExceedMintCap();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _mintCap) public virtual initializer {
        __AccessControl_init();
        __ERC20_init("InteNet Protocol", "INT");
        __Ownable_init();

        mintCap = _mintCap;
    }

    /**
     * @dev Set the mint cap
     * @param _newMintCap New mint cap value
     */
    function _setMintCap(uint256 _newMintCap) external onlyOwner {
        uint256 oldMintCap = mintCap;
        if (_newMintCap == oldMintCap) revert SameMintCap();

        mintCap = _newMintCap;
        emit NewMintCap(oldMintCap, _newMintCap);
    }

    function mint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        if (totalSupply() + amount > mintCap) revert ExceedMintCap();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }

    /**
     * @dev Internal function to transfer ownership along with the DEFAULT_ADMIN_ROLE
     */
    function _transferOwnership(address newOwner) internal virtual override {
        _revokeRole(DEFAULT_ADMIN_ROLE, owner());
        super._transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
    }
}
