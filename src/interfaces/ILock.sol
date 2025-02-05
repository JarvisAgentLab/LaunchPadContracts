// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ILock {
    error NotBonding();
    error LockerIsZeroAddress();
    error HasLocked();
    error TokenDoesNotGraduate();
    error NotReleased();

    function setLP(address _lp) external;

    function lockLP(uint256 lockedAmount) external;

    function delegateLPTo(address to) external;

    function depositFee(uint256 amount) external;

    function claimForTokenCreator() external;

    function approveToken(
        address _token,
        address spender,
        uint256 amount
    ) external;
}
