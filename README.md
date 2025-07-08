
# 💱 SimpleSwap DEX

## 📜 Overview

**SimpleSwap** is a DEX implemented in Solidity that enables:

- ✅ Adding liquidity between two ERC20 tokens  
- 🔁 Swapping tokens with exact input amounts  
- 💧 Removing proportional liquidity  
- 📊 Querying current prices and swap estimates  

All interactions are protected with input validation and `deadline` constraints to ensure safe and fair operations.

---

## 🌐 Frontend on Vercel (Next.js + Scaffold-ETH)

The web application is deployed on Vercel and interacts with the contracts on Sepolia.
>🔗 Live Demo: https://simple-swap-amm-nextjs.vercel.app/

---

## 🛠️ Smart Contracts

### Core Contracts

- 🔁 `SimpleSwap`: Manages liquidity pools and token swaps  
- 💧 ERC20 Tokens: Dynamically generated via `TokenFactory`  
- 🧱 LP Tokens: The `SimpleSwap` contract also acts as a liquidity token (inherits from `ERC20`)  

### Deployed Addresses (Sepolia)

- `BOOKE (Bokita Coin)`: [`0x3b6BEcE5Ec2Ac59c073B085D32D0962E2911bae8`](https://sepolia.etherscan.io/address/0x3b6BEcE5Ec2Ac59c073B085D32D0962E2911bae8)
- `MIAMI (General Coin)`: [`0xf622c8a6634BC87C9cE4eC40C4Cf6Fccf257c9A1`](https://sepolia.etherscan.io/address/0xf622c8a6634BC87C9cE4eC40C4Cf6Fccf257c9A1)
- `SimpleSwap`: [`0xb4E6d982Bb76c02a510B2144e810470bd08616Bb`](https://sepolia.etherscan.io/address/0xb4E6d982Bb76c02a510B2144e810470bd08616Bb)

### Key Features

#### Liquidity

- `addLiquidity(...)`  
- `removeLiquidity(...)`  

#### Swaps

- `swapExactTokensForTokens(...)`  

#### Queries

- `getPrice(...)`  
- `getAmountOut(...)`  

#### Math Helpers

- `min(uint a, uint b)`  
- `sqrt(uint y)`  

---

## ✅ Tests and Coverage

- The contract has **100% test coverage**
- Tests are written using **Hardhat + Chai** and cover every branch of `SimpleSwap.sol`

To run tests and check coverage:

```bash
cd packages/hardhat
yarn coverage
```

---

## 🚀 Deployment and Verification

Contracts are automatically deployed to the **Sepolia testnet** and verified on Etherscan (if a valid API key is provided).

To deploy:

```bash
cd packages/hardhat
yarn deploy
```

To verify individually:

```bash
yarn hardhat verify --network sepolia 0xb4E6d982Bb76c02a510B2144e810470bd08616Bb 0x3b6BEcE5Ec2Ac59c073B085D32D0962E2911bae8 0xf622c8a6634BC87C9cE4eC40C4Cf6Fccf257c9A1
```

---

## 📈 How It Works

### 1. Add Liquidity

The user calls `addLiquidity()` with the selected ERC20 tokens. The contract calculates the optimal ratio and mints LP tokens to the provider.

### 2. Swap Tokens

The user calls `swapExactTokensForTokens()` to exchange a fixed amount of one token for another, based on current reserves.

### 3. Remove Liquidity

The user burns LP tokens via `removeLiquidity()` and receives a proportional share of both tokens.

---

## 🧠 Security

- ✅ Deadline validations  
- ✅ Reserve and amount checks  
- ✅ Explicit reverts for failed transfers  

---

## 📂 Interface: `ISimpleSwap`

The `ISimpleSwap` interface standardizes all core functions, ensuring compatibility with external tools and explorer verification.

---

## 🧪 Example Usage

```solidity
// Add liquidity
simpleSwap.addLiquidity(
  tokenA,
  tokenB,
  1000,
  1000,
  900,
  900,
  msg.sender,
  block.timestamp + 120
);

// Swap tokens
simpleSwap.swapExactTokensForTokens(
  1000,
  900,
  [tokenA, tokenB],
  msg.sender,
  block.timestamp + 120
);
```

---

## 🧱 Project Structure

```
simple-swap/
├── packages/
│   ├── hardhat/         # Contracts and deployment scripts
│   └── nextjs/          # Frontend using Next.js + Scaffold-ETH
├── deployments/         # Contracts generated at deploy time (copied to frontend)
```

---

## 🧾 License

MIT © 2025
