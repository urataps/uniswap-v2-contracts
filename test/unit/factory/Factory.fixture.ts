import { ethers } from "hardhat";
import { UniswapV2Factory__factory } from "../../../typechain";

export async function deployFactoryFixture() {
  const [feeToSetter] = await ethers.getSigners();
  const UniswapV2Factory = new UniswapV2Factory__factory();
  const factory = await UniswapV2Factory.connect(feeToSetter).deploy(
    feeToSetter,
    3n,
    "Uniswap V2",
    "UNI-V2"
  );

  return {
    factory,
  };
}
