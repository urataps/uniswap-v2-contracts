// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IUniswapV2Factory} from "./interfaces/IUniswapV2Factory.sol";
import {UniswapV2Pair, IUniswapV2Pair} from "./UniswapV2Pair.sol";

contract UniswapV2Factory is IUniswapV2Factory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    address private _token0;
    address private _token1;

    string public name;
    string public symbol;

    constructor(address _feeToSetter, string memory _name, string memory _symbol) {
        feeToSetter = _feeToSetter;
        name = _name;
        symbol = _symbol;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "PAIR_EXISTS"); // single check is sufficient
        pair = _deployPool(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    function parameters() external view returns (address token0, address token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function _deployPool(address token0, address token1) internal returns (address pair) {
        _token0 = token0;
        _token1 = token1;
        pair = address(new UniswapV2Pair{salt: keccak256(abi.encodePacked(token0, token1))}());
        delete _token0;
        delete _token1;
    }
}
