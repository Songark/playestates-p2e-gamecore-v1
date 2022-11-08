# PlayEstates Game Engine

P2E Smart contracts which manage game and round information, user entry fees and rewards.

The repository contains the smart contracts for P2E platform at PlayEstates. The repository uses Hardhat as development enviroment for compilation, testing and deployment tasks.

In order to take a look into the diagram for the entire structure, please refer to the [class diagram](classDiagram.svg).

Technical and functional requirements are described [here](READY.md).

## Summary
### Structure
The repo mainly includes `GamePlayV2Factory`, `GamePlayV2Storage` and `GamePlayV2` contracts.

| Contract name  | Description                              | Solidity version(s)      |
| -------------- | ---------------------------------------- | ------------------------ |
| [GamePlayV2Factory](./contracts/GamePlayV2Factory.sol) | Factory contract to register and initialize a new game engine contract. `GamePlayV2` contract instance will be created.| 0.8.4 |
| [GamePlayV2Storage](./contracts/GamePlayV2Storage.sol) | Abstract contract to manage state variables, events, structs used in `GamePlayV2` engine contract| 0.8.4 |
| [GamePlayV2](./contracts/GamePlayV2.sol) | Game engine logic contract to manage rounds, scores, rankings, rewards, which is derived from `GamePlayV2Storage`| 0.8.4 |

### Periods
The game engine works with 4 periods, once it is created and deployed.
The table below will describe how the engine works with a player and owner.

| No  | Period name                                         | Description               |
| --- | --------------------------------------------------- | ------------------------- |
| 1 | Setup Period | Duration until entry period is ended up after the contract is deployed and initialized. In this period, an admin can set up additional game engine settings such as ranking rates or round update.|
| 2 | Entry Period | Duration of entrying into the game by making deposit with OWND token which a player have, since the game round is started. In this period, a player / user can make a deposit or withdraw their funds and then go to play the game. It is not allowed to update game and round info after the period is started. |
| 3 | Active Period | Duration from when a round is started to when playing is ended up. In this period, a player / user can still make a deposit to play the game, but not allowed to withdraw the funds or claim the rewards. There are some features can be executed in this period such as updating a score, ranking and rewards which is performed by owner. It is not allowed to update game and round info after the period is started. |
| 4 | Final Period | Duration from when playing period is ended up and to when the round is expired. A player / user can claim rewards in OWND token according to the rankings for rewards. Game service and System can withdraw their incomes according to the contracted share rate. |


## How to Run
This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

Try running following tasks to compile and test smart contracts on hardhat local network.

- Compiling smart contracts

```shell
npx hardhat clean
npx hardhat compile
```
- Testing smart contracts

```shell
npx hardhat test
```
- Testing smart contracts with gas report
```shell
REPORT_GAS=true npx hardhat test
```
- Code coverage
```shell
npx hardhat coverage
```
- Others

```shell
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```
