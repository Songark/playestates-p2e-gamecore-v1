import { expect, assert } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import hre from "hardhat";
import { deployGamePlayV2Factory, deployMockToken } from "./deploy";
import { increaseTime, addDays, posE } from "../scripts/helpers/misc-utils";
import { solidity } from 'ethereum-waffle';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { almostEqual } from './helpers/almost-equal';
import { start } from "repl";


describe("GamePlayV2Engine", async () => {
  let gameFactory: any, game: any, mockOwnd: any;
  let currentTime: any;
  let startTime: any;
  let adminFeeRate = 10;
  let roundFeeRate = 10;
  let minPlayers = 1;
  let maxPlayers = 10;
  let entryPeriod = 1 * 24 * 60 * 60;
  let playPeriod = 1 * 24 * 60 * 60;
  let finalPeriod = 7 * 24 * 60 * 60;
  let entryAmount = parseEther("1");
  let ratesForRanking: any;
  // Generic result variable
  let result: any;
  let deployer: any, admin: any, treasury: any, gameTreasury: any, bob: any, 
      carol: any, david: any, erin: any, others: any;


  const verifyPendingRewards = async (roundId: number, addr: any) => {
    let totalRates = 0;
    for(let i = 0; i < ratesForRanking.length; i++) {
      const numberOfR = await game.numberOfRankingMap(roundId, i); 
      totalRates = numberOfR.mul(ratesForRanking[i]).add(totalRates);
    }
    const remainR = await game.remainingRewards(1);
    const roundPlayerInfo = await game.roundPlayerInfo(roundId, addr);
    const r = roundPlayerInfo.ranking > 0 ? ratesForRanking[roundPlayerInfo.ranking - 1] : 0;
    const userPendingR = remainR.mul(r).div(totalRates);
    return userPendingR;
  }

  before(async () => {
    [deployer, admin, treasury, gameTreasury,
      bob, carol, david, erin, treasury, ...others] = await ethers.getSigners();
    gameFactory = await deployGamePlayV2Factory();
    mockOwnd = await deployMockToken(deployer);
    console.log("GameFactory:", gameFactory.address);

    currentTime = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
    startTime = BigNumber.from(currentTime).add(10);
  });
  describe("1. Setup Environment", async () => {
    it("can deploy game with gamePlayV2Factory", async () => {
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
  
    it("can create a new round", async () => {
      await game.connect(admin).createRound(
        startTime,
        entryPeriod,
        minPlayers,
        maxPlayers,
        playPeriod,
        finalPeriod,
        entryAmount,
        adminFeeRate,
        roundFeeRate,
        false
      );
    });

    it("can update the round", async () => {
      currentTime = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      startTime = BigNumber.from(currentTime).add(10);
      const tx = await (await game.connect(admin).updateRound(
        1,
        startTime,
        minPlayers,
        maxPlayers,
        entryPeriod,
        playPeriod,
        finalPeriod,
        entryAmount,
        adminFeeRate,
        roundFeeRate
      )).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateRound")).to.be.not.undefined;
    });

    it("Initial parameters are correct", async () => {
      assert.equal(String(await game.PRECISION_FACTOR()), "1000000000000");
      assert.equal(await game.rewardToken(), mockOwnd.address);
      assert.equal(await game.enteredToken(), mockOwnd.address);
      assert.equal(await game.treasury(), treasury.address);
  
      assert.equal(String(await game.roundId()), "1");
      const round = await game.rounds(1);
      const gameInfo = await game.gameInfo();
      assert.equal(gameInfo.walletAddress, gameTreasury.address);
      assert.equal(gameInfo.gameMode, 1);
  
      assert.equal(String(round.startTime), startTime.toString());
      assert.equal(String(round.minPlayers), minPlayers.toString());
      assert.equal(String(round.maxPlayers), maxPlayers.toString());
      assert.equal(String(round.entryPeriod), entryPeriod.toString());
      assert.equal(String(round.playPeriod), playPeriod.toString());
      assert.equal(String(round.finalPeriod), finalPeriod.toString());
      assert.equal(String(round.entryAmount), entryAmount.toString());
      // Transfer 1000 OWND token to the contract
      await mockOwnd.connect(deployer).transfer(game.address, parseEther("1000"));
    });

    it("Setup setRewardRates", async () => {
      ratesForRanking = [50,25,15,10];
      await game.connect(admin).setRewardRates(1, ratesForRanking);
      expect(await game.rewardRatesMap(1, 0)).to.be.equals(ratesForRanking[0]);
      expect(await game.rewardRatesMap(1, 1)).to.be.equals(ratesForRanking[1]);
      expect(await game.rewardRatesMap(1, 2)).to.be.equals(ratesForRanking[2]);
      expect(await game.rewardRatesMap(1, 3)).to.be.equals(ratesForRanking[3]);
    });  
  });

  describe("2. Entry Period", async () => {
    it("player can do emergency withdrawal", async () => {
      const user = others[0];
      await increaseTime(10);
      await mockOwnd.mint(user.address, parseEther("10"));
      await mockOwnd.connect(user).approve(game.address, entryAmount);
      result = await (await game.connect(user).enter(1, parseEther("1"))).wait(1);
      expect(result.events.find((e: any) => e.event == "Enter")).to.be.not.undefined;
      expect(await mockOwnd.balanceOf(user.address)).to.be.equals(parseEther("9"));
      await game.connect(user).emergencyWithdraw(1);
    });
  });

  describe("3. Active Period", async () => {
  
    it("player can deposit", async () => {
      await increaseTime(10);
      for (let thisUser of [bob, carol, david, erin]) {
        await mockOwnd.mint(thisUser.address, parseEther("1000"));
        await mockOwnd.connect(thisUser).approve(game.address, entryAmount);
        result = await (await game.connect(thisUser).enter(1, parseEther("1"))).wait(1);
        expect(result.events.find((e: any) => e.event == "Enter")).to.be.not.undefined;
        // rewards are 0 when being deposits
        assert.equal(String(await game.pendingRewards(1, thisUser.address)), String(parseEther("0")));
      }
    });
  
    it("admin can update score", async () => {
      const tx = await (await game.connect(admin).updateScore(1, bob.address, parseEther("1"))).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateScore")).to.be.not.undefined;
      expect(tx.events[0].args[2]).to.be.equals(parseEther("1"));
    });
  
    it("admin update ranking and rewards", async () => {
      const tx = await (await game.connect(admin).updateRankingRewards(1, bob.address, 1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateRankingRewards")).to.be.not.undefined;
      const roundPlayerInfo = await game.roundPlayerInfo(1, bob.address);
      expect(roundPlayerInfo.ranking).to.be.equals(1);
    });
  
    it("getter pending rewards", async () => {
        const bobPendingR = await verifyPendingRewards(1, bob.address);
        const carolPendingR = await verifyPendingRewards(1, carol.address);
        
        expect(await game.pendingRewards(1, bob.address)).to.be.equals(bobPendingR);
        expect(await game.pendingRewards(1, carol.address)).to.be.equals(carolPendingR);
    });
  
    it("admin can distribute rewards by rankings", async() => {
      const addresses = [bob.address, carol.address, david.address, erin.address];
      const rankings = [1,2,3,4];
      for (let i = 0; i<addresses.length; i++)
        await game.connect(admin).updateRankingRewards(1, addresses[i], rankings[i]);
      await game.connect(admin).distributeRewards(1);
      const bobPendingR = await verifyPendingRewards(1, bob.address);
      const carPendingR = await verifyPendingRewards(1, carol.address);
      const davPendingR = await verifyPendingRewards(1, david.address);
      const erinPendingR = await verifyPendingRewards(1, erin.address);
      expect(await game.pendingRewards(1, bob.address)).to.be.equals(bobPendingR); // parseEther("1.6")
      expect(await game.pendingRewards(1, carol.address)).to.be.equals(carPendingR); // parseEther("0.8")
      expect(await game.pendingRewards(1, david.address)).to.be.equals(davPendingR); // parseEther("0.48")
      expect(await game.pendingRewards(1, erin.address)).to.be.equals(erinPendingR); // parseEther("0.32")
    });
  
    it("Carol can't claim", async () => {
      let tx = game.connect(carol).claim(1);
      await expect(tx).to.be.revertedWith("GamePlayV2: not final period");
    });
    it("can't withdraw to System Treasury", async () => {
      await expect(game.withdrawToTreasury(1)).to.be.revertedWith("GamePlayV2: not final period");
    });
    it("can't withdraw to Game Seervice Treasury", async () => {
      await expect(game.withdrawToGameService(1)).to.be.revertedWith("GamePlayV2: not final period");
    });

  });

  describe("4. Playing Period", async () => {
    before(async () => {
      await increaseTime(entryPeriod);
    });

    it("player still can deposit", async () => {
        let thisUser = others[0];
        await mockOwnd.connect(thisUser).approve(game.address, entryAmount);
        result = await (await game.connect(thisUser).enter(1, parseEther("1"))).wait(1);
        expect(result.events.find((e: any) => e.event == "Enter")).to.be.not.undefined;
        // rewards are 0 when being deposits
        assert.equal(String(await game.pendingRewards(1, thisUser.address)), String(parseEther("0")));
    });
  
    it("admin can update score", async () => {
      const tx = await (await game.connect(admin).updateScore(1, bob.address, parseEther("1"))).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateScore")).to.be.not.undefined;
      expect(tx.events[0].args[2]).to.be.equals(parseEther("1"));
    });
  
    it("admin update ranking and rewards", async () => {
      const tx = await (await game.connect(admin).updateRankingRewards(1, bob.address, 1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateRankingRewards")).to.be.not.undefined;
      const roundPlayerInfo = await game.roundPlayerInfo(1, bob.address);
      expect(roundPlayerInfo.ranking).to.be.equals(1);
    });
  
    it("getter pending rewards", async () => {
        const bobPr = await verifyPendingRewards(1, bob.address);
        const calPr = await verifyPendingRewards(1, carol.address);
        expect(await game.pendingRewards(1, bob.address)).to.be.equals(bobPr); // parseEther("2.0")
        expect(await game.pendingRewards(1, carol.address)).to.be.equals(calPr); //parseEther("0")
    });
  
    it("admin can't distribute rewards by rankings", async() => {
      const addresses = [bob.address, carol.address, david.address, erin.address];
      const rankings = [1,2,3,4];
      for (let i = 0; i<addresses.length; i++) 
        await game.connect(admin).updateRankingRewards(1, addresses[i], rankings[i]);
      await expect(game.connect(admin).distributeRewards(1)).to.be.revertedWith("distribute: already distributed");
    });
  
    it("Carol can't claim", async () => {
      let tx = game.connect(carol).claim(1);
      await expect(tx).to.be.revertedWith("GamePlayV2: not final period");
    });
    it("can't withdraw to System Treasury", async () => {
      await expect(game.withdrawToTreasury(1)).to.be.revertedWith("GamePlayV2: not final period");
    });
    it("can't withdraw to Game Seervice Treasury", async () => {
      await expect(game.withdrawToGameService(1)).to.be.revertedWith("GamePlayV2: not final period");
    });   
  });

  describe("5. Final Period", async () => {
    before(async () => {
      await increaseTime(playPeriod);
    });    
    it("player can't deposit", async () => {
      await increaseTime(10);
      for (let thisUser of [bob, carol, david, erin]) {
        await mockOwnd.mint(thisUser.address, parseEther("1000"));
        await mockOwnd.connect(thisUser).approve(game.address, entryAmount);
        await expect(game.connect(thisUser).enter(1, parseEther("1"))).to.be.revertedWith("GamePlayV2: not active period");
      }
    });
  
    it("admin can't update score", async () => {
      await expect(game.connect(admin).updateScore(1, bob.address, parseEther("1"))).revertedWith("GamePlayV2: not active period");
    });
  
    it("admin can't update ranking and rewards", async () => {
      const tx = await expect(game.connect(admin).updateRankingRewards(1, bob.address, 1)).revertedWith("GamePlayV2: not active period");
    });
  
    it("getter pending rewards", async () => {
        const bobPr = await verifyPendingRewards(1, bob.address);
        const calPr = await verifyPendingRewards(1, carol.address);
        expect(await game.pendingRewards(1, bob.address)).to.be.equals(bobPr); // parseEther("2.0")
        expect(await game.pendingRewards(1, carol.address)).to.be.equals(calPr); //parseEther("0")
    });
  
    it("admin can't distribute rewards by rankings", async() => {
      const addresses = [bob.address, carol.address, david.address, erin.address];
      const rankings = [1,2,3,4];
      for (let i = 0; i<addresses.length; i++) 
        await expect(game.connect(admin).updateRankingRewards(1, addresses[i], rankings[i])).to.be.revertedWith("GamePlayV2: not active period");
      await expect(game.connect(admin).distributeRewards(1)).to.be.revertedWith("distribute: already distributed");
    });
  
    it("player can claim", async () => {
      const usr = david;
      const r = await verifyPendingRewards(1, usr.address);
      expect(await game.pendingRewards(1, usr.address)).to.be.equals(r);
      console.log(r);
      const prevBal = await mockOwnd.balanceOf(usr.address);
      console.log("balance before:", prevBal);
      const tx = await (await game.connect(usr).claim(1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "Claim")).to.be.not.undefined;
      const afterBal = r.add(prevBal);
      console.log("expected balance after:", afterBal);
      console.log("real balance after:", await mockOwnd.balanceOf(usr.address));
      expect(await mockOwnd.balanceOf(usr.address)).to.be.closeTo(r.add(prevBal), parseEther("0.1"));
    });

    it("can withdraw to System Treasury", async () => {
      const adminFee = entryAmount.mul(5 * adminFeeRate).div(100);
      await game.withdrawToTreasury(1);
      expect(await mockOwnd.balanceOf(treasury.address)).to.be.equals(adminFee);
      await expect(game.withdrawToTreasury(1)).to.be.revertedWith('admin rate is zero');
    });

    it("can withdraw to Game Seervice Treasury", async () => {
      const roundFee = entryAmount.mul(5 * roundFeeRate).div(100);
      await game.withdrawToGameService(1);
      expect(await mockOwnd.balanceOf(gameTreasury.address)).to.be.equals(roundFee);
      await expect(game.withdrawToGameService(1)).to.be.revertedWith('game service rate is zero');
    });
  });
});
