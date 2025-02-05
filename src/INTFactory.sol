// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./INTPair.sol";

contract INTFactory is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    mapping(address => mapping(address => address)) private _pair;

    address[] public pairs;

    address public router;

    address public treasury;
    uint256 public buyFee;
    uint256 public sellFee;
    uint256 public treasuryFeeRatio; // 1 => 1%

    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event BuyFeeUpdated(uint256 oldFee, uint256 newFee);
    event SellFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryFeeRatioUpdated(uint256 oldRatio, uint256 newRatio);

    event PairCreated(
        address indexed tokenA,
        address indexed tokenB,
        address pair,
        uint256 totalPairs
    );

    error TokenIsZeroAddress();
    error BuyFeeTooHigh();
    error SellFeeTooHigh();
    error TreasuryIsZeroAddress();
    error TreasuryFeeRatioTooHigh();
    error SameTreasuryFeeRatio();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address treasury_,
        uint256 buyFee_,
        uint256 sellFee_,
        uint256 treasuryFeeRatio_
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (buyFee_ > 100) revert BuyFeeTooHigh();
        if (sellFee_ > 100) revert SellFeeTooHigh();
        if (treasuryFeeRatio_ > 100) revert TreasuryFeeRatioTooHigh();

        treasury = treasury_;
        buyFee = buyFee_;
        sellFee = sellFee_;
        treasuryFeeRatio = treasuryFeeRatio_;
    }

    function _createPair(
        address tokenA,
        address tokenB
    ) internal returns (address) {
        if (tokenA == address(0)) revert TokenIsZeroAddress();
        if (tokenB == address(0)) revert TokenIsZeroAddress();

        INTPair pair_ = new INTPair(address(this), tokenA, tokenB);

        _pair[tokenA][tokenB] = address(pair_);
        _pair[tokenB][tokenA] = address(pair_);

        pairs.push(address(pair_));

        uint256 totalPairs = pairs.length;

        emit PairCreated(tokenA, tokenB, address(pair_), totalPairs);

        return address(pair_);
    }

    function createPair(
        address tokenA,
        address tokenB
    ) external onlyRole(CREATOR_ROLE) nonReentrant returns (address) {
        address pair = _createPair(tokenA, tokenB);

        return pair;
    }

    function getPair(
        address tokenA,
        address tokenB
    ) public view returns (address) {
        return _pair[tokenA][tokenB];
    }

    function allPairsLength() public view returns (uint256) {
        return pairs.length;
    }

    function setFeeParams(
        address newTreasury,
        uint256 newBuyFee,
        uint256 newSellFee,
        uint256 newTreasuryFeeRatio
    ) public onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert TreasuryIsZeroAddress();
        if (newBuyFee > 100) revert BuyFeeTooHigh();
        if (newSellFee > 100) revert SellFeeTooHigh();
        if (newTreasuryFeeRatio > 100) revert TreasuryFeeRatioTooHigh();

        emit TreasuryUpdated(treasury, newTreasury);
        emit BuyFeeUpdated(buyFee, newBuyFee);
        emit SellFeeUpdated(sellFee, newSellFee);
        emit TreasuryFeeRatioUpdated(treasuryFeeRatio, newTreasuryFeeRatio);

        treasury = newTreasury;
        buyFee = newBuyFee;
        sellFee = newSellFee;
        treasuryFeeRatio = newTreasuryFeeRatio;
    }

    function setRouter(address router_) public onlyRole(ADMIN_ROLE) {
        router = router_;
    }
}
