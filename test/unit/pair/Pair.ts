import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { MockERC20, UniswapV2Factory, UniswapV2Pair } from "../../../typechain";
import { deployPairFixture } from "./Pair.fixture";
import { expect } from "chai";
import { encodePrice, expandTo18Decimals } from "../utils";
import { ZeroAddress } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const MINIMUM_LIQUIDITY = 10n ** 3n;

describe("Pair", () => {
  let wallet: SignerWithAddress;
  let other: SignerWithAddress;

  let factory: UniswapV2Factory;
  let factoryAddress: string;

  let pair: UniswapV2Pair;
  let pairAddress: string;

  let token0: MockERC20;
  let token0Address: string;

  let token1: MockERC20;
  let token1Address: string;

  beforeEach(async () => {
    [wallet, other] = await ethers.getSigners();
    const fixture = await loadFixture(deployPairFixture);
    factory = fixture.factory;
    pair = fixture.pair;
    token0 = fixture.token0;
    token1 = fixture.token1;
    factoryAddress = await factory.getAddress();
    pairAddress = await pair.getAddress();
    token0Address = await token0.getAddress();
    token1Address = await token1.getAddress();
  });

  it("mint", async () => {
    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    await token0.transfer(pairAddress, token0Amount);
    await token1.transfer(pairAddress, token1Amount);

    const expectedLiquidity = expandTo18Decimals(2);
    await expect(pair.mint(wallet.address))
      .to.emit(pair, "Transfer")
      .withArgs(ZeroAddress, ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(pair, "Transfer")
      .withArgs(
        ZeroAddress,
        wallet.address,
        expectedLiquidity - MINIMUM_LIQUIDITY
      )
      .to.emit(pair, "Sync")
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, "Mint")
      .withArgs(wallet.address, token0Amount, token1Amount);

    expect(await pair.totalSupply()).to.eq(expectedLiquidity);
    expect(await pair.balanceOf(wallet.address)).to.eq(
      expectedLiquidity - MINIMUM_LIQUIDITY
    );
    expect(await token0.balanceOf(pairAddress)).to.eq(token0Amount);
    expect(await token1.balanceOf(pairAddress)).to.eq(token1Amount);
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.eq(token0Amount);
    expect(reserves[1]).to.eq(token1Amount);
  });

  async function addLiquidity(token0Amount: bigint, token1Amount: bigint) {
    await token0.transfer(pairAddress, token0Amount);
    await token1.transfer(pairAddress, token1Amount);
    await pair.mint(wallet.address);
  }

  const swapTestCases: bigint[][] = [
    [1, 5, 10, "1662497915624478906"],
    [1, 10, 5, "453305446940074565"],

    [2, 5, 10, "2851015155847869602"],
    [2, 10, 5, "831248957812239453"],

    [1, 10, 10, "906610893880149131"],
    [1, 100, 100, "987158034397061298"],
    [1, 1000, 1000, "996006981039903216"],
  ].map((a) =>
    a.map((n) => (typeof n === "string" ? BigInt(n) : expandTo18Decimals(n)))
  );

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] =
        swapTestCase;
      await addLiquidity(token0Amount, token1Amount);
      await token0.transfer(pairAddress, swapAmount);
      await expect(
        pair.swap(0, expectedOutputAmount + 1n, wallet.address, "0x")
      ).to.be.revertedWith("K");
      await pair.swap(0, expectedOutputAmount, wallet.address, "0x");
    });
  });

  const optimisticTestCases: bigint[][] = [
    ["997000000000000000", 5, 10, 1], // given amountIn, amountOut = floor(amountIn * .997)
    ["997000000000000000", 10, 5, 1],
    ["997000000000000000", 5, 5, 1],
    [1, 5, 5, "1003009027081243732"], // given amountOut, amountIn = ceiling(amountOut / .997)
  ].map((a) =>
    a.map((n) => (typeof n === "string" ? BigInt(n) : expandTo18Decimals(n)))
  );
  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      const [outputAmount, token0Amount, token1Amount, inputAmount] =
        optimisticTestCase;
      await addLiquidity(token0Amount, token1Amount);
      await token0.transfer(pairAddress, inputAmount);
      await expect(
        pair.swap(outputAmount + 1n, 0, wallet.address, "0x")
      ).to.be.revertedWith("K");
      await pair.swap(outputAmount, 0, wallet.address, "0x");
    });
  });

  it("swap:token0", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("1662497915624478906");
    await token0.transfer(pairAddress, swapAmount);
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, "0x"))
      .to.emit(token1, "Transfer")
      .withArgs(pairAddress, wallet.address, expectedOutputAmount)
      .to.emit(pair, "Sync")
      .withArgs(token0Amount + swapAmount, token1Amount - expectedOutputAmount)
      .to.emit(pair, "Swap")
      .withArgs(
        wallet.address,
        swapAmount,
        0,
        0,
        expectedOutputAmount,
        wallet.address
      );

    const reserves = await pair.getReserves();
    expect(reserves[0]).to.eq(token0Amount + swapAmount);
    expect(reserves[1]).to.eq(token1Amount - expectedOutputAmount);
    expect(await token0.balanceOf(pairAddress)).to.eq(
      token0Amount + swapAmount
    );
    expect(await token1.balanceOf(pairAddress)).to.eq(
      token1Amount - expectedOutputAmount
    );
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount - swapAmount
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount + expectedOutputAmount
    );
  });

  it("swap:token1", async () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("453305446940074565");
    await token1.transfer(pairAddress, swapAmount);
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, "0x"))
      .to.emit(token0, "Transfer")
      .withArgs(pairAddress, wallet.address, expectedOutputAmount)
      .to.emit(pair, "Sync")
      .withArgs(token0Amount - expectedOutputAmount, token1Amount + swapAmount)
      .to.emit(pair, "Swap")
      .withArgs(
        wallet.address,
        0,
        swapAmount,
        expectedOutputAmount,
        0,
        wallet.address
      );

    const reserves = await pair.getReserves();
    expect(reserves[0]).to.eq(token0Amount - expectedOutputAmount);
    expect(reserves[1]).to.eq(token1Amount + swapAmount);
    expect(await token0.balanceOf(pairAddress)).to.eq(
      token0Amount - expectedOutputAmount
    );
    expect(await token1.balanceOf(pairAddress)).to.eq(
      token1Amount + swapAmount
    );
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount + expectedOutputAmount
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount - swapAmount
    );
  });

  it("burn", async () => {
    const token0Amount = expandTo18Decimals(3);
    const token1Amount = expandTo18Decimals(3);
    await addLiquidity(token0Amount, token1Amount);

    const expectedLiquidity = expandTo18Decimals(3);
    await pair.transfer(pairAddress, expectedLiquidity - MINIMUM_LIQUIDITY);
    await expect(pair.burn(wallet.address))
      .to.emit(pair, "Transfer")
      .withArgs(pairAddress, ZeroAddress, expectedLiquidity - MINIMUM_LIQUIDITY)
      .to.emit(token0, "Transfer")
      .withArgs(pairAddress, wallet.address, token0Amount - 1000n)
      .to.emit(token1, "Transfer")
      .withArgs(pairAddress, wallet.address, token1Amount - 1000n)
      .to.emit(pair, "Sync")
      .withArgs(1000, 1000)
      .to.emit(pair, "Burn")
      .withArgs(
        wallet.address,
        token0Amount - 1000n,
        token1Amount - 1000n,
        wallet.address
      );

    expect(await pair.balanceOf(wallet.address)).to.eq(0);
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
    expect(await token0.balanceOf(pairAddress)).to.eq(1000);
    expect(await token1.balanceOf(pairAddress)).to.eq(1000);
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - 1000n
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - 1000n
    );
  });

  it("price{0,1}CumulativeLast", async () => {
    const token0Amount = expandTo18Decimals(3);
    const token1Amount = expandTo18Decimals(3);
    await addLiquidity(token0Amount, token1Amount);

    const blockTimestamp = (await pair.getReserves())[2];
    await time.setNextBlockTimestamp(blockTimestamp + 1n);
    await pair.sync();

    const initialPrice = encodePrice(token0Amount, token1Amount);
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 1n);
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0]);
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1]);

    const swapAmount = expandTo18Decimals(3);
    await token0.transfer(pairAddress, swapAmount);
    await time.setNextBlockTimestamp(blockTimestamp + 10n);
    // swap to a new price eagerly instead of syncing
    await pair.swap(0, expandTo18Decimals(1), wallet.address, "0x"); // make the price nice

    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 10n);
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0] * 10n);
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1] * 10n);

    await time.setNextBlockTimestamp(blockTimestamp + 20n);
    await pair.sync();

    const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2));
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 20n);
    expect(await pair.price0CumulativeLast()).to.eq(
      initialPrice[0] * 10n + newPrice[0] * 10n
    );
    expect(await pair.price1CumulativeLast()).to.eq(
      initialPrice[1] * 10n + newPrice[1] * 10n
    );
  });

  it("feeTo:off", async () => {
    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = expandTo18Decimals(1000);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    await token1.transfer(pairAddress, swapAmount);
    await pair.swap(996006981039903216n, 0, wallet.address, "0x");

    const expectedLiquidity = expandTo18Decimals(1000);
    await pair.transfer(pairAddress, expectedLiquidity - MINIMUM_LIQUIDITY);
    await pair.burn(wallet.address);
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
  });

  it("feeTo:on", async () => {
    await factory.setFeeTo(other.address);

    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = expandTo18Decimals(1000);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    await token1.transfer(pairAddress, swapAmount);
    await pair.swap(996006981039903216n, 0, wallet.address, "0x");

    const expectedLiquidity = expandTo18Decimals(1000);
    await pair.transfer(pairAddress, expectedLiquidity - MINIMUM_LIQUIDITY);
    await pair.burn(wallet.address);
    expect(await pair.totalSupply()).to.eq(
      MINIMUM_LIQUIDITY + 249750499251388n
    );
    expect(await pair.balanceOf(other.address)).to.eq(249750499251388n);

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect(await token0.balanceOf(pairAddress)).to.eq(1000n + 249501683697445n);
    expect(await token1.balanceOf(pairAddress)).to.eq(1000n + 250000187312969n);
  });
});
