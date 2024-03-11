/// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "solady/tokens/ERC20.sol";
import {UniswapV2Router02} from "src/periphery/UniswapV2Router02.sol";
import {UniswapV2Library} from "src/periphery/libraries/UniswapV2Library.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";

contract RouterHandler is Test {
    UniswapV2Router02 public router;

    address[] public users;

    address public tokenA;
    address public tokenB;
    address public pool;

    uint public k;

    constructor(UniswapV2Router02 router_) {
        router = router_;

        tokenA = address(new MockERC20());
        tokenB = address(new MockERC20());

        k = 1e33 * 1e33;
        deal(tokenA, address(this), 1e33);
        deal(tokenB, address(this), 1e33);
        ERC20(tokenA).approve(address(router), type(uint).max);
        ERC20(tokenB).approve(address(router), type(uint).max);
        router.addLiquidity(tokenA, tokenB, 1e33, 1e33, 0, 0, address(this), type(uint).max);
        pool = UniswapV2Library.pairFor(router.factory(), tokenA, tokenB);

        // Total of 10 users.
        for (uint i = 0; i < 10; i++) {
            address user = createUser(i);
            users.push(user);

            vm.startPrank(user);
            ERC20(tokenA).approve(address(router), type(uint).max);
            ERC20(tokenB).approve(address(router), type(uint).max);
        }
    }

    /*/////////////////////////////////////////////////////////////////////////////
                                PRIVATE FUNCTIONS
    /////////////////////////////////////////////////////////////////////////////*/

    function createUser(uint seed) public returns (address account) {
        uint privateKey = uint(keccak256(abi.encodePacked(seed)));
        account = vm.addr(privateKey);
        deal(account, 1e33);
        deal(tokenA, account, 1e33);
        deal(tokenB, account, 1e33);
    }

    function createPath(address tokenIn, address tokenOut) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
    }

    function randomAddress(uint seed) private view returns (address) {
        return users[bound(seed, 0, users.length - 1)];
    }

    function getQuote(uint amountX, address tokenX, address tokenY) private view returns (uint amountB) {
        (uint reserveX, uint reserveY) = UniswapV2Library.getReserves(router.factory(), tokenX, tokenY);
        return router.quote(amountX, reserveX, reserveY);
    }

    /*/////////////////////////////////////////////////////////////////////////////
                                PUBLIC FUNCTIONS
    /////////////////////////////////////////////////////////////////////////////*/

    function swapExactTokensForTokens(uint userSeed, bool aToB, uint amountIn) public {
        (address tokenIn, address tokenOut) = aToB ? (tokenA, tokenB) : (tokenB, tokenA);
        address user = randomAddress(userSeed);
        amountIn = bound(amountIn, 1, ERC20(tokenIn).balanceOf(user));

        vm.prank(user);
        router.swapExactTokensForTokens(amountIn, 0, createPath(tokenIn, tokenOut), user, type(uint).max);
    }

    function swapTokensForExactTokens(uint userSeed, bool aToB, uint amountOut) public {
        (address tokenIn, address tokenOut) = aToB ? (tokenA, tokenB) : (tokenB, tokenA);
        address user = randomAddress(userSeed);
        amountOut = bound(amountOut, 1, getQuote(ERC20(tokenIn).balanceOf(user), tokenIn, tokenOut));

        vm.prank(user);
        router.swapTokensForExactTokens(amountOut, type(uint).max, createPath(tokenIn, tokenOut), user, type(uint).max);
    }
}
