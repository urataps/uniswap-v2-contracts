import { ethers } from "hardhat";
import { MockERC20__factory, UniswapV2Pair__factory } from "../../../typechain";
import { deployFactoryFixture } from "../factory/Factory.fixture";

export async function deployPairFixture() {
  const [wallet] = await ethers.getSigners();

  const { factory } = await deployFactoryFixture();
  const tokenA = await new MockERC20__factory(wallet).deploy();
  const tokenB = await new MockERC20__factory(wallet).deploy();
  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  await factory.createPair(tokenAAddress, tokenBAddress);
  await tokenA.mint(wallet.address, 10n ** 33n);
  await tokenB.mint(wallet.address, 10n ** 33n);

  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  const pair = UniswapV2Pair__factory.connect(pairAddress, wallet);

  const token0Address = await pair.token0();
  const token0 = tokenAAddress === token0Address ? tokenA : tokenB;
  const token1 = tokenAAddress === token0Address ? tokenB : tokenA;

  return { factory, token0, token1, pair };
}
