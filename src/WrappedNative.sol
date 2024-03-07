// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {WETH} from "solady/tokens/WETH.sol";

contract WrappedNative is WETH {
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }
}
