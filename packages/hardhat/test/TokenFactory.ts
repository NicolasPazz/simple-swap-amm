import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { TokenFactory } from "../typechain-types";

describe("TokenFactory", function () {
  let token: TokenFactory;

  const NAME = "My Token";
  const SYMBOL = "MTK";
  const INITIAL_MINT = 1000;

  beforeEach(async () => {
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    token = await TokenFactory.deploy(NAME, SYMBOL, INITIAL_MINT);
    await token.waitForDeployment();
  });

  it("should have correct name and symbol", async () => {
    expect(await token.name()).to.equal(NAME);
    expect(await token.symbol()).to.equal(SYMBOL);
  });

  it("should mint initial supply to deployer", async () => {
    const [deployer] = await ethers.getSigners();
    const expectedSupply = ethers.parseUnits(INITIAL_MINT.toString(), 18);
    expect(await token.totalSupply()).to.equal(expectedSupply);
    expect(await token.balanceOf(await deployer.getAddress())).to.equal(expectedSupply);
  });

  it("should allow minting new tokens", async () => {
    const [deployer] = await ethers.getSigners();
    const mintAmount = 500;
    const expectedMint = ethers.parseUnits(mintAmount.toString(), 18);

    await token.mint(mintAmount);

    const newBalance = await token.balanceOf(await deployer.getAddress());
    const newSupply = await token.totalSupply();

    expect(newBalance).to.equal(expectedMint + ethers.parseUnits(INITIAL_MINT.toString(), 18));
    expect(newSupply).to.equal(expectedMint + ethers.parseUnits(INITIAL_MINT.toString(), 18));
  });

  it("should handle multiple mints correctly", async () => {
    const mintAmounts = [100, 200, 300];
    let total = ethers.parseUnits(INITIAL_MINT.toString(), 18);

    for (const amt of mintAmounts) {
      await token.mint(amt);
      total += ethers.parseUnits(amt.toString(), 18);
    }

    const [deployer] = await ethers.getSigners();
    expect(await token.totalSupply()).to.equal(total);
    expect(await token.balanceOf(await deployer.getAddress())).to.equal(total);
  });

  it("should respect decimals of 18", async () => {
    expect(await token.decimals()).to.equal(18);
  });
});