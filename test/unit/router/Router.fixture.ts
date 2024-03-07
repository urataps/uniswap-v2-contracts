import { ethers } from "hardhat";
import {
  MockERC20__factory,
  RouterEventEmitter__factory,
  UniswapV2Pair__factory,
  UniswapV2Router01__factory,
  UniswapV2Router02__factory,
  WrappedNative__factory,
} from "../../../typechain";
import { deployFactoryFixture } from "../factory/Factory.fixture";

export async function deployRouterFixture() {
  const [wallet] = await ethers.getSigners();

  const { factory } = await deployFactoryFixture();
  const factoryAddress = await factory.getAddress();
  const tokenA = await new MockERC20__factory(wallet).deploy();
  const tokenB = await new MockERC20__factory(wallet).deploy();
  const WETH = await new WrappedNative__factory(wallet).deploy(
    "Wrapped Ether",
    "WETH"
  );
  const WETHPartner = await new MockERC20__factory(wallet).deploy();

  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();
  const WETHAddress = await WETH.getAddress();
  const WETHPartnerAddress = await WETHPartner.getAddress();

  await factory.createPair(tokenAAddress, tokenBAddress);
  await tokenA.mint(wallet.address, 10n ** 21n);
  await tokenB.mint(wallet.address, 10n ** 21n);
  await WETHPartner.mint(wallet.address, 10n ** 21n);
  await WETH.deposit({ value: 10n ** 21n });

  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  const pair = UniswapV2Pair__factory.connect(pairAddress, wallet);

  await factory.createPair(WETHAddress, WETHPartnerAddress);
  const WETHPairAddress = await factory.getPair(
    WETHAddress,
    WETHPartnerAddress
  );
  const WETHPair = UniswapV2Pair__factory.connect(WETHPairAddress, wallet);

  const token0Address = await pair.token0();
  const token0 = tokenAAddress === token0Address ? tokenA : tokenB;
  const token1 = tokenAAddress === token0Address ? tokenB : tokenA;

  const router01 = await new UniswapV2Router01__factory(wallet).deploy(
    factoryAddress,
    WETHAddress
  );
  const router02 = await new UniswapV2Router02__factory(wallet).deploy(
    factoryAddress,
    WETHAddress
  );
  const routerEventEmitter = await new RouterEventEmitter__factory(
    wallet
  ).deploy();

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factory,
    router01,
    router02,
    router: router02,
    routerEventEmitter,
    pair,
    WETHPair,
  };
}
