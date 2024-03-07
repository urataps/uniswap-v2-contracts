import { expect } from "chai";
import { MaxUint256 } from "ethers";
import {
  DeflatingERC20,
  DeflatingERC20__factory,
  ERC20,
  UniswapV2Pair,
  UniswapV2Pair__factory,
  UniswapV2Router02,
  WrappedNative,
} from "../../../typechain";
import { expandTo18Decimals, getPermitSignature } from "../utils";
import { deployRouterFixture } from "./Router.fixture";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const MINIMUM_LIQUIDITY = 1000n;

describe("UniswapV2Router02", () => {
  let wallet: SignerWithAddress;

  let token0: ERC20;
  let token1: ERC20;
  let router: UniswapV2Router02;
  let token0Address: string;
  let token1Address: string;
  let routerAddress: string;

  beforeEach(async function () {
    [wallet] = await ethers.getSigners();
    const fixture = await loadFixture(deployRouterFixture);
    token0 = fixture.token0;
    token1 = fixture.token1;
    router = fixture.router02;

    token0Address = await token0.getAddress();
    token1Address = await token1.getAddress();
    routerAddress = await router.getAddress();
  });

  it("quote", async () => {
    expect(await router.quote(BigInt(1), BigInt(100), BigInt(200))).to.eq(
      BigInt(2)
    );
    expect(await router.quote(BigInt(2), BigInt(200), BigInt(100))).to.eq(
      BigInt(1)
    );
    await expect(
      router.quote(BigInt(0), BigInt(100), BigInt(200))
    ).to.be.revertedWith("INSUFFICIENT_AMOUNT");
    await expect(
      router.quote(BigInt(1), BigInt(0), BigInt(200))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
    await expect(
      router.quote(BigInt(1), BigInt(100), BigInt(0))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
  });

  it("getAmountOut", async () => {
    expect(
      await router.getAmountOut(BigInt(2), BigInt(100), BigInt(100))
    ).to.eq(BigInt(1));
    await expect(
      router.getAmountOut(BigInt(0), BigInt(100), BigInt(100))
    ).to.be.revertedWith("INSUFFICIENT_INPUT_AMOUNT");
    await expect(
      router.getAmountOut(BigInt(2), BigInt(0), BigInt(100))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
    await expect(
      router.getAmountOut(BigInt(2), BigInt(100), BigInt(0))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
  });

  it("getAmountIn", async () => {
    expect(await router.getAmountIn(BigInt(1), BigInt(100), BigInt(100))).to.eq(
      BigInt(2)
    );
    await expect(
      router.getAmountIn(BigInt(0), BigInt(100), BigInt(100))
    ).to.be.revertedWith("INSUFFICIENT_OUTPUT_AMOUNT");
    await expect(
      router.getAmountIn(BigInt(1), BigInt(0), BigInt(100))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
    await expect(
      router.getAmountIn(BigInt(1), BigInt(100), BigInt(0))
    ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
  });

  it("getAmountsOut", async () => {
    await token0.approve(routerAddress, MaxUint256);
    await token1.approve(routerAddress, MaxUint256);
    await router.addLiquidity(
      token0Address,
      token1Address,
      BigInt(10000),
      BigInt(10000),
      0,
      0,
      wallet.address,
      MaxUint256
    );

    await expect(
      router.getAmountsOut(BigInt(2), [token0Address])
    ).to.be.revertedWith("INVALID_PATH");
    const path = [token0Address, token1Address];
    expect(await router.getAmountsOut(BigInt(2), path)).to.deep.eq([
      BigInt(2),
      BigInt(1),
    ]);
  });

  it("getAmountsIn", async () => {
    await token0.approve(routerAddress, MaxUint256);
    await token1.approve(routerAddress, MaxUint256);
    await router.addLiquidity(
      token0Address,
      token1Address,
      BigInt(10000),
      BigInt(10000),
      0,
      0,
      wallet.address,
      MaxUint256
    );

    await expect(
      router.getAmountsIn(BigInt(1), [token0Address])
    ).to.be.revertedWith("INVALID_PATH");
    const path = [token0Address, token1Address];
    expect(await router.getAmountsIn(BigInt(1), path)).to.deep.eq([
      BigInt(2),
      BigInt(1),
    ]);
  });
});

describe("fee-on-transfer tokens", () => {
  let wallet: SignerWithAddress;

  let DTT: DeflatingERC20;
  let WETH: WrappedNative;
  let router: UniswapV2Router02;
  let pair: UniswapV2Pair;
  let DTTAddress: string;
  let WETHAddress: string;
  let routerAddress: string;
  let pairAddress: string;

  beforeEach(async function () {
    [wallet] = await ethers.getSigners();
    const fixture = await loadFixture(deployRouterFixture);

    WETH = fixture.WETH;
    router = fixture.router02;
    const factory = fixture.factory;

    DTT = await new DeflatingERC20__factory(wallet).deploy(
      expandTo18Decimals(10000)
    );
    DTTAddress = await DTT.getAddress();
    WETHAddress = await WETH.getAddress();
    routerAddress = await router.getAddress();

    await factory.createPair(DTTAddress, WETHAddress);
    pairAddress = await factory.getPair(DTTAddress, WETHAddress);
    pair = UniswapV2Pair__factory.connect(pairAddress, wallet);
  });

  afterEach(async function () {
    expect(await wallet.provider.getBalance(routerAddress)).to.eq(0);
  });

  async function addLiquidity(DTTAmount: bigint, WETHAmount: bigint) {
    await DTT.approve(routerAddress, MaxUint256);
    await router.addLiquidityETH(
      DTTAddress,
      DTTAmount,
      DTTAmount,
      WETHAmount,
      wallet.address,
      MaxUint256,
      {
        value: WETHAmount,
      }
    );
  }

  it("removeLiquidityETHSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = expandTo18Decimals(1);
    const ETHAmount = expandTo18Decimals(4);
    await addLiquidity(DTTAmount, ETHAmount);

    const DTTInPair = await DTT.balanceOf(pairAddress);
    const WETHInPair = await WETH.balanceOf(pairAddress);
    const liquidity = await pair.balanceOf(wallet.address);
    const totalSupply = await pair.totalSupply();
    const NaiveDTTExpected = (DTTInPair * liquidity) / totalSupply;
    const WETHExpected = (WETHInPair * liquidity) / totalSupply;

    await pair.approve(routerAddress, MaxUint256);
    await router.removeLiquidityETHSupportingFeeOnTransferTokens(
      DTTAddress,
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      wallet.address,
      MaxUint256
    );
  });

  it("removeLiquidityETHWithPermitSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(1) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(4);
    await addLiquidity(DTTAmount, ETHAmount);

    const expectedLiquidity = expandTo18Decimals(2);

    const nonce = await pair.nonces(wallet.address);
    const { v, r, s } = await getPermitSignature(
      wallet,
      pair,
      {
        owner: wallet.address,
        spender: routerAddress,
        value: expectedLiquidity - MINIMUM_LIQUIDITY,
      },
      nonce,
      MaxUint256
    );

    const DTTInPair = await DTT.balanceOf(pairAddress);
    const WETHInPair = await WETH.balanceOf(pairAddress);
    const liquidity = await pair.balanceOf(wallet.address);
    const totalSupply = await pair.totalSupply();
    const NaiveDTTExpected = (DTTInPair * liquidity) / totalSupply;
    const WETHExpected = (WETHInPair * liquidity) / totalSupply;

    await pair.approve(routerAddress, MaxUint256);
    await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
      DTTAddress,
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      wallet.address,
      MaxUint256,
      false,
      v,
      r,
      s
    );
  });

  describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(10);
    const amountIn = expandTo18Decimals(1);

    beforeEach(async () => {
      await addLiquidity(DTTAmount, ETHAmount);
    });

    it("DTT -> WETH", async () => {
      await DTT.approve(routerAddress, MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTTAddress, WETHAddress],
        wallet.address,
        MaxUint256
      );
    });

    // WETH -> DTT
    it("WETH -> DTT", async () => {
      await WETH.deposit({ value: amountIn }); // mint WETH
      await WETH.approve(routerAddress, MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [WETHAddress, DTTAddress],
        wallet.address,
        MaxUint256
      );
    });
  });

  // ETH -> DTT
  it("swapExactETHForTokensSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(10) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(5);
    const swapAmount = expandTo18Decimals(1);
    await addLiquidity(DTTAmount, ETHAmount);

    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [WETHAddress, DTTAddress],
      wallet.address,
      MaxUint256,
      {
        value: swapAmount,
      }
    );
  });

  // DTT -> ETH
  it("swapExactTokensForETHSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);

    await addLiquidity(DTTAmount, ETHAmount);
    await DTT.approve(routerAddress, MaxUint256);

    await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      swapAmount,
      0,
      [DTTAddress, WETHAddress],
      wallet.address,
      MaxUint256
    );
  });
});

