// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IBonding {
    enum TokenStatus {
        None,
        BondingCurve,
        Graduated
    }

    struct Token {
        address creator;
        address token;
        address pair;
        address locker;
        string description;
        uint8[] cores;
        string image;
        string twitter;
        string telegram;
        string farcaster;
        string website;
        bool trading;
        bool tradingOnUniswap;
    }

    function tokenInfo(address token) external view returns (Token memory);

    function getTokenLocker(
        address tokenAddress
    ) external view returns (address);

    function getTokenCreator(
        address tokenAddress
    ) external view returns (address);

    function hasGraduated(address tokenAddress) external view returns (bool);
}
