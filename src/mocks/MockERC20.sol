// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {ERC20} from "solady/tokens/ERC20.sol";

contract MockERC20 is ERC20 {
    function name() public pure override returns (string memory) {
        return "MockERC20";
    }

    function symbol() public pure override returns (string memory) {
        return "MOCK";
    }

    function mint(address account, uint amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint amount) external {
        _burn(account, amount);
    }
}
