import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { TokenFactory, SimpleSwap } from "../typechain-types";

describe("SimpleSwap", function () {
  let owner: Signer;
  let user: Signer;
  let tokenA: TokenFactory;
  let tokenB: TokenFactory;
  let swap: SimpleSwap;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenA = await TokenFactory.deploy("Token A", "TKA", 1);
    tokenB = await TokenFactory.deploy("Token B", "TKB", 1);

    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    swap = await SimpleSwap.deploy();

    // Approve tokens from owner to swap contract
    await tokenA.approve(swap.target, ethers.MaxUint256);
    await tokenB.approve(swap.target, ethers.MaxUint256);
  });

  describe("addLiquidity", () => {
    it("should add initial liquidity and mint LP tokens", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      const tx = await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      const receipt = await tx.wait();
      if (!receipt) throw new Error("No receipt");

      const event = receipt.logs
        .map(log => {
          try {
            return swap.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(parsed => parsed?.name === "LiquidityAdded");

      if (!event || !event.args) {
        throw new Error("LiquidityAdded event not found");
      }

      expect(event.args.liquidity).to.be.gt(0n);
    });

    it("should revert with expired deadline", async () => {
      await expect(
        swap.addLiquidity(tokenA.target, tokenB.target, 1000, 1000, 0, 0, await owner.getAddress(), 1),
      ).to.be.revertedWith("SimpleSwap: EXPIRED");
    });

    it("should revert with identical token addresses", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await expect(
        swap.addLiquidity(tokenA.target, tokenA.target, 1000, 1000, 0, 0, await owner.getAddress(), deadline),
      ).to.be.revertedWith("SimpleSwap: IDENTICAL_ADDRESSES");
    });

    it("should calculate optimal amounts on second liquidity add", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.05"),
        ethers.parseEther("0.1"),
        ethers.parseEther("0.049"),
        ethers.parseEther("0.099"),
        await owner.getAddress(),
        deadline,
      );
    });

    it("should revert with insufficient A or B", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      await expect(
        swap.addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("0.01"),
          ethers.parseEther("0.1"),
          ethers.parseEther("0.02"),
          ethers.parseEther("0.09"),
          await owner.getAddress(),
          deadline,
        ),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_A_OR_B");
    });
  });

  describe("removeLiquidity", () => {
    it("should remove liquidity and return tokens", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      const lp = await swap.balanceOf(await owner.getAddress());

      await swap.removeLiquidity(tokenA.target, tokenB.target, lp, 0, 0, await owner.getAddress(), deadline);
    });

    it("should revert if user has no liquidity", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await expect(
        swap.removeLiquidity(tokenA.target, tokenB.target, 1000, 0, 0, await owner.getAddress(), deadline),
      ).to.be.revertedWith("SimpleSwap: NOT_ENOUGH_USER_LIQUIDITY");
    });
  });

  describe("swapExactTokensForTokens", () => {
    it("should perform a token swap", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      await tokenA.transfer(await user.getAddress(), ethers.parseEther("0.01"));
      await tokenA.connect(user).approve(swap.target, ethers.MaxUint256);

      await swap
        .connect(user)
        .swapExactTokensForTokens(
          ethers.parseEther("0.01"),
          0,
          [tokenA.target, tokenB.target],
          await user.getAddress(),
          deadline,
        );
    });

    it("should revert with invalid path", async () => {
      await expect(
        swap.swapExactTokensForTokens(100, 0, [tokenA.target], await owner.getAddress(), Date.now() + 1000),
      ).to.be.revertedWith("SimpleSwap: INVALID_PATH");
    });

    it("should revert if no liquidity", async () => {
      await expect(
        swap.swapExactTokensForTokens(
          100,
          0,
          [tokenA.target, tokenB.target],
          await owner.getAddress(),
          Date.now() + 1000,
        ),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_LIQUIDITY");
    });
  });

  describe("getPrice", () => {
    it("should return correct price", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await swap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.002"),
        ethers.parseEther("0.01"),
        0,
        0,
        await owner.getAddress(),
        deadline,
      );

      const price = await swap.getPrice(tokenA.target, tokenB.target);
      expect(price).to.equal(ethers.parseUnits("5", 18)); // 10 / 2
    });

    it("should revert if no liquidity", async () => {
      await expect(swap.getPrice(tokenA.target, tokenB.target)).to.be.revertedWith("SimpleSwap: NO_LIQUIDITY");
    });
  });

  describe("getAmountOut", () => {
    it("should calculate correct amountOut", async () => {
      const out = await swap.getAmountOut(1000, 1000, 2000);
      expect(out).to.equal(ethers.toBigInt(Math.floor((1000 * 2000) / (1000 + 1000))));
    });
  });
});