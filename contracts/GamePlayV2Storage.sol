// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @author The PlayEstates Developer Team
/// @title Storage contract to manage state variables and events
/// @notice Use this only for the game engine contract - GamePlayV2.
/// @dev An abstract contract which provides structs, state variables and events

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract GamePlayV2Storage is
    AccessControl,
    ReentrancyGuard,
    Initializable
{
    // entry token supply in the round
    mapping(uint256 => uint256) public enteredTokenSupplyMap;

    // reward token supply in the round
    mapping(uint256 => uint256) public rewaredTokenSupplyMap;

    // address of game engine factory
    address public GAME_ENGINE_FACTORY;

    // precision factor
    uint256 public PRECISION_FACTOR;

    //public round id
    uint256 public roundId;

    // reward token
    IERC20 public rewardToken;

    // entered token
    IERC20 public enteredToken;

    // address of the platform treasury
    address public treasury;

    // game info
    GameInfo public gameInfo;

    // round info corresponding to round id
    mapping(uint256 => Round) public rounds;

    // player info to the player address in the round
    mapping(uint256 => mapping(address => PlayerInfo)) public roundPlayerInfo;

    // player address list in the round
    mapping(uint256 => address[]) public roundPlayers;

    // reward rate list in the round. Index 0 means rank 1
    mapping(uint256 => uint256[]) public rewardRatesMap;

    // total reward rate
    mapping(uint256 => uint256) public totalRewardRateMap;

    // number of ranked players in the round. Index 0 means rank 1
    mapping(uint256 => uint256[]) public numberOfRankingMap;

    // Player Information Struct
    struct PlayerInfo {
        uint256 amount; // How many entered tokens the player has provided
        uint256 ranking; // Ranking of score
        uint256 score; // score earned from game round
        uint256 rewards; // Rewards
        bool claimed; // is claimed ?
    }

    // Game Information Structure
    struct GameInfo {
        address walletAddress;
        string gameName;
        string gameCompany;
        uint256 gameMode;
    }

    // Round Information Struct
    struct Round {
        uint256 startTime;
        uint256 entryPeriod;
        uint256 minPlayers;
        uint256 maxPlayers;
        uint256 playPeriod;
        uint256 finalPeriod;
        uint256 entryAmount;
        uint256 adminFeeRate;
        uint256 roundFeeRate;
        bool distributed;
        bool locked;
    }

    /// @dev emitted when a round is created
    event CreateRound(uint256 indexed roundId);

    /// @dev emitted when owner recovers the old tokens.
    event AdminTokenRecovery(address indexed tokenRecovered, uint256 amount);

    /// @dev emitted when a player deposits entry amount of token
    event Enter(address indexed player, uint256 amount, uint256 round);

    /// @dev emitted when a player withdraws his deposit
    event EmergencyWithdraw(
        uint256 round,
        address indexed player,
        uint256 amount
    );

    /// @dev emitted when player's rewards are claimed by the admin in emergency
    event EmergencyClaim(
        uint256 indexed roundId,
        address indexed player,
        uint256 ranking
    );

    /// @dev emitted when a player claims the rewards
    event Claim(address indexed player, uint256 amount, uint256 round);

    /// @dev emitted when the owner updates the round
    event UpdateRound(
        uint256 indexed roundId,
        uint256 startTime,
        uint256 minPlayers,
        uint256 maxPlayers,
        uint256 entryPeriod,
        uint256 playPeriod,
        uint256 finalPeriod,
        uint256 entryAmount,
        uint256 adminFeeRate,
        uint256 roundFeeRate
    );

    /// @dev emitted when the owner call the function
    event DistributeRewards(uint256 indexed roundId);

    /// @dev emitted when the owner locks the round
    event ToggleLockedRound(uint256 indexed roundId);

    /// @dev emitted when the owner updates a player score
    event UpdateScore(uint256 indexed roundId, address indexed player, uint256 score);

    /// @dev emitted when the owner update a player ranking
    event UpdateRankingRewards(
        uint256 indexed roundId,
        address indexed player,
        uint256 score
    );

    /// @dev emitted when the withdrawal to system treasury occurs successfully
    event WithdrawToTreasury(uint256 indexed roundId, uint256 amount);

    /// @dev emitted when the withdrawal to game service treasury occurs successfully
    event WithdrawToGameService(uint256 indexed roundId, uint256 amount);

    /// @dev emitted when setting reward rates is triggered
    event SetRewardRates(uint256 indexed roundId, uint256[] rewardRates);
}
