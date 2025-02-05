// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Bonding.sol";

contract TokenDataReader {
    Bonding public immutable bonding;

    struct Token {
        address creator;
        address token;
        address pair;
        address locker;
        string description;
        string image;
        string twitter;
        string telegram;
        string farcaster;
        string website;
        Bonding.TokenStatus status;
        string name;
        string ticker;
        uint256 supply;
    }

    constructor(address _bonding) {
        bonding = Bonding(_bonding);
    }

    /**
     * @notice Get token data for a range of tokens
     * @param start The starting index in tokenInfos array
     * @param size The number of tokens to return
     * @return infos Array of Token structs containing token info
     */
    function getTokenData(
        uint256 start,
        uint256 size
    ) external view returns (Token[] memory infos) {
        uint256 length = bonding.getTokenCount();

        if (start >= length) {
            size = 0;
        } else if (start + size > length) {
            size = length - start;
        }

        infos = new Token[](size);

        for (uint256 i = 0; i < size; ) {
            address tokenAddr = bonding.tokenInfos(start + i);
            Token memory info = infos[i];

            // Get token info from Bonding contract
            (
                info.creator,
                info.token,
                info.pair,
                info.locker,
                info.description,
                info.image,
                info.twitter,
                info.telegram,
                info.farcaster,
                info.website,
                info.status
            ) = bonding.tokenInfo(tokenAddr);

            // Get ERC20 info
            ERC20 token = ERC20(tokenAddr);
            info.name = token.name();
            info.ticker = token.symbol();
            info.supply = token.totalSupply();

            unchecked {
                ++i;
            }
        }
    }
}
