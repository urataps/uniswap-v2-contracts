import { expect } from "chai";
import { MaxUint256, ZeroAddress } from "ethers";
import { expandTo18Decimals, getPermitSignature } from "../utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployRouterFixture } from "./Router.fixture";
import {
  MockERC20,
  RouterEventEmitter,
  UniswapV2Factory,
  UniswapV2Pair,
  UniswapV2Router01,
  UniswapV2Router02,
  WrappedNative,
} from "../../../typechain";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

enum RouterVersion {
  UniswapV2Router01 = "UniswapV2Router01",
  UniswapV2Router02 = "UniswapV2Router02",
}

const MINIMUM_LIQUIDITY = 1000n;

describe("UniswapV2Router{01,02}", () => {
  for (const routerVersion of Object.keys(RouterVersion)) {
    let wallet: SignerWithAddress;

    let token0: MockERC20;
    let token1: MockERC20;
    let WETH: WrappedNative;
    let WETHPartner: MockERC20;
    let factory: UniswapV2Factory;
    let router: UniswapV2Router01 | UniswapV2Router02;
    let pair: UniswapV2Pair;
    let WETHPair: UniswapV2Pair;
    let routerEventEmitter: RouterEventEmitter;

    let token0Address: string;
    let token1Address: string;
    let WETHAddress: string;
    let WETHPartnerAddress: string;
    let factoryAddress: string;
    let routerAddress: string;
    let pairAddress: string;
    let WETHPairAddress: string;
    let routerEventEmitterAddress: string;

    beforeEach(async function () {
      [wallet] = await ethers.getSigners();
      const fixture = await loadFixture(deployRouterFixture);
      token0 = fixture.token0;
      token1 = fixture.token1;
      WETH = fixture.WETH;
      WETHPartner = fixture.WETHPartner;
      factory = fixture.factory;
      router = {
        [RouterVersion.UniswapV2Router01]: fixture.router01,
        [RouterVersion.UniswapV2Router02]: fixture.router02,
      }[routerVersion as RouterVersion];
      pair = fixture.pair;
      WETHPair = fixture.WETHPair;
      routerEventEmitter = fixture.routerEventEmitter;

      token0Address = await token0.getAddress();
      token1Address = await token1.getAddress();
      WETHAddress = await WETH.getAddress();
      WETHPartnerAddress = await WETHPartner.getAddress();
      factoryAddress = await factory.getAddress();
      routerAddress = await router.getAddress();
      pairAddress = await pair.getAddress();
      WETHPairAddress = await WETHPair.getAddress();
      routerEventEmitterAddress = await routerEventEmitter.getAddress();
    });

    afterEach(async function () {
      expect(await ethers.provider.getBalance(routerAddress)).to.eq(0);
    });

    describe(routerVersion, () => {
      it("factory, WETH", async () => {
        expect(await router.factory()).to.eq(factoryAddress);
        expect(await router.WETH()).to.eq(WETHAddress);
      });

      it("addLiquidity", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);

        const expectedLiquidity = expandTo18Decimals(2);
        await token0.approve(routerAddress, MaxUint256);
        await token1.approve(routerAddress, MaxUint256);
        await expect(
          router.addLiquidity(
            token0Address,
            token1Address,
            token0Amount,
            token1Amount,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(wallet.address, pairAddress, token0Amount)
          .to.emit(token1, "Transfer")
          .withArgs(wallet.address, pairAddress, token1Amount)
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
          .withArgs(routerAddress, token0Amount, token1Amount);

        expect(await pair.balanceOf(wallet.address)).to.eq(
          expectedLiquidity - MINIMUM_LIQUIDITY
        );
      });

      it("addLiquidityETH", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);

        const expectedLiquidity = expandTo18Decimals(2);
        const WETHPairToken0 = await WETHPair.token0();
        await WETHPartner.approve(routerAddress, MaxUint256);
        await expect(
          router.addLiquidityETH(
            WETHPartnerAddress,
            WETHPartnerAmount,
            WETHPartnerAmount,
            ETHAmount,
            wallet.address,
            MaxUint256,
            { value: ETHAmount }
          )
        )
          .to.emit(WETHPair, "Transfer")
          .withArgs(ZeroAddress, ZeroAddress, MINIMUM_LIQUIDITY)
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            ZeroAddress,
            wallet.address,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartnerAddress
              ? WETHPartnerAmount
              : ETHAmount,
            WETHPairToken0 === WETHPartnerAddress
              ? ETHAmount
              : WETHPartnerAmount
          )
          .to.emit(WETHPair, "Mint")
          .withArgs(
            routerAddress,
            WETHPairToken0 === WETHPartnerAddress
              ? WETHPartnerAmount
              : ETHAmount,
            WETHPairToken0 === WETHPartnerAddress
              ? ETHAmount
              : WETHPartnerAmount
          );

        expect(await WETHPair.balanceOf(wallet.address)).to.eq(
          expectedLiquidity - MINIMUM_LIQUIDITY
        );
      });

      async function addLiquidity(token0Amount: bigint, token1Amount: bigint) {
        await token0.transfer(pairAddress, token0Amount);
        await token1.transfer(pairAddress, token1Amount);
        await pair.mint(wallet.address);
      }
      it("removeLiquidity", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);
        await addLiquidity(token0Amount, token1Amount);

        const expectedLiquidity = expandTo18Decimals(2);
        await pair.approve(routerAddress, MaxUint256);
        await expect(
          router.removeLiquidity(
            token0Address,
            token1Address,
            expectedLiquidity - MINIMUM_LIQUIDITY,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
          .to.emit(pair, "Transfer")
          .withArgs(
            wallet.address,
            pairAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(pair, "Transfer")
          .withArgs(
            pairAddress,
            ZeroAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(token0, "Transfer")
          .withArgs(pairAddress, wallet.address, token0Amount - 500n)
          .to.emit(token1, "Transfer")
          .withArgs(pairAddress, wallet.address, token1Amount - 2000n)
          .to.emit(pair, "Sync")
          .withArgs(500n, 2000n)
          .to.emit(pair, "Burn")
          .withArgs(
            routerAddress,
            token0Amount - 500n,
            token1Amount - 2000n,
            wallet.address
          );

        expect(await pair.balanceOf(wallet.address)).to.eq(0);
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
          totalSupplyToken0 - 500n
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
          totalSupplyToken1 - 2000n
        );
      });

      it("removeLiquidityETH", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);
        await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPairAddress, ETHAmount);
        await WETHPair.mint(wallet.address);

        const expectedLiquidity = expandTo18Decimals(2);
        const WETHPairToken0 = await WETHPair.token0();
        await WETHPair.approve(routerAddress, MaxUint256);
        await expect(
          router.removeLiquidityETH(
            WETHPartnerAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            wallet.address,
            WETHPairAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            WETHPairAddress,
            ZeroAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPairAddress, routerAddress, ETHAmount - 2000n)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPairAddress, routerAddress, WETHPartnerAmount - 500n)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(routerAddress, wallet.address, WETHPartnerAmount - 500n)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartnerAddress ? 500n : 2000n,
            WETHPairToken0 === WETHPartnerAddress ? 2000n : 500n
          )
          .to.emit(WETHPair, "Burn")
          .withArgs(
            routerAddress,
            WETHPairToken0 === WETHPartnerAddress
              ? WETHPartnerAmount - 500n
              : ETHAmount - 2000n,
            WETHPairToken0 === WETHPartnerAddress
              ? ETHAmount - 2000n
              : WETHPartnerAmount - 500n,
            routerAddress
          );

        expect(await WETHPair.balanceOf(wallet.address)).to.eq(0);
        const totalSupplyWETHPartner = await WETHPartner.totalSupply();
        const totalSupplyWETH = await WETH.totalSupply();
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(
          totalSupplyWETHPartner - 500n
        );
        expect(await WETH.balanceOf(wallet.address)).to.eq(
          totalSupplyWETH - 2000n
        );
      });

      it("removeLiquidityWithPermit", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);
        await addLiquidity(token0Amount, token1Amount);

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

        await router.removeLiquidityWithPermit(
          token0Address,
          token1Address,
          expectedLiquidity - MINIMUM_LIQUIDITY,
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s
        );
      });

      it("removeLiquidityETHWithPermit", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);
        await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPairAddress, ETHAmount);
        await WETHPair.mint(wallet.address);

        const expectedLiquidity = expandTo18Decimals(2);

        const nonce = await WETHPair.nonces(wallet.address);

        const { v, r, s } = await getPermitSignature(
          wallet,
          WETHPair,
          {
            owner: wallet.address,
            spender: routerAddress,
            value: expectedLiquidity - MINIMUM_LIQUIDITY,
          },
          nonce,
          MaxUint256
        );

        await router.removeLiquidityETHWithPermit(
          WETHPartnerAddress,
          expectedLiquidity - MINIMUM_LIQUIDITY,
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s
        );
      });

      describe("swapExactTokensForTokens", () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = BigInt("1662497915624478906");

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount);
          await token0.approve(routerAddress, MaxUint256);
        });

        it("happy path", async () => {
          await expect(
            router.swapExactTokensForTokens(
              swapAmount,
              0,
              [token0Address, token1Address],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(token0, "Transfer")
            .withArgs(wallet.address, pairAddress, swapAmount)
            .to.emit(token1, "Transfer")
            .withArgs(pairAddress, wallet.address, expectedOutputAmount)
            .to.emit(pair, "Sync")
            .withArgs(
              token0Amount + swapAmount,
              token1Amount - expectedOutputAmount
            )
            .to.emit(pair, "Swap")
            .withArgs(
              routerAddress,
              swapAmount,
              0,
              0,
              expectedOutputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await token0.approve(routerEventEmitterAddress, MaxUint256);
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              routerAddress,
              swapAmount,
              0,
              [token0Address, token1Address],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapTokensForExactTokens", () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        const expectedSwapAmount = BigInt("557227237267357629");
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount);
        });

        it("happy path", async () => {
          await token0.approve(routerAddress, MaxUint256);
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [token0Address, token1Address],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(token0, "Transfer")
            .withArgs(wallet.address, pairAddress, expectedSwapAmount)
            .to.emit(token1, "Transfer")
            .withArgs(pairAddress, wallet.address, outputAmount)
            .to.emit(pair, "Sync")
            .withArgs(
              token0Amount + expectedSwapAmount,
              token1Amount - outputAmount
            )
            .to.emit(pair, "Swap")
            .withArgs(
              routerAddress,
              expectedSwapAmount,
              0,
              0,
              outputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await token0.approve(routerEventEmitterAddress, MaxUint256);
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              routerAddress,
              outputAmount,
              MaxUint256,
              [token0Address, token1Address],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });

      describe("swapExactETHForTokens", () => {
        const WETHPartnerAmount = expandTo18Decimals(10);
        const ETHAmount = expandTo18Decimals(5);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = BigInt("1662497915624478906");

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(WETHPairAddress, ETHAmount);
          await WETHPair.mint(wallet.address);

          await token0.approve(routerAddress, MaxUint256);
        });

        it("happy path", async () => {
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapExactETHForTokens(
              0,
              [WETHAddress, WETHPartnerAddress],
              wallet.address,
              MaxUint256,
              {
                value: swapAmount,
              }
            )
          )
            .to.emit(WETH, "Transfer")
            .withArgs(routerAddress, WETHPairAddress, swapAmount)
            .to.emit(WETHPartner, "Transfer")
            .withArgs(WETHPairAddress, wallet.address, expectedOutputAmount)
            .to.emit(WETHPair, "Sync")
            .withArgs(
              WETHPairToken0 === WETHPartnerAddress
                ? WETHPartnerAmount - expectedOutputAmount
                : ETHAmount + swapAmount,
              WETHPairToken0 === WETHPartnerAddress
                ? ETHAmount + swapAmount
                : WETHPartnerAmount - expectedOutputAmount
            )
            .to.emit(WETHPair, "Swap")
            .withArgs(
              routerAddress,
              WETHPairToken0 === WETHPartnerAddress ? 0 : swapAmount,
              WETHPairToken0 === WETHPartnerAddress ? swapAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? expectedOutputAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? 0 : expectedOutputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await expect(
            routerEventEmitter.swapExactETHForTokens(
              routerAddress,
              0,
              [WETHAddress, WETHPartnerAddress],
              wallet.address,
              MaxUint256,
              {
                value: swapAmount,
              }
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapTokensForExactETH", () => {
        const WETHPartnerAmount = expandTo18Decimals(5);
        const ETHAmount = expandTo18Decimals(10);
        const expectedSwapAmount = BigInt("557227237267357629");
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(WETHPairAddress, ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          await WETHPartner.approve(routerAddress, MaxUint256);
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapTokensForExactETH(
              outputAmount,
              MaxUint256,
              [WETHPartnerAddress, WETHAddress],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(wallet.address, WETHPairAddress, expectedSwapAmount)
            .to.emit(WETH, "Transfer")
            .withArgs(WETHPairAddress, routerAddress, outputAmount)
            .to.emit(WETHPair, "Sync")
            .withArgs(
              WETHPairToken0 === WETHPartnerAddress
                ? WETHPartnerAmount + expectedSwapAmount
                : ETHAmount - outputAmount,
              WETHPairToken0 === WETHPartnerAddress
                ? ETHAmount - outputAmount
                : WETHPartnerAmount + expectedSwapAmount
            )
            .to.emit(WETHPair, "Swap")
            .withArgs(
              routerAddress,
              WETHPairToken0 === WETHPartnerAddress ? expectedSwapAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? 0 : expectedSwapAmount,
              WETHPairToken0 === WETHPartnerAddress ? 0 : outputAmount,
              WETHPairToken0 === WETHPartnerAddress ? outputAmount : 0,
              routerAddress
            );
        });

        it("amounts", async () => {
          await WETHPartner.approve(routerEventEmitterAddress, MaxUint256);
          await expect(
            routerEventEmitter.swapTokensForExactETH(
              routerAddress,
              outputAmount,
              MaxUint256,
              [WETHPartnerAddress, WETHAddress],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });

      describe("swapExactTokensForETH", () => {
        const WETHPartnerAmount = expandTo18Decimals(5);
        const ETHAmount = expandTo18Decimals(10);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = BigInt("1662497915624478906");

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(WETHPairAddress, ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          await WETHPartner.approve(routerAddress, MaxUint256);
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapExactTokensForETH(
              swapAmount,
              0,
              [WETHPartnerAddress, WETHAddress],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(wallet.address, WETHPairAddress, swapAmount)
            .to.emit(WETH, "Transfer")
            .withArgs(WETHPairAddress, routerAddress, expectedOutputAmount)
            .to.emit(WETHPair, "Sync")
            .withArgs(
              WETHPairToken0 === WETHPartnerAddress
                ? WETHPartnerAmount + swapAmount
                : ETHAmount - expectedOutputAmount,
              WETHPairToken0 === WETHPartnerAddress
                ? ETHAmount - expectedOutputAmount
                : WETHPartnerAmount + swapAmount
            )
            .to.emit(WETHPair, "Swap")
            .withArgs(
              routerAddress,
              WETHPairToken0 === WETHPartnerAddress ? swapAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? 0 : swapAmount,
              WETHPairToken0 === WETHPartnerAddress ? 0 : expectedOutputAmount,
              WETHPairToken0 === WETHPartnerAddress ? expectedOutputAmount : 0,
              routerAddress
            );
        });

        it("amounts", async () => {
          await WETHPartner.approve(routerEventEmitterAddress, MaxUint256);
          await expect(
            routerEventEmitter.swapExactTokensForETH(
              routerAddress,
              swapAmount,
              0,
              [WETHPartnerAddress, WETHAddress],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapETHForExactTokens", () => {
        const WETHPartnerAmount = expandTo18Decimals(10);
        const ETHAmount = expandTo18Decimals(5);
        const expectedSwapAmount = BigInt("557227237267357629");
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairAddress, WETHPartnerAmount);
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(WETHPairAddress, ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapETHForExactTokens(
              outputAmount,
              [WETHAddress, WETHPartnerAddress],
              wallet.address,
              MaxUint256,
              {
                value: expectedSwapAmount,
              }
            )
          )
            .to.emit(WETH, "Transfer")
            .withArgs(routerAddress, WETHPairAddress, expectedSwapAmount)
            .to.emit(WETHPartner, "Transfer")
            .withArgs(WETHPairAddress, wallet.address, outputAmount)
            .to.emit(WETHPair, "Sync")
            .withArgs(
              WETHPairToken0 === WETHPartnerAddress
                ? WETHPartnerAmount - outputAmount
                : ETHAmount + expectedSwapAmount,
              WETHPairToken0 === WETHPartnerAddress
                ? ETHAmount + expectedSwapAmount
                : WETHPartnerAmount - outputAmount
            )
            .to.emit(WETHPair, "Swap")
            .withArgs(
              routerAddress,
              WETHPairToken0 === WETHPartnerAddress ? 0 : expectedSwapAmount,
              WETHPairToken0 === WETHPartnerAddress ? expectedSwapAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? outputAmount : 0,
              WETHPairToken0 === WETHPartnerAddress ? 0 : outputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await expect(
            routerEventEmitter.swapETHForExactTokens(
              routerAddress,
              outputAmount,
              [WETHAddress, WETHPartnerAddress],
              wallet.address,
              MaxUint256,
              {
                value: expectedSwapAmount,
              }
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });
    });
  }
});
