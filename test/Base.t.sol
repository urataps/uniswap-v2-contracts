// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";

abstract contract BaseTest is Test {
    struct Users {
        address payable alice;
        address payable bob;
        address payable charlie;
    }

    Users users;
    MockERC20 tokenA;
    MockERC20 tokenB;
    MockERC20 tokenC;

    function setUp() public virtual {
        users = Users({alice: createUser("alice"), bob: createUser("bob"), charlie: createUser("charlie")});
    }

    function createUser(string memory name) public returns (address payable account) {
        account = payable(makeAddr(name));
        deal(account, 1e33);
        deal(address(tokenA), account, 1e33);
        deal(address(tokenB), account, 1e33);
        deal(address(tokenC), account, 1e33);
    }
}
