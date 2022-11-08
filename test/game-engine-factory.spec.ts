import { expect, assert } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import hre from "hardhat";
import { deployGamePlayV2Factory, deployMockToken, deployMockTokenNoMint } from "./deploy";
import { increaseTime, addDays, posE } from "../scripts/helpers/misc-utils";
import { solidity } from 'ethereum-waffle';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { almostEqual } from './helpers/almost-equal';
import { start } from "repl";


describe("GamePlayV2Engine Factory", async () => {
  let gameFactory: any, game: any, mockOwnd: any;
  let currentTime: any;
  // Generic result variable
  let result: any;
  let deployer: any, admin: any, treasury: any, gameTreasury: any, bob: any, 
      carol: any, david: any, erin: any, others: any;


  beforeEach(async () => {
    [deployer, admin, treasury, gameTreasury, 
      bob, carol, david, erin, treasury, ...others] = await ethers.getSigners();
    gameFactory = await deployGamePlayV2Factory();
    mockOwnd = await deployMockToken(deployer);
    console.log("GameFactory:", gameFactory.address);
  });

  it("Can create game engine under the contract owner permission", async () => {
    result = await (
      await gameFactory.deployGamePlayV2(
        mockOwnd.address,
        mockOwnd.address,
        18,
        admin.address,
        treasury.address,
        gameTreasury.address,
        "CS go",
        "PlayEstates",
        1
      )
    ).wait(1);

    const gameAddress = result.events[2].args[0];
    const gameContract = await ethers.getContractFactory("GamePlayV2");
    game = await gameContract.attach(gameAddress);
    const precision = await game.PRECISION_FACTOR();
  });

  it("Can't create game engine with no owner permission", async () => {
      await expect(gameFactory.connect(admin).deployGamePlayV2(
        mockOwnd.address,
        mockOwnd.address,
        18,
        admin.address,
        treasury.address,
        gameTreasury.address,
        "CS go",
        "PlayEstates",
        1
      )).to.be.revertedWith("Not admin");
  });

  it("Can't accept tokens with no total supply", async () => {

    const mockOwndNoMint = await deployMockTokenNoMint();
    await expect(
      gameFactory.deployGamePlayV2(
      mockOwnd.address,
      mockOwndNoMint.address,
      18,
      admin.address,
      treasury.address,
      gameTreasury.address,
      "CS go",
      "PlayEstates",
      1
    )).to.be.revertedWith("No supply");

    await expect(
      gameFactory.deployGamePlayV2(
      mockOwndNoMint.address,
      mockOwnd.address,
      18,
      admin.address,
      treasury.address,
      gameTreasury.address,
      "CS go",
      "PlayEstates",
      1
    )).to.be.revertedWith("No supply");
  });

  it("Can deploy multiple game engines with different addresses", async () => {
    const result2 = await (
      await gameFactory.deployGamePlayV2(
        mockOwnd.address,
        mockOwnd.address,
        18,
        admin.address,
        treasury.address,
        gameTreasury.address,
        "CS go",
        "PlayEstates",
        1
      )
    ).wait(1);

    const gameAddress = result2.events[2].args[0];
    const gameContract = await ethers.getContractFactory("GamePlayV2");
    const game2 = await gameContract.attach(gameAddress);
    expect(game.address).to.be.not.equals(game2.address);
  });

  it("Must be same token", async () => {

    const mockOwnd2 = await deployMockToken(deployer);
    await expect(
      gameFactory.deployGamePlayV2(
      mockOwnd.address,
      mockOwnd2.address,
      18,
      admin.address,
      treasury.address,
      gameTreasury.address,
      "CS go",
      "PlayEstates",
      1
    )).to.be.revertedWith("Tokens must be same");
  });

  it("Should have decimals less than 30", async () => {
    await expect(
      gameFactory.deployGamePlayV2(
      mockOwnd.address,
      mockOwnd.address,
      30,
      admin.address,
      treasury.address,
      gameTreasury.address,
      "CS go",
      "PlayEstates",
      1
    )).to.be.revertedWith("Must be inferior to 30");
  });

  it("Can't be initialized by the others",async () => {
    const engineFactory = await ethers.getContractFactory("GamePlayV2");
    const engine = await engineFactory.deploy();
    await engine.deployed();
    await expect(
      engine.connect(admin).initialize(
        mockOwnd.address,
        mockOwnd.address,
        18,
        admin.address,
        treasury.address,
        gameTreasury.address,
        "CS go",
        "PlayEstates",
        1
      )
    ).to.be.revertedWith("Not factory");
  });

});
