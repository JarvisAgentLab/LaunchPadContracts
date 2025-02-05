// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./Lock.sol";

contract LockFactory {
    /**
     * @notice Creates a new Lock for token
     * @param _token Token address
     * @param _assetToken Asset token address
     * @param _bonding Bonding address
     * @param _lockedTime The time to lock the lp token
     */
    function createLock(
        address _token,
        address _assetToken,
        address _bonding,
        uint256 _lockedTime
    ) external returns (address lock) {
        lock = address(new Lock(_token, _assetToken, _bonding, _lockedTime));
    }
}
