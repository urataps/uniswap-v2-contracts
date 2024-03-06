// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {UniswapV2Pair} from "src/core/UniswapV2Pair.sol";

contract PoolHash is Script {
    function run() public view {
        console.logBytes32(keccak256(type(UniswapV2Pair).creationCode));
    }
}
