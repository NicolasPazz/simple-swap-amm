// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../SimpleSwap.sol";

/// @title Helper contract exposing internal math for testing
contract SimpleSwapWrapper is SimpleSwap {
    function exposeSqrt(uint y) external pure returns (uint) {
        return sqrt(y);
    }

    function exposeMin(uint a, uint b) external pure returns (uint) {
        return min(a, b);
    }

    function exposeGetAmountOutInternal(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint) {
        return getAmountOutInternal(amountIn, reserveIn, reserveOut);
    }
}
