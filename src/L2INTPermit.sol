// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { L2INT } from "./L2INT.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";

contract L2INTPermit is L2INT, ERC20PermitUpgradeable {
    function initialize(uint256 _mintCap) public override initializer {
        super.initialize(_mintCap);
        __ERC20Permit_init("InteNet Protocol");
    }

    function upgrade() external reinitializer(2) onlyOwner {
        __ERC20_init_unchained("InteNet Protocol", "INT");
        __ERC20Permit_init("InteNet Protocol");
    }
}
