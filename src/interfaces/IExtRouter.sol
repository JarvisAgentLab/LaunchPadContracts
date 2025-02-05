// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IExtRouter {
    function quoteAddLiquidity(
        uint8,
        address[] memory,
        uint256[] memory _amountDesireds
    ) external view returns (uint256[] memory _amountIn, uint256 liquidity);

    function addLiquidity(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external returns (uint256[] memory _amounts, uint256 _liquidity);

    function getReserves(
        address[] calldata _tokens
    ) external view returns (uint256 _reserveA, uint256 _reserveB);

    function pairFor(
        address[] memory tokens,
        uint8
    ) external view returns (address pair, bool hasPair);

    function factory() external view returns (address);
}
