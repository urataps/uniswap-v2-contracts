// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {ERC20} from "solady//tokens/ERC20.sol";

contract UniswapV2ERC20 is ERC20 {
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    function name() public pure override returns (string memory) {
        return "Uniswap V2";
    }

    function symbol() public pure override returns (string memory) {
        return "UNI-V2";
    }
}
