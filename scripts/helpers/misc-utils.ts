import BigNumber from 'bignumber.js';
import BN = require('bn.js');
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { WAD } from './constants';
import { Wallet, ContractTransaction } from 'ethers';
import { tEthereumAddress } from './types';
import { isAddress } from 'ethers/lib/utils';
import { isZeroAddress } from 'ethereumjs-util';
import { usingTenderly } from './tenderly-utils';
import hre, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export const toWad = (value: string | number) => new BigNumber(value).times(WAD).toFixed();

export const bnToBigNumber = (amount: BN): BigNumber => new BigNumber(<any>amount);
export const stringToBigNumber = (amount: string): BigNumber => new BigNumber(amount);

export const getDb = () => low(new FileSync('./deployed-contracts.json'));

export const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const createRandomAddress = () => Wallet.createRandom().address;

export const evmSnapshot = async () => await hre.ethers.provider.send('evm_snapshot', []);

export const evmRevert = async (id: string) => hre.ethers.provider.send('evm_revert', [id]);

export const timeLatest = async () => {
  const block = await hre.ethers.provider.getBlock('latest');
  return new BigNumber(block.timestamp);
};

export const advanceBlock = async (timestamp: number) =>
  await hre.ethers.provider.send('evm_mine', [timestamp]);

export const addDays = async (days: number) => {
  await hre.ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
  await hre.ethers.provider.send('evm_mine', []);
};

export const increaseTime = async (secondsToIncrease: number) => {
  await hre.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await hre.ethers.provider.send('evm_mine', []);
};

export const tenExponent = (digits: number | string) => {
  return (new BigNumber(10)).pow(digits);
};

export const posE = (number: number | string, digits = 18, decimals = -1) => {
  number = number || "0";
  const bn = new BigNumber(number);
  const exp = tenExponent(digits);
  const outcome = bn.multipliedBy(exp);
  if (decimals !== -1) {
    // @ts-ignore
    return outcome.toFixed(decimals);
  }
  return outcome;
};

export const negE = (number: number | string, digits = 18, decimals = -1) => {
  number = number || "0";
  const bn = new BigNumber(number);
  const exp = tenExponent(digits);
  const outcome = bn.div(exp);
  if (decimals !== -1) {
    return outcome.toFixed(decimals);
  }
  return outcome;
};

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await hre.ethers.provider.getBlockNumber();
  const currentBlock = await hre.ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183
     */
    await hre.ethers.provider.send('evm_increaseTime', [forwardTime]);
    await hre.ethers.provider.send('evm_mine', []);
    //Set the next blocktime back to 15 seconds
    await hre.ethers.provider.send('evm_increaseTime', [15]);
    return;
  }
  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await hre.ethers.provider.send('evm_mine', []);
};

export const waitForTx = async (tx: ContractTransaction, confirms: number = 1) => await tx.wait(confirms);

export const filterMapBy = (raw: { [key: string]: any }, fn: (key: string) => boolean) =>
  Object.keys(raw)
    .filter(fn)
    .reduce<{ [key: string]: any }>((obj, key) => {
      obj[key] = raw[key];
      return obj;
    }, {});

export const chunk = <T>(arr: Array<T>, chunkSize: number): Array<Array<T>> => {
  return arr.reduce(
    (prevVal: any, currVal: any, currIndx: number, array: Array<T>) =>
      !(currIndx % chunkSize)
        ? prevVal.concat([array.slice(currIndx, currIndx + chunkSize)])
        : prevVal,
    []
  );
};

interface DbEntry {
  [network: string]: {
    deployer: string;
    address: string;
  };
}

export const printContracts = () => {
  const network = hre.network.name;
  const db = getDb();
  console.log('Contracts deployed at', network);
  console.log('---------------------------------');

  const entries = Object.entries<DbEntry>(db.getState()).filter(([_k, value]) => !!value[network]);

  const contractsPrint = entries.map(
    ([key, value]: [string, DbEntry]) => `${key}: ${value[network].address}`
  );

  console.log('N# Contracts:', entries.length);
  console.log(contractsPrint.join('\n'), '\n');
};

export const notFalsyOrZeroAddress = (address: tEthereumAddress | null | undefined): boolean => {
  if (!address) {
    return false;
  }
  return isAddress(address) && !isZeroAddress(address);
};

export const impersonateAddress = async (address: tEthereumAddress): Promise<SignerWithAddress> => {
  if (!usingTenderly()) {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [address],
    });
  }
  const signer = await ethers.getSigner(address);
  return  signer;
};

export const omit = <T, U extends keyof T>(obj: T, keys: U[]): Omit<T, U> =>
  (Object.keys(obj) as U[]).reduce(
    (acc, curr) => (keys.includes(curr) ? acc : { ...acc, [curr]: obj[curr] }),
    {} as Omit<T, U>
  );

export const impersonateAccountsHardhat = async (accounts: string[]) => {
  if (process.env.TENDERLY === 'true') {
    return;
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    });
  }
};