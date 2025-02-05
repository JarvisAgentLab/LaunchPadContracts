// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../INTFactory.sol";
import "../interfaces/IINTPair.sol";
import "../interfaces/IBonding.sol";
import "../interfaces/ILock.sol";

library INTRouterLibrary {
    using SafeERC20 for IERC20;

    error TokenIsZeroAddress();
    error RecipientIsZeroAddress();
    error InputAmountIsZero();
    error FactoryIsZeroAddress();
    error AssetTokenIsZeroAddress();

    event Buy(
        address indexed account,
        address indexed token,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 assetFee,
        uint256 tokenReserve,
        uint256 assetReserve,
        uint256 timestamp
    );
    event Sell(
        address indexed account,
        address indexed token,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 assetFee,
        uint256 tokenReserve,
        uint256 assetReserve,
        uint256 timestamp
    );

    event InitialLiquidityAdded(
        address indexed token,
        uint256 tokenReserve,
        uint256 assetReserve
    );

    function _getReserves(
        INTFactory factory,
        address assetToken,
        address token
    ) internal view returns (uint256 reserveA, uint256 reserveB, uint256 k) {
        address pairAddress = factory.getPair(token, assetToken);
        IINTPair pair = IINTPair(pairAddress);
        (reserveA, reserveB) = pair.getReserves();
        k = pair.kLast();
    }

    function quoteBuy(
        INTFactory factory,
        address assetToken,
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut, uint256 txFee) {
        if (token == address(0)) revert TokenIsZeroAddress();

        (uint256 reserveA, uint256 reserveB, uint256 k) = _getReserves(
            factory,
            assetToken,
            token
        );

        uint256 fee = factory.buyFee();
        txFee = (fee * amountIn) / 100;
        amountIn = amountIn - txFee;

        uint256 newReserveB = reserveB + amountIn;
        uint256 newReserveA = k / newReserveB;
        amountOut = reserveA - newReserveA;
    }

    function quoteSell(
        INTFactory factory,
        address assetToken,
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut, uint256 txFee) {
        if (token == address(0)) revert TokenIsZeroAddress();

        (uint256 reserveA, uint256 reserveB, uint256 k) = _getReserves(
            factory,
            assetToken,
            token
        );

        uint256 newReserveA = reserveA + amountIn;
        uint256 newReserveB = k / newReserveA;
        amountOut = reserveB - newReserveB;

        uint256 fee = factory.sellFee();
        txFee = (fee * amountOut) / 100;
        amountOut = amountOut - txFee;
    }

    function addInitialLiquidity(
        INTFactory factory,
        address assetToken,
        address token_,
        uint256 amountToken_,
        uint256 amountAsset_
    ) public returns (uint256, uint256) {
        if (token_ == address(0)) revert TokenIsZeroAddress();

        address pairAddress = factory.getPair(token_, assetToken);

        IINTPair pair = IINTPair(pairAddress);

        IERC20 token = IERC20(token_);

        token.safeTransfer(pairAddress, amountToken_);

        pair.mint(amountToken_, amountAsset_);

        emit InitialLiquidityAdded(token_, amountToken_, amountAsset_);

        return (amountToken_, amountAsset_);
    }

    /**
     * @dev Distribute fee to treasury and lock contract based on the `treasuryFeeRatio`
     * @param from The address that buying the token, address(0) if selling
     * @param pair The pair contract When selling
     * @param fromToken The token that is being traded
     * @param amount The amount of token that is being traded
     */
    function collectFee(
        INTFactory factory,
        address assetToken,
        address from,
        address pair,
        address fromToken,
        uint256 amount
    ) internal {
        uint256 treasuryFeeRatio = factory.treasuryFeeRatio();
        uint256 treasuryFee = (amount * treasuryFeeRatio) / 100;
        address treasury = factory.treasury();

        uint256 lockFee = amount - treasuryFee;
        address lockFeeTo = IBonding(address(this)).getTokenLocker(fromToken);

        if (from == address(0)) {
            // Selling
            // Transfer treasury fee to treasury directly
            IINTPair(pair).transferAsset(treasury, treasuryFee);

            // Transfer lock fee to this contract
            IINTPair(pair).transferAsset(address(this), lockFee);
        } else {
            // Buying
            // Transfer treasury fee to treasury directly
            IERC20(assetToken).safeTransferFrom(from, treasury, treasuryFee);

            // Transfer lock fee to this contract
            IERC20(assetToken).safeTransferFrom(from, address(this), lockFee);
        }

        // Approve to lock contract to deposit lock fee
        IERC20(assetToken).forceApprove(lockFeeTo, lockFee);
        // Deposit lock fee to lock contract
        ILock(lockFeeTo).depositFee(lockFee);
    }

    function sell(
        INTFactory factory,
        address assetToken,
        uint256 amountIn,
        address tokenAddress,
        address to
    ) public returns (uint256, uint256) {
        if (tokenAddress == address(0)) revert TokenIsZeroAddress();
        if (to == address(0)) revert RecipientIsZeroAddress();
        if (amountIn == 0) revert InputAmountIsZero();

        address pairAddress = factory.getPair(tokenAddress, assetToken);

        IINTPair pair = IINTPair(pairAddress);

        IERC20 token = IERC20(tokenAddress);

        (uint256 amountOut, uint256 txFee) = quoteSell(
            factory,
            assetToken,
            tokenAddress,
            amountIn
        );

        token.safeTransferFrom(msg.sender, pairAddress, amountIn);

        pair.transferAsset(to, amountOut);
        collectFee(
            factory,
            assetToken,
            address(0),
            address(pair),
            tokenAddress,
            txFee
        );

        pair.swap(amountIn, 0, 0, amountOut + txFee);

        (uint256 reserveA, uint256 reserveB) = IINTPair(pair).getReserves();

        emit Sell(
            to,
            tokenAddress,
            amountIn,
            amountOut,
            txFee,
            reserveA,
            reserveB,
            block.timestamp
        );

        return (amountIn, amountOut);
    }

    function buy(
        INTFactory factory,
        address assetToken,
        uint256 amountIn,
        address tokenAddress,
        address to
    ) public returns (uint256, uint256) {
        if (tokenAddress == address(0)) revert TokenIsZeroAddress();
        if (to == address(0)) revert RecipientIsZeroAddress();
        if (amountIn == 0) revert InputAmountIsZero();

        address pair = factory.getPair(tokenAddress, assetToken);

        (uint256 amountOut, uint256 txFee) = quoteBuy(
            factory,
            assetToken,
            tokenAddress,
            amountIn
        );
        uint256 amount = amountIn - txFee;

        IERC20(assetToken).safeTransferFrom(msg.sender, pair, amount);

        collectFee(
            factory,
            assetToken,
            msg.sender,
            address(0),
            tokenAddress,
            txFee
        );

        IINTPair(pair).transferTo(to, amountOut);

        IINTPair(pair).swap(0, amountOut, amount, 0);

        (uint256 reserveA, uint256 reserveB) = IINTPair(pair).getReserves();

        emit Buy(
            to,
            tokenAddress,
            amountOut,
            amount,
            txFee,
            reserveA,
            reserveB,
            block.timestamp
        );

        return (amountIn, amountOut);
    }

    function graduate(
        INTFactory factory,
        address assetToken,
        address tokenAddress
    ) public {
        if (tokenAddress == address(0)) revert TokenIsZeroAddress();
        address pair = factory.getPair(tokenAddress, assetToken);
        uint256 assetBalance = IINTPair(pair).assetBalance();
        uint256 balance = IINTPair(pair).balance();
        INTPair(pair).transferAsset(address(this), assetBalance);
        INTPair(pair).transferTo(address(this), balance);
    }
}
