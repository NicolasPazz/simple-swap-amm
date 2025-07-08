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

    it("should revert with zero address", async () => {
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        throw new Error("No block data available");
      }
      const deadline = block.timestamp + 1000;

      await expect(
        swap.addLiquidity(tokenA.target, ethers.ZeroAddress, 1, 1, 0, 0, await owner.getAddress(), deadline),
      ).to.be.revertedWith("SimpleSwap: ZERO_ADDRESS");
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

    it("should revert if min amounts not met", async () => {
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

      await expect(
        swap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          lp,
          ethers.parseEther("0.11"),
          0,
          await owner.getAddress(),
          deadline,
        ),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("should revert with zero address", async () => {
      await expect(
        swap.removeLiquidity(
          ethers.ZeroAddress,
          tokenB.target,
          1,
          0,
          0,
          await owner.getAddress(),
          Date.now() + 1000,
        ),
      ).to.be.revertedWith("SimpleSwap: ZERO_ADDRESS");
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

    it("should revert if expected output too high", async () => {
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

      await expect(
        swap
          .connect(user)
          .swapExactTokensForTokens(
            ethers.parseEther("0.01"),
            ethers.parseEther("0.02"),
            [tokenA.target, tokenB.target],
            await user.getAddress(),
            deadline,
          ),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("should revert with invalid path", async () => {
      await expect(
        swap.swapExactTokensForTokens(100, 0, [tokenA.target], await owner.getAddress(), Date.now() + 1000),
      ).to.be.revertedWith("SimpleSwap: INVALID_PATH");
    });

    it("should revert with zero address", async () => {
      await expect(
        swap.swapExactTokensForTokens(
          100,
          0,
          [tokenA.target, ethers.ZeroAddress],
          await owner.getAddress(),
          Date.now() + 1000,
        ),
      ).to.be.revertedWith("SimpleSwap: ZERO_ADDRESS");
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

  describe("internal helpers", () => {
    it("sqrt handles edge cases", async () => {
      const Wrapper = await ethers.getContractFactory("SimpleSwapWrapper");
      const helper = await Wrapper.deploy();
      expect(await helper.exposeSqrt(0)).to.equal(0n);
      expect(await helper.exposeSqrt(1)).to.equal(1n);
      expect(await helper.exposeSqrt(4)).to.equal(2n);
      expect(await helper.exposeSqrt(16)).to.equal(4n);
    });

    it("min returns smallest value", async () => {
      const Wrapper = await ethers.getContractFactory("SimpleSwapWrapper");
      const helper = await Wrapper.deploy();
      expect(await helper.exposeMin(1, 2)).to.equal(1n);
      expect(await helper.exposeMin(5, 2)).to.equal(2n);
      expect(await helper.exposeMin(3, 3)).to.equal(3n);
    });

    it("getAmountOutInternal matches external call", async () => {
      const Wrapper = await ethers.getContractFactory("SimpleSwapWrapper");
      const helper = await Wrapper.deploy();
      const inner = await helper.exposeGetAmountOutInternal(1000, 1000, 2000);
      const ext = await swap.getAmountOut(1000, 1000, 2000);
      expect(inner).to.equal(ext);
    });

    it("getAmountOutInternal reverts with bad params", async () => {
      const Wrapper = await ethers.getContractFactory("SimpleSwapWrapper");
      const helper = await Wrapper.deploy();
      await expect(
        helper.exposeGetAmountOutInternal(0, 1, 1),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_INPUT_AMOUNT");
      await expect(
        helper.exposeGetAmountOutInternal(1, 0, 1),
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_LIQUIDITY");
    });
  });
});
