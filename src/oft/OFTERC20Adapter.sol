// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20Metadata, IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IOFT, OFTCore } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";

/**
 * @title OFT ERC20 Adapter Contract
 * @dev This contract adapts a standard ERC20 token for use with LayerZero's cross-chain functionality,
 * inheriting from Ownable2Step, AccessControl, Pausable, and OFTCore.
 */
contract OFTERC20Adapter is Ownable2Step, AccessControl, Pausable, OFTCore {
    using SafeERC20 for IERC20;

    bytes32 internal constant PAUSER_ROLE = keccak256("PAUSER_ROLE"); // Role identifier for pausing operations.

    IERC20 internal token_;

    event TokenInit(address token);

    /**
     * @dev Constructor for the OFTERC20Adapter contract.
     * Initializes a new instance of the OFTERC20Adapter contract by setting up the inner token and LayerZero endpoint.
     * @param _token The address of the ERC-20 token to be adapted.
     * @param _lzEndpoint The LayerZero endpoint address for cross-chain communication.
     */
    constructor(
        address _token,
        address _lzEndpoint
    ) OFTCore(IERC20Metadata(_token).decimals(), _lzEndpoint, msg.sender) {
        __OFTERC20Adapter_init(_token);
    }

    /**
     * @dev Initializes the inner token used by the contract.
     * @param _token The address of the ERC-20 token to be used as the inner token.
     * This function checks that the token has a non-zero decimal count to ensure validity.
     * It updates the state variable `token_` and emits a `TokenInit` event to signal successful initialization.
     *
     * @notice The function will revert if the token's decimal count is zero, ensuring only valid tokens are used.
     */
    function __OFTERC20Adapter_init(address _token) internal {
        require(IERC20Metadata(_token).decimals() > 0, "Invalid token_");
        token_ = IERC20(_token);
        emit TokenInit(_token);
    }

    /**
     * @dev Pauses all token transfers and other state-changing operations in the contract.
     * This function can only be called by an account with the PAUSER_ROLE.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers and state-changing operations in the contract.
     * This function can only be called by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get the address of the inner token.
     */
    function token() public view returns (address) {
        return address(token_);
    }

    /**
     * @notice Checks if approval is required to send the 'token()'.
     * @dev This function returns true if approval is required, false otherwise.
     *
     * @return A boolean indicating whether approval is required.
     */
    function approvalRequired() external pure virtual returns (bool) {
        return true;
    }

    /**
     * @notice Initiates a debit transaction.
     * @dev This function calculates the amounts to be sent and received based on the input parameters.
     * It then executes the token transfer from the sender to this contract.
     * @param _from The address from which the tokens are debited.
     * @param _amountLD The amount of tokens to be debited.
     * @param _minAmountLD The minimum amount of tokens expected to be received.
     * @param _dstEid The destination endpoint ID for the transaction.
     * @return amountSentLD The actual amount of tokens sent.
     * @return amountReceivedLD The actual amount of tokens received.
     */
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
        // Calculate the amounts to be sent and received based on input parameters.
        (amountSentLD, amountReceivedLD) = _debitView(
            _amountLD,
            _minAmountLD,
            _dstEid
        );
        // Execute the token transfer from the sender to this contract.
        token_.safeTransferFrom(_from, address(this), amountSentLD);
    }

    /**
     * @notice Initiates a credit transaction.
     * @dev This function unlocks the tokens and transfers them to the recipient address.
     * It assumes a lossless transfer unless the transfer mechanism is modified in a derived contract.
     * @param _to The address to which the tokens are credited.
     * @param _amountLD The amount of tokens to be credited.
     * @return amountReceivedLD The actual amount of tokens received.
     */
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
        // Unlock the tokens and transfer them to the recipient address.
        token_.safeTransfer(_to, _amountLD);
        // In scenarios where the transfer mechanism might be modified (e.g., in a derived contract), the actual received amount
        // could differ from _amountLD. Here, we assume a lossless transfer.
        return _amountLD;
    }

    /**
     * @dev Internal function to transfer ownership of the contract to a new owner.
     * This function overrides the _transferOwnership function in both Ownable and Ownable2Step contracts.
     * It transfers the ownership and grants the default admin role to the new owner.
     * @param _newOwner The address of the new owner to whom ownership will be transferred.
     */
    function _transferOwnership(
        address _newOwner
    ) internal virtual override(Ownable, Ownable2Step) {
        // Revoke the default admin role from the current owner
        _revokeRole(DEFAULT_ADMIN_ROLE, owner());
        // Grant the default admin role to the new owner
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        Ownable2Step._transferOwnership(_newOwner);
    }

    /**
     * @dev Public function to transfer ownership of the contract to a new owner.
     * This function overrides the transferOwnership function in both Ownable and Ownable2Step contracts.
     * @param _newOwner The address of the new owner to whom ownership will be transferred.
     */
    function transferOwnership(
        address _newOwner
    ) public virtual override(Ownable, Ownable2Step) {
        Ownable2Step.transferOwnership(_newOwner);
    }

    /**
     * @dev Checks if an account has a specific role.
     * This function overrides the hasRole function in the AccessControl contract.
     * It returns true if the account has the role or is the owner of the contract.
     * @param _role The role to be checked.
     * @param _account The account to be checked.
     * @return True if the account has the role or is the owner, false otherwise.
     */
    function hasRole(
        bytes32 _role,
        address _account
    ) public view virtual override returns (bool) {
        // Check if the account has the role or is the owner
        return super.hasRole(_role, _account) || _account == owner();
    }
}
