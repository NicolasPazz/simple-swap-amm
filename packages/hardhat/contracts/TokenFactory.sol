// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenFactory is ERC20 {
    /**
     * @dev Constructor for the token factory contract.
     *
     * @param name Name of the new token to be created
     * @param symbol Symbol of the new token to be created
     * @param amountToMint Initial amount of tokens to mint to the deployer's address
     */
    constructor(string memory name, string memory symbol, uint amountToMint) ERC20(name, symbol) {
        _mint(msg.sender, amountToMint * 10 ** decimals());
    }

    /**
     * @dev Function to mint new tokens.
     *
     * @param amount Amount of tokens to mint to sender's address
     */
    function mint(uint256 amount) external {
        _mint(msg.sender, amount * 10 ** decimals());
    }
}
