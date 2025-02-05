// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IINTPair.sol";
import "./INTFactory.sol";

contract INTPair is IINTPair, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable tokenA; // meme token
    address public immutable tokenB;

    struct Pool {
        uint256 reserve0;
        uint256 reserve1;
        uint256 k;
        uint256 lastUpdated;
    }

    Pool private _pool;

    modifier onlyRouter() {
        if (msg.sender != INTFactory(factory).router()) revert CallerIsNotRouter();
        _;
    }

    event Mint(uint256 reserve0, uint256 reserve1);

    event Swap(
        uint256 amount0In,
        uint256 amount0Out,
        uint256 amount1In,
        uint256 amount1Out
    );

    error FactoryIsZeroAddress();
    error TokenIsZeroAddress();
    error CallerIsNotRouter();
    error AlreadyMinted();
    error RecipientIsZeroAddress();

    constructor(address factory_, address token0, address token1) {
        if (factory_ == address(0)) revert FactoryIsZeroAddress();
        if (token0 == address(0)) revert TokenIsZeroAddress();
        if (token1 == address(0)) revert TokenIsZeroAddress();

        factory = factory_;
        tokenA = token0;
        tokenB = token1;
    }

    function mint(
        uint256 reserve0,
        uint256 reserve1
    ) public onlyRouter returns (bool) {
        if (_pool.lastUpdated != 0) revert AlreadyMinted();

        _pool = Pool({
            reserve0: reserve0,
            reserve1: reserve1,
            k: reserve0 * reserve1,
            lastUpdated: block.timestamp
        });

        emit Mint(reserve0, reserve1);

        return true;
    }

    function swap(
        uint256 amount0In,
        uint256 amount0Out,
        uint256 amount1In,
        uint256 amount1Out
    ) public onlyRouter returns (bool) {
        uint256 _reserve0 = (_pool.reserve0 + amount0In) - amount0Out;
        uint256 _reserve1 = (_pool.reserve1 + amount1In) - amount1Out;

        _pool = Pool({
            reserve0: _reserve0,
            reserve1: _reserve1,
            k: _pool.k,
            lastUpdated: block.timestamp
        });

        emit Swap(amount0In, amount0Out, amount1In, amount1Out);

        return true;
    }

    function approval(
        address _user,
        address _token,
        uint256 amount
    ) public onlyRouter returns (bool) {
        if (_user == address(0)) revert RecipientIsZeroAddress();
        if (_token == address(0)) revert TokenIsZeroAddress();

        IERC20 token = IERC20(_token);

        token.forceApprove(_user, amount);

        return true;
    }

    function transferAsset(
        address recipient,
        uint256 amount
    ) public onlyRouter {
        if (recipient == address(0)) revert RecipientIsZeroAddress();

        IERC20(tokenB).safeTransfer(recipient, amount);
    }

    function transferTo(address recipient, uint256 amount) public onlyRouter {
        if (recipient == address(0)) revert RecipientIsZeroAddress();

        IERC20(tokenA).safeTransfer(recipient, amount);
    }

    function getReserves() public view returns (uint256, uint256) {
        return (_pool.reserve0, _pool.reserve1);
    }

    function kLast() public view returns (uint256) {
        return _pool.k;
    }

    function priceALast() public view returns (uint256) {
        return _pool.reserve1 / _pool.reserve0;
    }

    function priceBLast() public view returns (uint256) {
        return _pool.reserve0 / _pool.reserve1;
    }

    function balance() public view returns (uint256) {
        return IERC20(tokenA).balanceOf(address(this));
    }

    function assetBalance() public view returns (uint256) {
        return IERC20(tokenB).balanceOf(address(this));
    }
}
