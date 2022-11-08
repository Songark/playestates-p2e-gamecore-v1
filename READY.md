# PlayEstates Game Engine Smart Contracts

## Functionality requirements

This section will describe what elements are connected with the contracts and what their roles are in.


### Games
- All the games which are in partnership with PlayEstates can interact with our Game Eninge contracts.
- They never take care how the game engine contract works, but they will have to implement functionalities to transmit player score and rankings to our ecosystem, whenever users finish playing a game or special events happen.
- PlayEstates register the game company only once when having a partnership, but they will be asked when a new round is created for their game.
- Game engine smart contract allows PlayEstates members or users to play multi or single games in specific round period, which is created by the platform adiministrator.
Players just enters the round by paying round entry fee and enjoy their games.
- They will be able to withdraw the income to their treasury wallet.

### PlayEstates Administrators
- Admin can register a new game, it means that he can create a new game engine smart contract using their game info on the platform.
  It will be performed by calling `deployGamePlayV2(...)` funtion in game engine factory contract.
  Game Engine contract only will be managed by Administrators.
- They can create a new round or update it in specific game with relevant round information.
 (Round information is described in `GamePlayV2.sol`)
- They can set up reward rates, update rankings or scors of players in the round.
- They can lock/unlock the round.
- They can distribute rewards to players who joint into the round.
- They can transfer rewards to specific user in emergancy.
- They will be able to withdraw their income to the treasury.

### Users / Players
- Users can join into the round created by paying the entry fee specified in the contract round
- They can withdraw their deposit at any time in the entry period.
- They can claim their rewards in the final period.
- It's possible for them to check their pending rewards at any time.



## Technical description

### Programming languages
- Solidity version 0.8.4
- Javascript, Typescript

### Technologies
- Hardhat platform for building, testing, and deploying this project
  - Hardhat configuration
  - Hardhat plugins for checking contract size and used gas cost
  - hardhat-contract-sizer, hardhat-gas-reporter
- ERC20 protocol for payment option tokens
- ReentrancyGuardUpgradeable for preventing attacks
- Upgradable context and Clone feature for optimizing contract size
- Round locking, Role processing
- Solidity-coverage for testing all features, functions, and codes
- Solidity-docgen for generating full documentation about source codes
- Sol2uml for generating the class diagram automatically

### Deployment instructions
- Deploy Marketplace Engine, Membership/Custom NFT, and PBRT Token contracts
    ```shell
    npx hardhat clean
    npx hardhat compile
    ```
- In order to deploy on other chains like polygon main or mumbai, please config additional information on the hardhat.config.js file.



## Test instructions

### Unit test
- Test pretty much features of the Marketplace Engine, Membership/Custom NFT, and PBRT Token contracts
    ```shell
    npx hardhat clean
    npx hardhat compile    
    npx hardhat test
    ```
- There are about 74 test cases for the positive and negative testing scenarios 