pragma solidity 0.8.20;

interface IExtPairFactory {
    function createPair(
        address[] memory _tokens,
        uint8 _pairType,
        bytes memory _data
    ) external returns (address pair);
}
