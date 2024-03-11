// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "solady/tokens/ERC20.sol";
import {Test} from "forge-std/Test.sol";
import {RouterHandler} from "./RouterHandler.t.sol";
import {WrappedNative} from "src/WrappedNative.sol";
import {UniswapV2Factory} from "src/core/UniswapV2Factory.sol";
import {UniswapV2Router02} from "src/periphery/UniswapV2Router02.sol";
import {UniswapV2Pair} from "src/core/UniswapV2Pair.sol";

contract RouterInvariantTest is Test {
    RouterHandler public handler;
    UniswapV2Factory public factory;
    UniswapV2Router02 public router;
    WrappedNative public weth;

    function setUp() public virtual {
        factory = new UniswapV2Factory(address(0), 0, "UniswapV2", "UNIV2");
        weth = new WrappedNative("Wrapped Ether", "WETH");
        router = new UniswapV2Router02(address(factory), address(weth));
        handler = new RouterHandler(router);

        targetContract(address(handler));
    }

    function invariant_K() public {
        uint x = ERC20(address(handler.tokenA())).balanceOf(address(handler.pool()));
        uint y = ERC20(address(handler.tokenB())).balanceOf(address(handler.pool()));
        assertEq(x * y, handler.k());
    }

    function invariant_K_Reserves() public {
        (uint x, uint y,) = UniswapV2Pair(address(handler.pool())).getReserves();
        assertEq(x * y, handler.k());
    }
}
