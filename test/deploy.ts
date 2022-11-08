import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { posE } from "../scripts/helpers/misc-utils";
import { parseEther } from "ethers/lib/utils";

// deploy game engine factory 
export const deployGamePlayV2Factory = async () => {
    const P2eFactory = await ethers.getContractFactory("GamePlayV2Factory");
    const p2eFactory = await P2eFactory.deploy();
    await p2eFactory.deployed();
    return p2eFactory;
}
// deploy OWND mock token
export const deployMockToken = async (owner: SignerWithAddress) => {
    ethers.getSigners()
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockToken.deploy();
    await mockToken.deployed();
    mockToken.mint(owner.address, parseEther("4000"));
   return mockToken;
}

export const deployMockTokenNoMint = async () => {
    ethers.getSigners()
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockToken.deploy();
    await mockToken.deployed();
   return mockToken;
}
