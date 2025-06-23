# 💱 SimpleSwap DEX

## 📜 Overview

SimpleSwap allows:

- ✅ Adding liquidity to a pair of ERC20 tokens
- 🔁 Swapping exact input tokens for output tokens
- 💧 Removing liquidity from a pool
- 📊 Viewing current prices and swap estimates

All interactions are protected with deadline and input validations to ensure secure and fair trading.

---

## 🛠️ Smart Contract

- 📂 Contract Name: `SimpleSwap`
- 🔐 Inherits from: `ERC20` (used to issue LP tokens)
- 🔗 Implements: `ISimpleSwap` interface

### 🔧 Features

- **Liquidity Management**
  - `addLiquidity(...)`
  - `removeLiquidity(...)`
- **Token Swapping**
  - `swapExactTokensForTokens(...)`
- **Price Queries**
  - `getPrice(...)`
  - `getAmountOut(...)`
- **Math Helpers**
  - `min(uint a, uint b)`
  - `sqrt(uint y)`

---

## 🔗 Deployed Contracts on Sepolia

| Name            | Symbol | Contract Address | Etherscan |
|-----------------|--------|------------------|-----------|
| Boquita Coin    | BOKE   | `0x543C4Fdb6dBB2BA4d9D9A48e3aAc84097512cACD` | [View](https://sepolia.etherscan.io/address/0x543C4Fdb6dBB2BA4d9D9A48e3aAc84097512cACD) |
| General Coin    | MIAMI  | `0xC9CE6F4166E8a22bA1a17893F5F03b1B194a7e4c` | [View](https://sepolia.etherscan.io/address/0xC9CE6F4166E8a22bA1a17893F5F03b1B194a7e4c) |
| SimpleSwap DEX  | LP     | `0xE283FAbD3c29731a5B79dd08156221229BEA0E66` | [View](https://sepolia.etherscan.io/address/0xE283FAbD3c29731a5B79dd08156221229BEA0E66) |

---

## 📈 How It Works

### 1. Add Liquidity

Users call `addLiquidity()` with two ERC20 tokens. The contract determines the optimal amounts based on existing reserves and mints LP tokens.

### 2. Swap Tokens

Call `swapExactTokensForTokens()` to swap a specific input amount. The output is calculated via `getAmountOutInternal()` and transferred to the recipient.

### 3. Remove Liquidity

Users burn LP tokens via `removeLiquidity()` to retrieve their proportional share of both tokens.

---

## 🧠 Security Checks

- ✅ Deadline checks to prevent late transactions
- ✅ Ratio enforcement to maintain pool balance
- ✅ Reserve and amount validations
- ✅ Explicit reverts for transfer failures

---

## 📂 Interface: ISimpleSwap

The contract complies with a custom interface that standardizes all the swap and liquidity functions. This ensures compatibility with external dApps and verification tools.

---

## 🧪 Example Usage

1. **Add liquidity**:
```solidity
simpleSwap.addLiquidity(tokenA, tokenB, 1000, 1000, 900, 900, msg.sender, block.timestamp + 120);
```

2. **Swap tokens**:
```solidity
simpleSwap.swapExactTokensForTokens(1000, 900, [0x543C4Fdb6dBB2BA4d9D9A48e3aAc84097512cACD, 0xC9CE6F4166E8a22bA1a17893F5F03b1B194a7e4c], 0x183be2B201923C59802a28FF1c85f21Cebcff855, block.timestamp + 120);
```