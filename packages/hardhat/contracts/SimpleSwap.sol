// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ISimpleSwap } from "./interfaces/ISimpleSwap.sol";

/**
 * @title SimpleSwap
 * @notice A minimal decentralized exchange contract supporting ERC20 token swaps and liquidity provision.
 */
contract SimpleSwap is ERC20, ISimpleSwap {
    /// @notice Maps token pairs to their respective reserves (tokenA perspective)
    mapping(address => mapping(address => uint)) public reservesA;
    /// @notice Maps token pairs to their respective reserves (tokenB perspective)
    mapping(address => mapping(address => uint)) public reservesB;
    /// @notice Tracks total liquidity provided for a token pair
    mapping(address => mapping(address => uint)) public totalLiquidity;
    /// @notice Tracks user-specific liquidity provision for a token pair
    mapping(address => mapping(address => mapping(address => uint))) public userLiquidity;

    /// @notice Emitted when liquidity is added to the pool
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint amountA,
        uint amountB,
        uint liquidity
    );
    /// @notice Emitted when liquidity is removed from the pool
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint amountA,
        uint amountB,
        uint liquidity
    );
    /// @notice Emitted when a token swap is successfully executed
    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint amountIn, uint amountOut);

    /// @notice Ensures the transaction deadline has not passed
    modifier ensure(uint deadline) {
        require(block.timestamp <= deadline, "SimpleSwap: EXPIRED");
        _;
    }

    /// @notice Ensures the token pair is valid (non-identical and non-zero addresses)
    modifier validPair(address tokenA, address tokenB) {
        require(tokenA != tokenB, "SimpleSwap: IDENTICAL_ADDRESSES");
        require(tokenA != address(0) && tokenB != address(0), "SimpleSwap: ZERO_ADDRESS");
        _;
    }

    /// @notice Initializes the contract with an LP token
    constructor() ERC20("Liquidity Provider Token", "LP") {}

    /**
     * @notice Adds liquidity to the pool and mints LP tokens
     * @param tokenA Address of token A
     * @param tokenB Address of token B
     * @param amountADesired Desired amount of token A to add
     * @param amountBDesired Desired amount of token B to add
     * @param amountAMin Minimum amount of token A
     * @param amountBMin Minimum amount of token B
     * @param to Address to mint LP tokens to
     * @param deadline Timestamp after which transaction reverts
     * @return amountA Actual amount of token A added
     * @return amountB Actual amount of token B added
     * @return liquidity Amount of LP tokens minted
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external ensure(deadline) validPair(tokenA, tokenB) returns (uint amountA, uint amountB, uint liquidity) {
        // Retrieve reserves
        uint reserveA = reservesA[tokenA][tokenB];
        uint reserveB = reservesB[tokenA][tokenB];

        // If no liquidity exists yet, use exact amounts
        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            // Otherwise, calculate optimal counterpart to maintain ratio
            uint amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired && amountBOptimal >= amountBMin) {
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint amountAOptimal = (amountBDesired * reserveA) / reserveB;
                require(
                    amountAOptimal <= amountADesired && amountAOptimal >= amountAMin,
                    "SimpleSwap: INSUFFICIENT_A_OR_B"
                );
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
        }

        // Transfer tokens into contract
        require(ERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "SimpleSwap: TRANSFER_A_FAILED");
        require(ERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "SimpleSwap: TRANSFER_B_FAILED");

        // Update reserves
        reservesA[tokenA][tokenB] += amountA;
        reservesB[tokenA][tokenB] += amountB;

        // Mint liquidity tokens based on new deposits
        if (totalLiquidity[tokenA][tokenB] == 0) {
            liquidity = sqrt(amountA * amountB);
        } else {
            liquidity = min(
                (amountA * totalLiquidity[tokenA][tokenB]) / reserveA,
                (amountB * totalLiquidity[tokenA][tokenB]) / reserveB
            );
        }

        require(liquidity > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");

        // Update LP tracking
        totalLiquidity[tokenA][tokenB] += liquidity;
        userLiquidity[to][tokenA][tokenB] += liquidity;

        _mint(to, liquidity);

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
        return (amountA, amountB, liquidity);
    }

    /**
     * @notice Removes liquidity from the pool and burns LP tokens
     * @param tokenA Address of token A
     * @param tokenB Address of token B
     * @param liquidity Amount of LP tokens to burn
     * @param amountAMin Minimum amount of token A to receive
     * @param amountBMin Minimum amount of token B to receive
     * @param to Address to receive tokens
     * @param deadline Timestamp after which transaction reverts
     * @return amountA Amount of token A returned
     * @return amountB Amount of token B returned
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external ensure(deadline) validPair(tokenA, tokenB) returns (uint amountA, uint amountB) {
        // Load state
        uint reserveA = reservesA[tokenA][tokenB];
        uint reserveB = reservesB[tokenA][tokenB];
        uint totalLiquidity_ = totalLiquidity[tokenA][tokenB];

        require(liquidity > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY_BURNED");
        require(userLiquidity[msg.sender][tokenA][tokenB] >= liquidity, "SimpleSwap: NOT_ENOUGH_USER_LIQUIDITY");

        // Compute amounts based on LP share
        amountA = (liquidity * reserveA) / totalLiquidity_;
        amountB = (liquidity * reserveB) / totalLiquidity_;

        require(amountA >= amountAMin && amountB >= amountBMin, "SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");

        // Update reserves and balances
        reservesA[tokenA][tokenB] -= amountA;
        reservesB[tokenA][tokenB] -= amountB;

        totalLiquidity[tokenA][tokenB] -= liquidity;
        userLiquidity[msg.sender][tokenA][tokenB] -= liquidity;

        _burn(msg.sender, liquidity);

        // Send tokens back to user
        require(ERC20(tokenA).transfer(to, amountA), "SimpleSwap: TRANSFER_A_FAILED");
        require(ERC20(tokenB).transfer(to, amountB), "SimpleSwap: TRANSFER_B_FAILED");

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
        return (amountA, amountB);
    }

    /**
     * @notice Swaps exact tokens for tokens via a direct path
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum output tokens to receive
     * @param path Array with [tokenIn, tokenOut]
     * @param to Recipient address
     * @param deadline Timestamp after which transaction reverts
     */
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) {
        require(path.length == 2, "SimpleSwap: INVALID_PATH");
        address tokenIn = path[0];
        address tokenOut = path[1];

        // Retrieve reserves
        uint reserveIn = reservesA[tokenIn][tokenOut];
        uint reserveOut = reservesB[tokenIn][tokenOut];
        require(reserveIn > 0 && reserveOut > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");

        // Transfer input tokens
        require(ERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "SimpleSwap: TRANSFER_FAILED");

        // Calculate output
        uint amountOut = getAmountOutInternal(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");

        // Update reserves
        reservesA[tokenIn][tokenOut] += amountIn;
        reservesB[tokenIn][tokenOut] -= amountOut;

        // Send tokens to user
        require(ERC20(tokenOut).transfer(to, amountOut), "SimpleSwap: OUTPUT_TRANSFER_FAILED");

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /**
     * @notice Returns price ratio (tokenB/tokenA)
     * @param tokenA Token A address
     * @param tokenB Token B address
     * @return price Quoted price as tokenB/tokenA with 18 decimals
     */
    function getPrice(address tokenA, address tokenB) external view returns (uint price) {
        uint reserveA = reservesA[tokenA][tokenB];
        uint reserveB = reservesB[tokenA][tokenB];
        require(reserveA > 0 && reserveB > 0, "SimpleSwap: NO_LIQUIDITY");
        price = (reserveB * 1e18) / reserveA;
    }

    /**
     * @notice Returns estimated amountOut for a given input and reserves
     * @param amountIn Amount of input tokens
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @return amountOut Calculated amount out
     */
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut) {
        amountOut = getAmountOutInternal(amountIn, reserveIn, reserveOut);
    }

    /**
     * @dev Pure internal calculation of output amount
     * @param amountIn Input token amount
     * @param reserveIn Reserve of token being input
     * @param reserveOut Reserve of token being output
     * @return amountOut Result of swap without fee
     */
    function getAmountOutInternal(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        require(amountIn > 0, "SimpleSwap: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");
        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /// @dev Returns the smaller of two uints
    function min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }

    /// @dev Integer square root used for initial LP minting
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
