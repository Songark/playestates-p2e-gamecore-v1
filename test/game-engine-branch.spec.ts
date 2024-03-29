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


describe("GamePlayV2Engine - Branch Coverage", async () => {
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

  });
  describe("1. Create a round", async () => {
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

    it("can create the second round", async () => {
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
        true
      );
    });

    it("can't create a new round with no owner permission", async () => {
      await expect(
        game.connect(bob).createRound(
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
        )
      ).to.be.revertedWith("Not admin");
    });

    it("can't create a new round with wrong startTime", async () => {
      await expect(
        game.connect(admin).createRound(
          startTime-20,
          entryPeriod,
          minPlayers,
          maxPlayers,
          playPeriod,
          finalPeriod,
          entryAmount,
          adminFeeRate,
          roundFeeRate,
          false
        )
      ).to.be.revertedWith("Round: can't start at prior time");
    });

    it("can't create a new round with wrong entry amount", async () => {
      await expect(
        game.connect(admin).createRound(
          startTime,
          entryPeriod,
          minPlayers,
          maxPlayers,
          playPeriod,
          finalPeriod,
          0,
          adminFeeRate,
          roundFeeRate,
          false
        )
      ).to.be.revertedWith("Round: entryAmount is 0");
    });

    it("can't create a new round with wrong player number", async () => {
      await expect(
        game.connect(admin).createRound(
          startTime,
          entryPeriod,
          minPlayers,
          0,
          playPeriod,
          finalPeriod,
          entryAmount,
          adminFeeRate,
          roundFeeRate,
          false
        )
      ).to.be.revertedWith("Round: max players is 0");
    });


    it("Setup setRewardRates", async () => {
      ratesForRanking = [50,25,15,10];
      await game.connect(admin).setRewardRates(1, ratesForRanking);
      expect(await game.rewardRatesMap(1, 0)).to.be.equals(ratesForRanking[0]);
      expect(await game.rewardRatesMap(1, 1)).to.be.equals(ratesForRanking[1]);
      expect(await game.rewardRatesMap(1, 2)).to.be.equals(ratesForRanking[2]);
      expect(await game.rewardRatesMap(1, 3)).to.be.equals(ratesForRanking[3]);

      await expect(game.connect(admin).setRewardRates(2, [])).to.be.revertedWith("Round: reward rate list is empty");
      await game.connect(admin).setRewardRates(2, ratesForRanking);
    });
  });

  describe("2. Entry Period", async () => {
    it("can't update the round", async () => {
      currentTime = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      startTime = BigNumber.from(currentTime).add(10);
      let tx = game.connect(admin).updateRound(
        1,
        currentTime,
        minPlayers,
        maxPlayers,
        entryPeriod,
        playPeriod,
        finalPeriod,
        entryAmount,
        adminFeeRate,
        roundFeeRate
      );
      await expect(tx).to.be.revertedWith("Invaild start time");

      tx = game.connect(admin).updateRound(
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
      );
      await expect(tx).to.be.revertedWith("Round has started");

    });

    it("player can do emergency withdrawal", async () => {
      const user = others[0];
      await increaseTime(10);
      await mockOwnd.mint(user.address, parseEther("10"));
      await mockOwnd.connect(user).approve(game.address, entryAmount);
      await expect(game.connect(user).enter(1, parseEther("0.8"))).to.be.revertedWith("GamePlayV2: insufficient deposit amount");
      result = await (await game.connect(user).enter(1, parseEther("1"))).wait(1);
      expect(result.events.find((e: any) => e.event == "Enter")).to.be.not.undefined;
      expect(await mockOwnd.balanceOf(user.address)).to.be.equals(parseEther("9"));
      await game.connect(user).emergencyWithdraw(1);
    });

    it("players can't deposit on the locked round", async () => {
      await increaseTime(10);
      for (let thisUser of [bob, carol, david, erin]) {
        await mockOwnd.mint(thisUser.address, parseEther("1000"));
        await mockOwnd.connect(thisUser).approve(game.address, entryAmount);
        await expect(game.connect(thisUser).enter(2, parseEther("1"))).to.be.revertedWith("GamePlay2: round locked");
      }
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
  
    it("can't update ranking and rewards with ranking 0", async () => {
      const tx = game.connect(admin).updateRankingRewards(1, bob.address, 0);
      await expect(tx).to.be.revertedWith("ranking out of range");
      const tx2 = game.connect(admin).updateRankingRewards(1, bob.address, 1 + ratesForRanking.length);
      await expect(tx).to.be.revertedWith("ranking out of range");
    });

    it("can't update ranking and rewards with no entry", async () => {
      const tx = game.connect(admin).updateRankingRewards(1, admin.address, 1);
      await expect(tx).to.be.revertedWith("not entered");
    });

    it("can update ranking and rewards", async () => {
      await game.connect(admin).updateRankingRewards(1, bob.address, 1);
      await game.connect(admin).updateRankingRewards(1, bob.address, 2);
      await game.connect(admin).updateRankingRewards(1, bob.address, 2);
      await game.connect(admin).updateRankingRewards(1, bob.address, 4);
      const tx = await (await game.connect(admin).updateRankingRewards(1, bob.address, 1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "UpdateRankingRewards")).to.be.not.undefined;
      const roundPlayerInfo = await game.roundPlayerInfo(1, bob.address);
      expect(roundPlayerInfo.ranking).to.be.equals(1);
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
  
    it("admin can't distribute rewards by rankings", async() => {
      const addresses = [bob.address, carol.address, david.address, erin.address];
      const rankings = [1,2,3,4];
      for (let i = 0; i<addresses.length; i++) 
        await game.connect(admin).updateRankingRewards(1, addresses[i], rankings[i]);
      await expect(game.connect(admin).distributeRewards(1)).to.be.revertedWith("distribute: already distributed");
    });
  

    it("Carol can't do emergencyWithdraw", async () => {
      let tx = game.connect(carol).emergencyWithdraw(1);
      await expect(tx).to.be.revertedWith("GamePlayV2: not entry period");
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
 
    it("can't change reward rates in the other periods", async () => {
      await expect(game.connect(admin).setRewardRates(2, ratesForRanking)).to.be.revertedWith("GamePlayV2: not setup period");
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
      await expect(game.connect(admin).updateRankingRewards(1, bob.address, 1)).revertedWith("GamePlayV2: not active period");
    });
  
    it("admin can't distribute rewards by rankings", async() => {
      const addresses = [bob.address, carol.address, david.address, erin.address];
      const rankings = [1,2,3,4];
      for (let i = 0; i<addresses.length; i++) 
        await expect(game.connect(admin).updateRankingRewards(1, addresses[i], rankings[i])).to.be.revertedWith("GamePlayV2: not active period");
      await expect(game.connect(admin).distributeRewards(1)).to.be.revertedWith("distribute: already distributed");
    });
  
    it("david can claim", async () => {
      const usr = david;
      const r = await verifyPendingRewards(1, usr.address);
      expect(await game.pendingRewards(1, usr.address)).to.be.equals(r);
      const prevBal = await mockOwnd.balanceOf(usr.address);
      console.log("balance before:", prevBal);
      const tx = await (await game.connect(usr).claim(1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "Claim")).to.be.not.undefined;
      const afterBal = r.add(prevBal);
      console.log("expected balance after:", afterBal);
      console.log("real balance after:", await mockOwnd.balanceOf(usr.address));
      expect(await mockOwnd.balanceOf(usr.address)).to.be.closeTo(r.add(prevBal), parseEther("0.1"));
    });
    
    it("david already claimed", async () => {
      const usr = david;
      const tx = game.connect(usr).claim(1);
      await expect(tx).to.be.revertedWith("Round: player already claimed");
    });
    
    it("Carol can claim in emergency", async () => {
      const tx = await(await game.connect(admin).emergencyClaim(1, carol.address, 1)).wait(1);
      expect(tx.events.find((e: any) => e.event == "EmergencyClaim")).to.be.not.undefined;
    });
    
    it("Carol can't do emergencyClaim", async () => {
      const tx = game.connect(admin).emergencyClaim(1, carol.address, 1);
      await expect(tx).to.be.revertedWith("Round: player already claimed");
    });
    
    it("Carol no pending rewards", async () => {
      expect(await game.pendingRewards(1, carol.address)).to.be.equals(0);
    });

    it("david can't claim on round 2", async () => {
      const usr = david;
      let tx = game.connect(usr).claim(2);
      await expect(tx).to.be.revertedWith("GamePlay2: round locked");
      await game.connect(admin).toogleLockRound(2);
      tx = game.connect(usr).claim(2);
      await expect(tx).to.be.revertedWith("Round: not distributed yet");
      await game.connect(admin).distributeRewards(2);
      tx = game.connect(usr).claim(2);
      await expect(tx).to.be.revertedWith("no rewards");
    });
  });
});
