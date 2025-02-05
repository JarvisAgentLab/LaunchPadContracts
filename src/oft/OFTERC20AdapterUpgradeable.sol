// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { OFTERC20Adapter } from "./OFTERC20Adapter.sol";

/**
 * @title OFT ERC20 Adapter Contract
 * @dev This contract adapts a standard ERC20 token for use with LayerZero's cross-chain functionality,
 * inheriting from Ownable2Step, AccessControl, Pausable, and OFTCore.
 */

/**
 * @dev This contract is an upgradeable version of the OFTERC20Adapter contract,
 * allowing for initialization and ownership transfer.
 */
contract OFTERC20AdapterUpgradeable is Initializable, OFTERC20Adapter {
    /**
     * @dev Constructor function to initialize the contract with a token and LayerZero endpoint.
     * @param _token The address of the ERC20 token to be adapted.
     * @param _lzEndpoint The address of the LayerZero endpoint for cross-chain communication.
     */
    constructor(
        address _token,
        address _lzEndpoint
    ) OFTERC20Adapter(_token, _lzEndpoint) {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract by transferring ownership and setting the delegate.
     * @param _token The address of the ERC20 token to be adapted.
     */
    function initialize(address _token) public initializer {
        // Transfer ownership to the caller of this function.
        _transferOwnership(msg.sender);
        // Set the delegate to the caller of this function.
        setDelegate(msg.sender);
        // Initialize the token.
        __OFTERC20Adapter_init(_token);
    }
}
