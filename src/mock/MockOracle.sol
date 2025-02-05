// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract MockOracle {
    uint256 public price; // asset price in USD (with 18 decimals)

    // Set price for a token (price should be in USD with 18 decimals)
    function setAssetPrice(uint256 price_) external {
        price = price_;
    }

    // Get the USD price of a token (returns price with 8 decimals)
    function getAssetPrice() external returns (uint256) {
        return price;
    }
}
