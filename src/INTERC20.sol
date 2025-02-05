// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract INTERC20 is ERC20Permit, Ownable {
    bool public transferDisabled;

    // account => exclude
    mapping(address => bool) public isExcluded;

    event ExcludeAccount(address account);
    event EnableTransfer();

    error TransferDisabled();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address initialOwner_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        _transferOwnership(initialOwner_);
        _mint(initialOwner_, supply_);

        transferDisabled = true;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        if (transferDisabled) {
            if (!isExcluded[from] && !isExcluded[to]) revert TransferDisabled();
        }
    }

    /**
     * @dev Exclude account from transfer limit
     * @param account The account to exclude
     */
    function excludeAccount(address account) external onlyOwner {
        isExcluded[account] = true;

        emit ExcludeAccount(account);
    }

    /**
     * @notice Only owner can call this function
     * @dev Enable transferring tokens without any limit
     */
    function enableTransfer() external onlyOwner {
        transferDisabled = false;

        emit EnableTransfer();
    }
}
