// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { OFTERC20AdapterUpgradeable } from "./OFTERC20AdapterUpgradeable.sol";

import { IINT } from "../interfaces/IINT.sol";

/**
 * @title int OFT Adapter Contract
 * @dev This contract serves as an adapter for int tokens,
 *      allowing for the seamless interaction with the OFT protocol.
 *      It inherits from OFTERC20AdapterUpgradeable to leverage its functionality.
 */
contract INTOFTAdapter is OFTERC20AdapterUpgradeable {
    constructor(
        address _token,
        address _lzEndpoint
    ) OFTERC20AdapterUpgradeable(_token, _lzEndpoint) {}

    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    )
        internal
        virtual
        override
        whenNotPaused
        returns (uint256 amountSentLD, uint256 amountReceivedLD)
    {
        // Calculate the actual amounts to be sent and received based on the input parameters
        (amountSentLD, amountReceivedLD) = _debitView(
            _amountLD,
            _minAmountLD,
            _dstEid
        );

        // Perform outbound token transfer from the sender to this contract
        IINT(address(token_)).burn(_from, amountSentLD);

        // Return the actual amounts sent and received
        return (amountSentLD, amountReceivedLD);
    }

    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 /*_srcEid*/
    )
        internal
        virtual
        override
        whenNotPaused
        returns (uint256 amountReceivedLD)
    {
        // Finalize the inbound transfer of shares and unlock the tokens for the recipient
        IINT(address(token_)).mint(_to, _amountLD);

        // Return the actual amount of tokens received, assuming a lossless transfer
        return _amountLD;
    }
}
