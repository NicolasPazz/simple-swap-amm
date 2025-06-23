// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenFactory is ERC20 {
    /**
     * @dev Constructor for the token factory contract.
     *
     * @param name Name of the new token to be created
     * @param symbol Symbol of the new token to be created
     */
   constructor(string memory name, string memory symbol) ERC20(name,symbol) {}

    /**
     * @dev Function for minting a specified amount of tokens.
     *
     * @param recipient Address that will receive newly generated tokens
     * @param quantity The number of new tokens to be created and transferred
     */
   function mint(address recipient, uint256 quantity) public {
        _mint(recipient,quantity);
    }
}