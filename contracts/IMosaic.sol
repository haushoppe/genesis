// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// A mosaic holds four tiles, these determine at which position each artwork is displayed.
struct Mosaic {
    uint256 tile1;
    uint256 tile2;
    uint256 tile3;
    uint256 tile4;
}