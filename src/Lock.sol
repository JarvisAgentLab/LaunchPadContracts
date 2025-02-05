// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBonding } from "./interfaces/IBonding.sol";
import { ILock } from "./interfaces/ILock.sol";

/**
 * @title Lock Contract
 * @notice The contract is created by bonding contract when the meme token generated.
 * @dev The contract is used for bonding contract to lock/delegate lp token,
 *      and claim rewards for the token creator after the token graduates.
 */
contract Lock is ILock {
    using SafeERC20 for IERC20;

    uint256 public immutable lockedTime;

    // The meme token of this lock.
    address public immutable token;

    address public immutable assetToken;

    // The bonding contract.
    address public immutable bonding;

    // The trading fee during the bonding period.
    uint256 public tradingFeeAtBonding;

    // The address of the LP token to lock.
    address public lp;

    struct LockedInfo {
        uint256 lockedAmount;
        uint256 releasedTime;
    }

    mapping(address => LockedInfo) public lockedInfos;

    event SetLP(address newLpAddr);
    event LockedLP(uint256 newLockedAmount);
    event DepositFee(uint256 newDepositedAmount);
    event ClaimForTokenCreator(address indexed tokenCreator, uint256 amount);
    event DelegateLPTo(
        address indexed lpAddr,
        address indexed to,
        uint256 amount
    );

    constructor(
        address _token,
        address _assetToken,
        address _bonding,
        uint256 _lockedTime
    ) {
        token = _token;
        assetToken = _assetToken;
        bonding = _bonding;
        lockedTime = _lockedTime;
    }

    modifier onlyBonding() {
        if (msg.sender != bonding) revert NotBonding();
        _;
    }

    /**
     * @notice Should be called only once.
     * @notice Only Bonding contract can call this function.
     * @dev Set the LP token address.
     * @param _lp The address of the LP token to lock.
     */
    function setLP(address _lp) external onlyBonding {
        lp = _lp;

        emit SetLP(_lp);
    }

    /**
     * @notice Only Bonding contract can call this function.
     * @dev Locks the specified amount of lp tokens.
     * @param lockedAmount The amount of lp tokens to lock.
     */
    function lockLP(uint256 lockedAmount) external onlyBonding {
        address lpAddr = lp;
        LockedInfo storage lockedInfo = lockedInfos[lpAddr];

        lockedInfo.lockedAmount = lockedInfo.lockedAmount + lockedAmount;
        lockedInfo.releasedTime = block.timestamp + lockedTime;

        IERC20(lpAddr).safeTransferFrom(
            msg.sender,
            address(this),
            lockedAmount
        );

        emit LockedLP(lockedAmount);
    }

    /**
     * @notice Only Bonding contract can call this function.
     * @notice Only can be called after the released time.
     * @dev Delegates the LP token to the specified address.
     * @param delegatee The address to delegate the LP token to.
     */
    function delegateLPTo(address delegatee) external onlyBonding {
        address lpAddr = lp;
        LockedInfo storage lockedInfo = lockedInfos[lpAddr];

        if (block.timestamp < lockedInfo.releasedTime) revert NotReleased();

        IERC20(lpAddr).forceApprove(delegatee, lockedInfo.lockedAmount);

        emit DelegateLPTo(lpAddr, delegatee, lockedInfo.lockedAmount);
    }

    /**
     * @notice Before the token graduates, charge a portion of the trading fee when buying and selling.
     *         The entire fee can be distributed to the token creator after the token graduates.
     * @notice Ideally, the `Bonding` contract will use this function to store fee when trading.
     * @dev Deposit the trading fee to the lock contract.
     * @param amount The amount of trading fee to deposit.
     */
    function depositFee(uint256 amount) external {
        tradingFeeAtBonding = tradingFeeAtBonding + amount;

        IERC20(assetToken).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositFee(amount);
    }

    /**
     * @notice Should be called only once.
     * @notice Should be called after the token graduates.
     * @dev Claim the rewards for the token creator
     */
    function claimForTokenCreator() external {
        if (!IBonding(bonding).hasGraduated(token))
            revert TokenDoesNotGraduate();

        address tokenCreator = IBonding(bonding).getTokenCreator(token);

        // Distribute rewards to the token creator.
        uint256 amount = tradingFeeAtBonding;
        tradingFeeAtBonding = 0;
        IERC20(assetToken).safeTransfer(tokenCreator, amount);

        emit ClaimForTokenCreator(tokenCreator, amount);
    }

    /**
     * @notice Only Bonding contract can call this function.
     * @dev Approves token spending for a specified address
     * @param spender The address allowed to spend the token
     * @param amount The amount of tokens to approve
     */
    function approveToken(
        address _token,
        address spender,
        uint256 amount
    ) external onlyBonding {
        IERC20(_token).forceApprove(spender, amount);
    }
}
