import {
  AddressLike,
  Signature,
  TypedDataDomain,
  getAddress,
  keccak256,
  solidityPacked,
} from "ethers";
import { ERC20 } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n;
}

function domainSeparator(
  name: string,
  tokenAddress: string,
  chainId: bigint
): TypedDataDomain {
  return {
    name,
    version: "1",
    chainId,
    verifyingContract: tokenAddress,
  };
}

export async function getPermitSignature(
  wallet: SignerWithAddress,
  token: ERC20,
  approve: {
    owner: AddressLike;
    spender: AddressLike;
    value: bigint;
  },
  nonce: bigint,
  deadline: bigint
): Promise<Signature> {
  const chainId = await wallet.provider
    .getNetwork()
    .then((network) => network.chainId);
  const name = await token.name();
  const tokenAddress = await token.getAddress();
  const signature = await wallet.signTypedData(
    domainSeparator(name, tokenAddress, chainId),
    {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      owner: approve.owner,
      spender: approve.spender,
      value: approve.value,
      nonce,
      deadline,
    }
  );

  return Signature.from(signature);
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] =
    tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
  const create2Inputs = [
    "0xff",
    factoryAddress,
    keccak256(solidityPacked(["address", "address"], [token0, token1])),
    keccak256(bytecode),
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join("")}`;
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`);
}

export function encodePrice(reserve0: bigint, reserve1: bigint) {
  return [
    (reserve1 * 2n ** 112n) / reserve0,
    (reserve0 * 2n ** 112n) / reserve1,
  ];
}
