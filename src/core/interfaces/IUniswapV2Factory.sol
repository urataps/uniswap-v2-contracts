// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

interface IUniswapV2Factory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;

    // Added for gas efficiency
    function parameters() external view returns (address token0, address token1);

    // Added for customizability
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function poolFee() external view returns (uint);
}
