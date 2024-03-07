import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  UniswapV2Factory,
  UniswapV2Pair,
  UniswapV2Pair__factory,
} from "../../../typechain";
import { deployFactoryFixture } from "./Factory.fixture";
import { ethers } from "hardhat";
import { ZeroAddress, keccak256 } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getCreate2Address } from "../utils";

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

describe("Factory", () => {
  let wallet: SignerWithAddress;
  let other: SignerWithAddress;
  let factory: UniswapV2Factory;
  let factoryAddress: string;

  beforeEach(async () => {
    [wallet, other] = await ethers.getSigners();
    const fixture = await loadFixture(deployFactoryFixture);
    factory = fixture.factory;
    factoryAddress = await factory.getAddress();
  });

  async function createPair(tokens: [string, string]) {
    const bytecode = UniswapV2Pair__factory.bytecode;
    console.log(keccak256(bytecode));
    const create2Address = getCreate2Address(factoryAddress, tokens, bytecode);
    await expect(factory.createPair(...tokens))
      .to.emit(factory, "PairCreated")
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1n);

    const tokensReversed = tokens.slice().reverse() as [string, string];
    await expect(factory.createPair(...tokens)).to.be.revertedWith(
      "PAIR_EXISTS"
    );
    await expect(factory.createPair(...tokensReversed)).to.be.revertedWith(
      "PAIR_EXISTS"
    );
    expect(await factory.getPair(...tokens)).to.eq(create2Address);
    expect(await factory.getPair(...tokensReversed)).to.eq(create2Address);
    expect(await factory.allPairs(0)).to.eq(create2Address);
    expect(await factory.allPairsLength()).to.eq(1);

    const pair = new UniswapV2Pair__factory(wallet).attach(
      create2Address
    ) as UniswapV2Pair;
    expect(await pair.factory()).to.eq(factoryAddress);
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
  }

  it("createPair", async () => {
    await createPair(TEST_ADDRESSES);
  });

  it("createPair:reverse", async () => {
    await createPair(TEST_ADDRESSES.slice().reverse() as [string, string]);
  });

  it("feeTo, feeToSetter, allPairsLength", async () => {
    expect(await factory.feeTo()).to.eq(ZeroAddress);
    expect(await factory.feeToSetter()).to.eq(wallet.address);
    expect(await factory.allPairsLength()).to.eq(0);
  });

  it("setFeeTo", async () => {
    await expect(
      factory.connect(other).setFeeTo(other.address)
    ).to.be.revertedWith("FORBIDDEN");
    await factory.setFeeTo(wallet.address);
    expect(await factory.feeTo()).to.eq(wallet.address);
  });

  it("setFeeToSetter", async () => {
    await expect(
      factory.connect(other).setFeeToSetter(other.address)
    ).to.be.revertedWith("FORBIDDEN");
    await factory.setFeeToSetter(other.address);
    expect(await factory.feeToSetter()).to.eq(other.address);
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith(
      "FORBIDDEN"
    );
  });
});
