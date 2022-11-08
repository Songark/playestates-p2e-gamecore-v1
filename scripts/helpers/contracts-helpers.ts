import hre from "hardhat";
import { Contract, Signer, utils, ethers, BigNumberish } from 'ethers';
import { getDb, waitForTx } from "./misc-utils";
import { eContractid, tEthereumAddress } from "./types";


export const getFirstSigner = async () => (await getEthersSigners())[0];

export const getEthersSigners = async (): Promise<Signer[]> => {
  const ethersSigners = await Promise.all(await hre.ethers.getSigners());
  return ethersSigners;
};

export const registerContractInJsonDb = async (contractId: string, contractInstance: Contract) => {
  const currentNetwork = hre.network.name;
  const FORK = process.env.FORK;
  //if (FORK || (currentNetwork !== 'hardhat' && !currentNetwork.includes('coverage'))) {
  console.log(`\n\n*** ${contractId} ***\n`);
  console.log(`Network: ${currentNetwork}`);
  console.log(`tx: ${contractInstance.deployTransaction.hash}`);
  console.log(`contract address: ${contractInstance.address}`);
  console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
  console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
  console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
  console.log(`\n******`);
  console.log();
  //}

  await getDb()
    .set(`${contractId}.${currentNetwork}`, {
      address: contractInstance.address,
      deployer: contractInstance.deployTransaction.from,
    })
    .write();
};

export const insertContractAddressInDb = async (id: eContractid, address: tEthereumAddress) =>
  await getDb()
    .set(`${id}.${hre.network.name}`, {
      address,
    })
    .write();

export const rawInsertContractAddressInDb = async (id: string, address: tEthereumAddress) =>
  await getDb()
    .set(`${id}.${hre.network.name}`, {
      address,
    })
    .write();
export const withSaveAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: (string | string[])[],
  verify?: boolean,
  confirms: number = 1
): Promise<ContractType> => {

  await waitForTx(instance.deployTransaction, confirms);
  await registerContractInJsonDb(id, instance);
  if (verify) {
    try {
      await hre.run("verify:verify", {
        address: instance.address,
        constructorArguments: args
      });
    } catch (e: unknown) {
      if (typeof e === "string") {
        console.log("Error String: ", e.toUpperCase());
      } else if (e instanceof Error) {
        console.log("Error.message: ", e.message);
      }
      console.log(`\n******`);
      console.log();
    }
  }
  return instance;
};


export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (await hre.ethers.getContractFactory(contractName))
    .connect(await getFirstSigner())
    .deploy(...args)) as ContractType;
  await waitForTx(contract.deployTransaction);
  await registerContractInJsonDb(<eContractid>contractName, contract);
  return contract;
};
export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> => (await hre.ethers.getContractAt(contractName, address)) as ContractType;

export const verifyContract = async (
  instance: Contract,
  args: (string | string[])[]
) => {
  try {
    await hre.run("verify:verify", {
      address: instance.address,
      constructorArguments: args
    });
  } catch (e: unknown) {
    if (typeof e === "string") {
      console.log("Error String: ", e.toUpperCase());
    } else if (e instanceof Error) {
      console.log("Error.message: ", e.message);
    }
    console.log(`\n******`);
    console.log();
  }
  return instance;
};
