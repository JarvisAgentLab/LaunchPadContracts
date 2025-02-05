// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IExtRouter.sol";

contract MockExtRouter is IExtRouter {
    using SafeERC20 for IERC20;

    // Mapping to store pairs
    mapping(address => mapping(address => address)) public getPair;
    mapping(address => bool) public isPair;

    bytes32 public constant INIT_CODE_HASH =
        keccak256(abi.encodePacked(type(MockPair).creationCode));

    function quoteAddLiquidity(
        uint8,
        address[] memory,
        uint256[] memory _amountDesireds
    ) external view returns (uint256[] memory _amountIn, uint256 liquidity) {
        _amountIn = _amountDesireds;
        liquidity = sqrt(_amountDesireds[0] * _amountDesireds[1]);
    }

    function factory() external view returns (address) {
        return address(this);
    }

    function createPair(
        address[] memory _tokens,
        uint8,
        bytes memory
    ) public returns (address pair) {
        // Sort tokens to ensure consistent pair addresses
        (address token0, address token1) = _tokens[0] < _tokens[1]
            ? (_tokens[0], _tokens[1])
            : (_tokens[1], _tokens[0]);

        // Deploy new pair using create2
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        pair = address(new MockPair{ salt: salt }());
        MockPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        isPair[pair] = true;
    }

    // Create or get pair and add liquidity
    function addLiquidity(
        uint8,
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external returns (uint256[] memory _amounts, uint256 _liquidity) {
        require(block.timestamp <= _deadline, "EXPIRED");
        require(_tokens.length == 2, "INVALID_TOKENS_LENGTH");
        require(_amountDesireds.length == 2, "INVALID_AMOUNTS_LENGTH");
        require(_amountsMin.length == 2, "INVALID_MIN_AMOUNTS_LENGTH");

        // Sort tokens to ensure consistent pair addresses
        (address token0, address token1) = _tokens[0] < _tokens[1]
            ? (_tokens[0], _tokens[1])
            : (_tokens[1], _tokens[0]);

        // Get or create pair
        address pair = getPair[token0][token1];
        if (pair == address(0)) {
            pair = createPair(_tokens, 0, new bytes(0x0));
        }

        // Transfer tokens to pair
        IERC20(_tokens[0]).safeTransferFrom(
            msg.sender,
            pair,
            _amountDesireds[0]
        );
        IERC20(_tokens[1]).safeTransferFrom(
            msg.sender,
            pair,
            _amountDesireds[1]
        );

        // Check minimum amounts
        require(_amountDesireds[0] >= _amountsMin[0], "INSUFFICIENT_A_AMOUNT");
        require(_amountDesireds[1] >= _amountsMin[1], "INSUFFICIENT_B_AMOUNT");

        // Mint LP tokens
        _liquidity = MockPair(pair).mint(_to);
        require(_liquidity >= _minLiquidity, "INSUFFICIENT_LIQUIDITY");

        // Return amounts used
        _amounts = new uint256[](2);
        _amounts[0] = _amountDesireds[0];
        _amounts[1] = _amountDesireds[1];
    }

    function getReserves(
        address[] memory tokens
    ) external view returns (uint256 _reserveA, uint256 _reserveB) {
        require(tokens.length == 2, "INVALID_TOKENS_LENGTH");
        address _pair = getPair[tokens[0]][tokens[1]];

        require(_pair != address(0), "INVALID_PAIR");

        (_reserveA, _reserveB, ) = MockPair(_pair).getReserves();
    }

    function pairFor(
        address[] memory tokens,
        uint8
    ) external view returns (address pair, bool hasPair) {
        (address token0, address token1) = tokens[0] < tokens[1]
            ? (tokens[0], tokens[1])
            : (tokens[1], tokens[0]);

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        pair = address(
            uint160(
                uint(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            salt,
                            INIT_CODE_HASH
                        )
                    )
                )
            )
        );
        hasPair = isPair[pair];
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract MockPair is ERC20 {
    using SafeERC20 for IERC20;

    address public token0;
    address public token1;
    uint256 private reserve0;
    uint256 private reserve1;

    constructor() ERC20("LP Token", "LP") {}

    function initialize(address _token0, address _token1) external {
        require(token0 == address(0), "ALREADY_INITIALIZED");
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() public view returns (uint256, uint256, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp % 2 ** 32));
    }

    function mint(address to) external returns (uint256 liquidity) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - reserve0;
        uint256 amount1 = balance1 - reserve1;

        // Simple liquidity calculation using geometric mean
        liquidity = sqrt(amount0 * amount1);

        _mint(to, liquidity);

        // Update reserves
        reserve0 = balance0;
        reserve1 = balance1;
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
