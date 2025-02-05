// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./INTERC20.sol";

contract INTERC20Factory {
    /**
     * @notice Creates a new INTERC20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param totalSupply Initial total supply
     * @param initialOwner Initial Owner
     * @return token The address of the new token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address initialOwner
    ) external returns (address token) {
        token = address(new INTERC20(name, symbol, totalSupply, initialOwner));
    }
}