describe("fee-on-transfer tokens: reloaded", () => {
  let wallet: SignerWithAddress;

  let DTT: DeflatingERC20;
  let DTT2: DeflatingERC20;
  let router: UniswapV2Router02;
  let DTTAddress: string;
  let DTT2Address: string;
  let routerAddress: string;

  beforeEach(async function () {
    [wallet] = await ethers.getSigners();
    const fixture = await loadFixture(deployRouterFixture);

    router = fixture.router02;

    DTT = await new DeflatingERC20__factory(wallet).deploy(
      expandTo18Decimals(10000)
    );
    DTT2 = await new DeflatingERC20__factory(wallet).deploy(
      expandTo18Decimals(10000)
    );

    DTTAddress = await DTT.getAddress();
    DTT2Address = await DTT2.getAddress();
    routerAddress = await router.getAddress();

    const factory = fixture.factory;
    // make a DTT<>WETH pair
    await factory.createPair(DTTAddress, DTT2Address);
  });

  afterEach(async function () {
    expect(await wallet.provider.getBalance(routerAddress)).to.eq(0);
  });

  async function addLiquidity(DTTAmount: bigint, DTT2Amount: bigint) {
    await DTT.approve(routerAddress, MaxUint256);
    await DTT2.approve(routerAddress, MaxUint256);
    await router.addLiquidity(
      DTTAddress,
      DTT2Address,
      DTTAmount,
      DTT2Amount,
      DTTAmount,
      DTT2Amount,
      wallet.address,
      MaxUint256
    );
  }

  describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const DTT2Amount = expandTo18Decimals(5);
    const amountIn = expandTo18Decimals(1);

    beforeEach(async () => {
      await addLiquidity(DTTAmount, DTT2Amount);
    });

    it("DTT -> DTT2", async () => {
      await DTT.approve(routerAddress, MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTTAddress, DTT2Address],
        wallet.address,
        MaxUint256
      );
    });
  });
});
