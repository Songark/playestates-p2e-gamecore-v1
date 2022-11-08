import { Contract } from 'ethers';
import hre from "hardhat";

export const usingTenderly = () =>
  (hre.network.name.includes('tenderly') ||
    process.env.TENDERLY === 'true');

// This function has a problem with hre    
export const verifyAtTenderly = async (id: string, instance: Contract) => {
  console.log('\n- Doing Tenderly contract verification of', id);
  await (hre as any).tenderlyNetwork.verify({
    name: id,
    address: instance.address,
  });
  console.log(`  - Verified ${id} at Tenderly!`);
};