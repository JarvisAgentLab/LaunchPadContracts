// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

import "@uniswap/lib/contracts/libraries/FixedPoint.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";
import "@uniswap/v2-periphery/contracts/libraries/SafeMath.sol";

contract UniV2TWAP {
    using SafeMath for *;
    using FixedPoint for *;

    /// @dev Default duration for TWAP calculation (1 days)
    uint256 internal constant DEFAULT_DURATION = 1 days;

    address public immutable asset; // INT Token
    address public immutable pairToken; // USDC
    address public pair;
    bool public isToken0;
    uint256 public immutable periodSize;
    uint256 public immutable priceFactor;

    uint256 public twapLength;

    /// @dev Struct to store TWAP data points
    struct Twap {
        uint256 timestamp;
        uint256 priceCumulative;
    }
    mapping(uint256 => Twap) public twap;

    event AssetTwapUpdated(
        uint256 indexed twapId,
        uint256 timestamp,
        uint256 priceCumulative
    );

    constructor(address _asset, address _pair) public {
        address _token0 = IUniswapV2Pair(_pair).token0();
        address _token1 = IUniswapV2Pair(_pair).token1();
        bool _isToken0 = _token0 == _asset;
        address _pairToken = _isToken0 ? _token1 : _token0;

        require(_isToken0 || _token1 == _asset, "asset is not in the pair");

        asset = _asset;
        isToken0 = _isToken0;
        pair = _pair;
        pairToken = _pairToken;
        periodSize = DEFAULT_DURATION;

        priceFactor =
            10 ** (36.sub(uint256(IUniswapV2Pair(_pairToken).decimals())));

        _refreshAssetTwap();
    }

    /**
     * @dev Internal function to refresh the TWAP data for an asset
     */
    function _refreshAssetTwap() internal virtual {
        (
            uint256 _price0Cumulative,
            uint256 _price1Cumulative,

        ) = UniswapV2OracleLibrary.currentCumulativePrices(pair);

        twapLength = 0;
        _updateAssetTwap(
            isToken0 ? _price0Cumulative : _price1Cumulative,
            block.timestamp
        );
    }

    /**
     * @dev Internal function to update the TWAP data for an asset
     * @param _priceCumulativeEnd The cumulative price at the end of the period
     * @param _timestamp The timestamp at the end of the period
     */
    function _updateAssetTwap(
        uint256 _priceCumulativeEnd,
        uint256 _timestamp
    ) internal virtual {
        uint256 _twapId = twapLength++;
        twap[_twapId].priceCumulative = _priceCumulativeEnd;
        twap[_twapId].timestamp = _timestamp;

        emit AssetTwapUpdated(_twapId, _timestamp, _priceCumulativeEnd);
    }

    /**
     * @dev Internal function to get the price of an asset.
     * @return The price of the asset.
     */
    function _getAssetPrice() internal virtual returns (uint256) {
        (
            uint256 _price0Cumulative,
            uint256 _price1Cumulative,

        ) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
        uint256 _priceCumulativeEnd = isToken0
            ? _price0Cumulative
            : _price1Cumulative;

        uint256 _timestamp = block.timestamp;
        (
            uint256 _priceCumulativeStart,
            uint256 _timeElapsed,
            bool _isUpdate
        ) = _getTwapDataByTimestamp(_timestamp);

        // If an update is needed, update the asset's TWAP.
        if (_isUpdate) {
            _updateAssetTwap(_priceCumulativeEnd, _timestamp);
        }

        if (_timeElapsed == 0) return 0;

        FixedPoint.uq112x112 memory _priceAverage = FixedPoint.uq112x112(
            uint224(
                _priceCumulativeEnd.sub(_priceCumulativeStart) / _timeElapsed
            )
        );

        return _priceAverage.mul(priceFactor).decode144();
    }

    /**
     * @dev Retrieves the TWAP (Time-Weighted Average Price) data for a given asset at a specific timestamp.
     * @param _timestamp The timestamp for which the TWAP data is being retrieved.
     * @return _priceCumulativeStart The cumulative price at the start of the TWAP period.
     * @return _timeElapsed The time elapsed since the last TWAP update.
     * @return _isUpdate A boolean indicating whether the TWAP should be updated based on the elapsed time.
     */
    function _getTwapDataByTimestamp(
        uint256 _timestamp
    )
        internal
        view
        returns (
            uint256 _priceCumulativeStart,
            uint256 _timeElapsed,
            bool _isUpdate
        )
    {
        uint256 _twapId = twapLength.sub(1);

        _timeElapsed = _timestamp.sub(twap[_twapId].timestamp);
        _isUpdate = _timeElapsed >= periodSize;

        // If the time elapsed is less than half the TWAP duration, check the previous TWAP entry.
        if (_twapId > 0 && _timeElapsed < periodSize / 2) {
            _twapId--;
            _timeElapsed = _timestamp.sub(twap[_twapId].timestamp);
        }
        _priceCumulativeStart = twap[_twapId].priceCumulative;
    }

    /**
     * @dev Get asset price.
     * @return Asset price.
     */
    function getAssetPrice() external returns (uint256) {
        return _getAssetPrice();
    }
}
