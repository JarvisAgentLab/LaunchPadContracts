// SPDX-License-Identifier: MIT
// Modified from https://github.com/sourlodine/Pump.fun-Smart-Contract/blob/main/contracts/PumpFun.sol
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./INTFactory.sol";
import "./libraries/INTRouterLibrary.sol";
import "./INTERC20.sol";
import "./Lock.sol";
import "./INTERC20Factory.sol";
import "./LockFactory.sol";

import "./interfaces/IINTPair.sol";
import "./interfaces/IExtRouter.sol";
import "./interfaces/IExtPairFactory.sol";
import "./interfaces/IOracle.sol";

contract Bonding is
    Initializable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;

    // Act as treasury
    address public feeTo;

    INTFactory public factory;
    INTERC20Factory public tokenFactory;
    LockFactory public lockFactory;
    uint256 public initialSupply;
    uint256 public fee;
    IExtRouter public extRouter;
    address public assetToken;

    enum TokenStatus {
        None,
        BondingCurve,
        Graduated
    }

    struct Token {
        address creator;
        address token;
        address pair; // Bonding: internal pair, Graduated: external pair
        address locker;
        string description;
        uint8[] cores;
        string image;
        string twitter;
        string telegram;
        string farcaster;
        string website;
        TokenStatus status;
    }

    mapping(address => Token) public tokenInfo;
    address[] public tokenInfos;

    struct BoostInfo {
        uint8 stage;
    }

    // Separate mapping for boost information
    mapping(address => BoostInfo) public boostInfo;
    address[] public boostInfos;

    bytes32 public constant BOOSTER_ROLE = keccak256("BOOSTER_ROLE");

    // Mapping to store boost stage thresholds
    mapping(uint8 => uint256) public boostStageThresholds;

    // The locked times for lp tokens that locked in the locker contract
    uint256 public lockedTime;

    IOracle public oracle;

    uint256 public initialMarketCap;
    uint256 public gradMarketCap;

    /**
     * ============================================
     * =                 EVENTS                   =
     * ============================================
     */
    event Launched(
        address indexed token,
        address indexed pair,
        uint256 totalTokens,
        uint8 tokenType,
        uint256 timestamp
    );
    event Graduated(address indexed token, address indexed lp);
    event DelegateLPTo(address indexed token, address indexed delegatee);
    event Boosted(
        address indexed token,
        uint8 stage,
        uint256 amount,
        uint256 assetAmount
    );

    event BoostStageThresholdUpdated(uint8 stage, uint256 threshold);
    event InitializeSupplySet(uint256 newSupply);
    event FeeSet(uint256 newFee, address newFeeTo);
    event OracleSet(address newOracle);
    event InitialMarketCapSet(uint256 newMarketCap);
    event GradMarketCapSet(uint256 newMarketCap);
    event LockedTimeSet(uint256 newLockedTime);
    event FactorySet(address newFactory);
    event RouterSet(address newRouter);
    event TokenFactorySet(address newTokenFactory);
    event LockFactorySet(address newLockFactory);
    event ExtRouterSet(address newExtRouter);
    event AssetTokenSet(address newAssetToken);

    /**
     * ============================================
     * =                  ERRORS                  =
     * ============================================
     */

    error ProfileNotExist();
    error InvalidToken();
    error NotTrading();
    error AlreadyTrading();
    error InsufficientAmount();
    error InvalidDelegatee();
    error InvalidLocker();
    error InputArrayMismatch();
    error InvalidLockTime();
    error InvalidRate();
    error InvalidStage();
    error InvalidThreshold();
    error InvalidReserves();
    error InvalidAssetPrice();
    error InvalidOracle();
    error InvalidMarketCap();
    error WrongBoostStage();
    error LiquidityTooLow();
    error MarketCapTooLow();

    /**
     * ============================================
     * =                FUNCTIONS                 =
     * ============================================
     */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address assetToken_,
        address factory_,
        address feeTo_,
        uint256 fee_,
        uint256 initialSupply_,
        address extRouter_,
        address tokenFactory_,
        address lockFactory_,
        uint256 lockedTime_,
        address oracle_,
        uint256 initialMarketCap_,
        uint256 gradMarketCap_
    ) external initializer {
        __Ownable2Step_init();
        __ReentrancyGuard_init();
        __AccessControl_init();

        assetToken = assetToken_;

        factory = INTFactory(factory_);
        tokenFactory = INTERC20Factory(tokenFactory_);
        lockFactory = LockFactory(lockFactory_);

        feeTo = feeTo_;
        fee = fee_;

        initialSupply = initialSupply_;

        extRouter = IExtRouter(extRouter_);

        lockedTime = lockedTime_;
        oracle = IOracle(oracle_);

        initialMarketCap = initialMarketCap_;
        gradMarketCap = gradMarketCap_;
    }

    /**
     * @dev Internal function to transfer ownership along with the DEFAULT_ADMIN_ROLE
     */
    function _transferOwnership(address newOwner) internal virtual override {
        _revokeRole(DEFAULT_ADMIN_ROLE, owner());
        super._transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
    }

    /**
     * @dev Set the initial supply for generating a new token
     * @param newSupply New initial supply
     */
    function setInitialSupply(uint256 newSupply) public onlyOwner {
        initialSupply = newSupply;

        emit InitializeSupplySet(newSupply);
    }

    /**
     * @dev Set the fee and fee recipient
     * @param newFee New fee amount
     * @param newFeeTo New fee recipient
     */
    function setFee(uint256 newFee, address newFeeTo) public onlyOwner {
        fee = newFee;
        feeTo = newFeeTo;

        emit FeeSet(newFee, newFeeTo);
    }

    /**
     * @dev Set the oracle address
     * @param newOracle The new oracle address
     */
    function setOracle(address newOracle) public onlyOwner {
        if (IOracle(newOracle).getAssetPrice() == 0) revert InvalidOracle();

        oracle = IOracle(newOracle);

        emit OracleSet(newOracle);
    }

    /**
     * @dev Set the initial market cap threshold
     * @param newMarketCap The new initial market cap threshold
     */
    function setInitialMarketCap(uint256 newMarketCap) public onlyOwner {
        if (newMarketCap == 0) revert InvalidMarketCap();

        initialMarketCap = newMarketCap;

        emit InitialMarketCapSet(newMarketCap);
    }

    /**
     * @dev Set the graduation market cap threshold
     * @param newMarketCap The new graduation market cap threshold
     */
    function setGradMarketCap(uint256 newMarketCap) public onlyOwner {
        if (newMarketCap < initialMarketCap) revert InvalidMarketCap();

        gradMarketCap = newMarketCap;

        emit GradMarketCapSet(newMarketCap);
    }

    /**
     * @dev Set the locked time for lp tokens that locked in the locker contract
     * @param newLockedTime The new locked time
     */
    function setLockedTime(uint256 newLockedTime) public onlyOwner {
        if (newLockedTime <= 365 days) revert InvalidLockTime();
        lockedTime = newLockedTime;

        emit LockedTimeSet(newLockedTime);
    }

    /**
     * @notice Owner should ensure the factory address is correct
     * @dev Set the factory address
     * @param newFactory The new factory address
     */
    function setFactory(address newFactory) public onlyOwner {
        factory = INTFactory(newFactory);

        emit FactorySet(newFactory);
    }

    /**
     * @notice Owner should ensure the token factory address is correct
     * @dev Set the token factory address
     * @param newTokenFactory The new token factory address
     */
    function setTokenFactory(address newTokenFactory) public onlyOwner {
        tokenFactory = INTERC20Factory(newTokenFactory);

        emit TokenFactorySet(newTokenFactory);
    }

    /**
     * @notice Owner should ensure the lock factory address is correct
     * @dev Set the lock factory address
     * @param newLockFactory The new lock factory address
     */
    function setLockFactory(address newLockFactory) public onlyOwner {
        lockFactory = LockFactory(newLockFactory);

        emit LockFactorySet(newLockFactory);
    }

    /**
     * @notice Owner should ensure the external router address is correct
     * @dev Set the external router address
     * @param newExtRouter The new external router address
     */
    function setExtRouter(address newExtRouter) public onlyOwner {
        extRouter = IExtRouter(newExtRouter);

        emit ExtRouterSet(newExtRouter);
    }

    /**
     * @notice Owner should ensure the asset token address is correct
     * @dev Set the asset token address
     * @param newAssetToken The new asset token address
     */
    function setAssetToken(address newAssetToken) public onlyOwner {
        assetToken = newAssetToken;

        emit AssetTokenSet(newAssetToken);
    }

    function _createToken(
        address _creator,
        string memory _name,
        string memory _ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls
    ) internal returns (address token) {
        token = tokenFactory.createToken(
            string.concat(_name, " by InteNet"),
            _ticker,
            initialSupply,
            address(this)
        );

        // Create a lock contract for the token
        address lock = lockFactory.createLock(
            token,
            assetToken,
            address(this),
            lockedTime
        );

        Token memory tmpToken = Token({
            creator: _creator,
            token: token,
            pair: address(0),
            locker: lock,
            description: desc,
            cores: cores,
            image: img,
            twitter: urls[0],
            telegram: urls[1],
            farcaster: urls[2],
            website: urls[3],
            status: TokenStatus.BondingCurve
        });

        tokenInfo[address(token)] = tmpToken;
        tokenInfos.push(address(token));
    }

    function _launchInternal(
        address _creator,
        string memory _name,
        string memory _ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 purchaseAmount
    ) internal returns (address, address, uint256) {
        if (IERC20(assetToken).balanceOf(msg.sender) < purchaseAmount)
            revert InsufficientAmount();

        uint256 feeAmount = fee;
        if (feeAmount > 0)
            IERC20(assetToken).safeTransferFrom(msg.sender, feeTo, feeAmount);

        address token = _createToken(
            _creator,
            _name,
            _ticker,
            cores,
            desc,
            img,
            urls
        );

        address _pair = factory.createPair(token, assetToken);

        // create pair in external AMM to reserve the boost fee pair
        address[] memory tokens = new address[](2);
        tokens[0] = assetToken;
        tokens[1] = token;
        IExtPairFactory(extRouter.factory()).createPair(
            tokens,
            1, // PairType.Volatile
            abi.encodePacked(uint256(1)) // FeeType.Boost
        );

        // Enable pair contract to transfer tokens
        INTERC20(token).excludeAccount(_pair);

        uint256 liquidity = (initialMarketCap * 1e18) / oracle.getAssetPrice();
        INTRouterLibrary.addInitialLiquidity(
            factory,
            assetToken,
            token,
            initialSupply,
            liquidity
        );

        tokenInfo[token].pair = _pair;
        uint256 totalTokens = tokenInfos.length;
        emit Launched(token, _pair, totalTokens, 0, block.timestamp);

        uint256 initialPurchase = (purchaseAmount - feeAmount);
        if (initialPurchase != 0) {
            INTRouterLibrary.buy(
                factory,
                assetToken,
                initialPurchase,
                token,
                msg.sender
            );
        }

        return (token, _pair, totalTokens);
    }

    function launchFor(
        address _creator,
        string memory _name,
        string memory _ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 purchaseAmount
    ) public nonReentrant returns (address, address, uint256) {
        return
            _launchInternal(
                _creator,
                _name,
                _ticker,
                cores,
                desc,
                img,
                urls,
                purchaseAmount
            );
    }

    function launch(
        string memory _name,
        string memory _ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 purchaseAmount
    ) public nonReentrant returns (address, address, uint256) {
        return
            _launchInternal(
                msg.sender,
                _name,
                _ticker,
                cores,
                desc,
                img,
                urls,
                purchaseAmount
            );
    }

    function sell(
        uint256 amountIn,
        address tokenAddress
    ) public returns (bool) {
        if (tokenInfo[tokenAddress].status != TokenStatus.BondingCurve)
            revert NotTrading();

        INTRouterLibrary.sell(
            factory,
            assetToken,
            amountIn,
            tokenAddress,
            msg.sender
        );

        return true;
    }

    function buy(
        uint256 amountIn,
        address tokenAddress
    ) public returns (bool) {
        if (tokenInfo[tokenAddress].status != TokenStatus.BondingCurve)
            revert NotTrading();

        INTRouterLibrary.buy(
            factory,
            assetToken,
            amountIn,
            tokenAddress,
            msg.sender
        );

        if (calculateMarketCap(tokenAddress) >= gradMarketCap) {
            _graduate(tokenAddress);
        }

        return true;
    }

    function quoteBuy(
        address token_,
        uint256 amountIn_
    ) external view returns (uint256, uint256) {
        return
            INTRouterLibrary.quoteBuy(factory, assetToken, token_, amountIn_);
    }

    function quoteSell(
        address token_,
        uint256 amountIn_
    ) public view returns (uint256, uint256) {
        return
            INTRouterLibrary.quoteSell(factory, assetToken, token_, amountIn_);
    }

    function _graduate(address tokenAddress) internal {
        Token storage _token = tokenInfo[tokenAddress];

        // Sanity check
        if (tokenInfo[tokenAddress].status == TokenStatus.Graduated)
            revert AlreadyTrading();

        INTERC20 token_ = INTERC20(tokenAddress);

        // Transfer asset tokens to bonding contract
        IINTPair pair = IINTPair(_token.pair);

        uint256 assetBalance = pair.assetBalance();
        uint256 tokenBalance = pair.balance();

        INTRouterLibrary.graduate(factory, assetToken, tokenAddress);

        // Enable token transferring without limit
        token_.enableTransfer();

        address[] memory tokens = new address[](2);
        tokens[0] = assetToken;
        tokens[1] = tokenAddress;
        (address lp, ) = extRouter.pairFor(tokens, 1);

        // update LP address in locker contract
        address locker = _token.locker;
        ILock(locker).setLP(lp);

        _extRouterAddLiquidity(
            lp,
            locker,
            tokenAddress,
            assetToken,
            tokenBalance,
            assetBalance,
            tokenBalance,
            assetBalance,
            0,
            block.timestamp
        );

        _token.status = TokenStatus.Graduated;
        _token.pair = lp;

        emit Graduated(tokenAddress, lp);
    }

    // Delegate LP token to the specified address.
    function _delegateLPTo(address tokenAddr, address delegatee) internal {
        if (delegatee == address(0)) revert InvalidDelegatee();

        Token storage _tokenInfo = tokenInfo[tokenAddr];
        if (_tokenInfo.locker == address(0)) revert InvalidLocker();

        ILock lockContract = ILock(_tokenInfo.locker);
        lockContract.delegateLPTo(delegatee);

        emit DelegateLPTo(tokenAddr, delegatee);
    }

    /**
     * @notice LP token should have been released in its locker contract.
     * @dev Delegate LP token to the specified address.
     * @param tokenAddr The address of the token to delegate its LP token.
     * @param delegatee The address to delegate the LP token to.
     */
    function delegateLPTo(
        address tokenAddr,
        address delegatee
    ) external onlyOwner {
        _delegateLPTo(tokenAddr, delegatee);
    }

    /**
     * @notice LP token should have been released in its locker contract.
     * @dev Delegate LP token to the specified address for multiple tokens.
     * @param tokens The addresses of the tokens to delegate their LP tokens.
     * @param delegatees The addresses to delegate the LP tokens to.
     */
    function delegateLPToBatch(
        address[] calldata tokens,
        address[] calldata delegatees
    ) external onlyOwner {
        if (tokens.length != delegatees.length) revert InputArrayMismatch();

        uint256 len = tokens.length;
        for (uint256 i; i < len; ) {
            _delegateLPTo(tokens[i], delegatees[i]);

            unchecked {
                ++i;
            }
        }
    }

    function hasGraduated(address tokenAddress) external view returns (bool) {
        return tokenInfo[tokenAddress].status == TokenStatus.Graduated;
    }

    function getTokenLocker(
        address tokenAddress
    ) external view returns (address) {
        Token storage token = tokenInfo[tokenAddress];

        return token.locker;
    }

    function getTokenCreator(
        address tokenAddress
    ) external view returns (address) {
        Token storage token = tokenInfo[tokenAddress];

        return token.creator;
    }

    /**
     * @notice Get the total number of tokens created through bonding
     * @return The length of tokenInfos array
     */
    function getTokenCount() external view returns (uint256) {
        return tokenInfos.length;
    }

    function _boost1(
        address creator,
        string memory name,
        string memory ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) internal {
        // boostStageThreshold and asset price are all 18 decimals
        if (
            assetAmount * oracle.getAssetPrice() * 2 <
            boostStageThresholds[1] * 1e18
        ) {
            revert LiquidityTooLow();
        }

        address token = _createToken(
            creator,
            name,
            ticker,
            cores,
            desc,
            img,
            urls
        );

        Token storage _token = tokenInfo[token];

        address[] memory tokens = new address[](2);
        tokens[0] = assetToken;
        tokens[1] = token;

        // The boost pair creation is permissioned
        address pair = IExtPairFactory(extRouter.factory()).createPair(
            tokens,
            1, // PairType.Volatile
            abi.encodePacked(uint256(1)) // FeeType.Boost
        );

        _token.status = TokenStatus.Graduated;
        _token.pair = pair;

        // Update LP address in locker contract
        address locker = _token.locker;
        ILock(locker).setLP(pair);

        // Record boost information
        boostInfo[token] = BoostInfo({ stage: 1 });
        boostInfos.push(token);

        INTERC20(token).enableTransfer();

        emit Launched(token, pair, tokenInfos.length, 1, block.timestamp);

        // Provide Initial liquidity via external router
        IERC20(assetToken).safeTransferFrom(feeTo, address(this), assetAmount);

        // Added amounts should match intended as it's the initial liquidity
        (, uint256 tokenAdded, uint256 assetAdded) = _extRouterAddLiquidity(
            pair,
            locker,
            token,
            assetToken,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );

        // Approve the remaining token for future boost
        ILock(locker).approveToken(
            token,
            address(this),
            initialSupply - tokenAdded
        );

        emit Boosted(token, 1, tokenAdded, assetAdded);
    }

    /**
     * @notice Boost liquidity for a token by adding token and asset pairs
     * @dev Only callable by owner. Adds liquidity via external router
     * @param creator The creator of the token
     * @param name The name of the token
     * @param ticker The ticker symbol of the token
     * @param cores Array of core values
     * @param desc Description of the token
     * @param img Image URL for the token
     * @param urls Array of 4 URLs (twitter, telegram, farcaster, website)
     * @param tokenAmount Amount of tokens to add as liquidity
     * @param assetAmount Amount of asset tokens to add as liquidity
     * @param tokenAmountMin Minimum amount of tokens that must be added as liquidity
     * @param assetAmountMin Minimum amount of asset tokens that must be added as liquidity
     * @param minLiquidity Minimum amount of liquidity tokens that must be minted
     * @param deadline Timestamp after which the transaction will revert
     */
    function boost1For(
        address creator,
        string memory name,
        string memory ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) external onlyRole(BOOSTER_ROLE) {
        _boost1(
            creator,
            name,
            ticker,
            cores,
            desc,
            img,
            urls,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );
    }

    /**
     * @notice Boost liquidity for a token by adding token and asset pairs
     * @dev Only callable by owner. Adds liquidity via external router
     * @param name The name of the token
     * @param ticker The ticker symbol of the token
     * @param cores Array of core values
     * @param desc Description of the token
     * @param img Image URL for the token
     * @param urls Array of 4 URLs (twitter, telegram, farcaster, website)
     * @param tokenAmount Amount of tokens to add as liquidity
     * @param assetAmount Amount of asset tokens to add as liquidity
     * @param tokenAmountMin Minimum amount of tokens that must be added as liquidity
     * @param assetAmountMin Minimum amount of asset tokens that must be added as liquidity
     * @param minLiquidity Minimum amount of liquidity tokens that must be minted
     * @param deadline Timestamp after which the transaction will revert
     */
    function boost1(
        string memory name,
        string memory ticker,
        uint8[] memory cores,
        string memory desc,
        string memory img,
        string[4] memory urls,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) external onlyRole(BOOSTER_ROLE) {
        _boost1(
            msg.sender,
            name,
            ticker,
            cores,
            desc,
            img,
            urls,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );
    }

    /**
     * @notice Boost Stage 2 for a token by adding token and asset pairs
     * @dev Only callable by booster. Adds liquidity via external router
     * @param token Address of token to boost
     * @param tokenAmount Amount of tokens to add as liquidity
     * @param assetAmount Amount of asset tokens to add as liquidity
     * @param tokenAmountMin Minimum amount of tokens that must be added as liquidity
     * @param assetAmountMin Minimum amount of asset tokens that must be added as liquidity
     * @param minLiquidity Minimum amount of liquidity tokens that must be minted
     * @param deadline Timestamp after which the transaction will revert
     */
    function boost2(
        address token,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) external onlyRole(BOOSTER_ROLE) {
        _boost(
            2,
            token,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );
    }

    /**
     * @notice Boost Stage 3 for a token by adding token and asset pairs
     * @dev Only callable by owner. Adds liquidity via external router
     * @param token Address of token to boost
     * @param tokenAmount Amount of tokens to add as liquidity
     * @param assetAmount Amount of asset tokens to add as liquidity
     * @param tokenAmountMin Minimum amount of tokens that must be added as liquidity
     * @param assetAmountMin Minimum amount of asset tokens that must be added as liquidity
     * @param minLiquidity Minimum amount of liquidity tokens that must be minted
     * @param deadline Timestamp after which the transaction will revert
     */
    function boost3(
        address token,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) external onlyRole(BOOSTER_ROLE) {
        _boost(
            3,
            token,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );
    }

    function _boost(
        uint8 stage,
        address token,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    ) internal {
        BoostInfo storage _boostInfo = boostInfo[token];
        if (_boostInfo.stage + 1 != stage) revert WrongBoostStage();

        if (calculateMarketCap(token) < boostStageThresholds[stage]) {
            revert MarketCapTooLow();
        }

        Token storage _token = tokenInfo[token];
        address _locker = _token.locker;

        IERC20(assetToken).safeTransferFrom(feeTo, address(this), assetAmount);
        IERC20(token).safeTransferFrom(_locker, address(this), tokenAmount);

        // _extRouterAddLiquidity will return remaining token and asset
        (, uint256 tokenAdded, uint256 assetAdded) = _extRouterAddLiquidity(
            _token.pair,
            _locker,
            token,
            assetToken,
            tokenAmount,
            assetAmount,
            tokenAmountMin,
            assetAmountMin,
            minLiquidity,
            deadline
        );

        _boostInfo.stage++;

        emit Boosted(token, stage, tokenAdded, assetAdded);
    }

    // Helper function to check if token is boosted
    function isBoostToken(address token) public view returns (bool) {
        return boostInfo[token].stage != 0;
    }

    // Get boost information
    function getBoostInfo(
        address token
    ) public view returns (BoostInfo memory) {
        return boostInfo[token];
    }

    /**
     * @notice Get the total number of boost created through bonding
     * @return The length of boostInfos array
     */
    function getBoostCount() external view returns (uint256) {
        return boostInfos.length;
    }

    function _extRouterAddLiquidity(
        address lp,
        address locker,
        address token,
        address asset,
        uint256 tokenAmount,
        uint256 assetAmount,
        uint256 tokenAmountMin,
        uint256 assetAmountMin,
        uint256 minLiquidity,
        uint256 deadline
    )
        internal
        returns (uint256 liquidity, uint256 tokenAdded, uint256 assetAdded)
    {
        address[] memory tokens = new address[](2);
        tokens[0] = asset;
        tokens[1] = token;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = assetAmount;
        amounts[1] = tokenAmount;

        uint256[] memory mins = new uint256[](2);
        mins[0] = assetAmountMin;
        mins[1] = tokenAmountMin;

        IERC20(token).forceApprove(address(extRouter), tokenAmount);
        IERC20(asset).forceApprove(address(extRouter), assetAmount);

        uint256[] memory added;
        (added, liquidity) = extRouter.addLiquidity(
            1,
            tokens,
            amounts,
            mins,
            minLiquidity,
            address(this),
            deadline
        );

        assetAdded = added[0];
        tokenAdded = added[1];

        IERC20(lp).forceApprove(locker, liquidity);
        ILock(locker).lockLP(liquidity);

        uint256 tokenBal = IERC20(token).balanceOf(address(this));
        uint256 assetBal = IERC20(asset).balanceOf(address(this));

        if (tokenBal != 0) {
            IERC20(token).safeTransfer(locker, tokenBal);
        }

        if (assetBal != 0) {
            IERC20(asset).safeTransfer(feeTo, assetBal);
        }
    }

    function _setBoostStageThresholdInternal(
        uint8 stage,
        uint256 threshold
    ) internal {
        if (stage == 0) revert InvalidStage();
        if (threshold <= boostStageThresholds[stage - 1])
            revert InvalidThreshold();
        boostStageThresholds[stage] = threshold;

        emit BoostStageThresholdUpdated(stage, threshold);
    }

    /**
     * @notice Set threshold for a boost stage
     * @param stage The boost stage number (1-3)
     * @param threshold The threshold amount required for this stage
     */
    function setBoostStageThreshold(
        uint8 stage,
        uint256 threshold
    ) external onlyOwner {
        if (stage > 3) revert InvalidStage();

        _setBoostStageThresholdInternal(stage, threshold);
    }

    /**
     * @notice Set thresholds for all boost stages in one transaction
     * @param thresholds Array of threshold amounts for stages 1-3
     */
    function setBoostStageThresholds(
        uint256[] calldata thresholds
    ) external onlyOwner {
        if (thresholds.length != 3) revert InputArrayMismatch();

        for (uint8 i = 0; i < 3; i++) {
            _setBoostStageThresholdInternal(i + 1, thresholds[i]);
        }
    }

    /**
     * @notice Calculate the market cap of a token using oracle price and liquidity reserves
     * @param token The token address to calculate market cap for
     * @return marketCap The calculated market cap in asset token value in 18 decimals
     */
    function calculateMarketCap(address token) public returns (uint256) {
        Token storage _token = tokenInfo[token];
        TokenStatus status = _token.status;
        if (status == TokenStatus.None) revert InvalidToken();

        uint256 assetPrice = IOracle(oracle).getAssetPrice();
        if (assetPrice == 0) revert InvalidAssetPrice();

        uint256 tokenReserve;
        uint256 assetReserve;
        address pair = _token.pair;

        if (status == TokenStatus.BondingCurve) {
            (tokenReserve, assetReserve) = IINTPair(pair).getReserves();
        } else {
            (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair)
                .getReserves();
            bool isToken0 = token < assetToken;

            (tokenReserve, assetReserve) = isToken0
                ? (reserve0, reserve1)
                : (reserve1, reserve0);
        }

        if (tokenReserve == 0 || assetReserve == 0) revert InvalidReserves();

        // Get total supply
        uint256 totalSupply = IERC20(token).totalSupply();

        // Calculate market cap: totalSupply * tokenPrice * assetPrice / 1e18
        uint256 marketCap = (assetPrice * totalSupply * assetReserve) /
            tokenReserve /
            1e18;

        return marketCap;
    }
}
