// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @author The PlayEstates Developer Team
/// @title Game Enigne Contract
/// @notice Register a round, enter a round with entry fee, claim rewards
/// Admin can create a new round with the basic round info and set up the round environment.
/// Players deposit in the round with their entry fees required,
/// In the acivated period, they can claim their rewards, if they won the round under rankings
/// @dev An implemnetation contract for game engine, interacting with the admin and players

import "./GamePlayV2Storage.sol";

contract GamePlayV2 is GamePlayV2Storage {
    using SafeERC20 for IERC20;

    /// @notice Constructor
    /// @dev Store deployer's address as game engine factory's one
    constructor() {
        GAME_ENGINE_FACTORY = msg.sender;
    }

    /// @notice Initialize the game engine, called only once by the game engine factory
    /// @dev game engine needs to be secured and shouldn't be called by an attacker, called only by the deployer - game engine factory
    /// The entered and reward tokens has the same address in the game. The token would be named as OWND.
    /// Parent contract is initialized here.
    /// @param _enteredToken entered token address used in the game for game entry
    /// @param _rewardToken reward token address for the game which is the same as entry token
    /// @param _decimalsRewardToken decimals for reward token
    /// @param _admin contract admin address
    /// @param _treasury admin's treasury address
    /// @param _gameTreasury game treasury address
    /// @param _gameName game name
    /// @param _gameCompany game company name
    /// @param _gameMode game mode: 0- single, 1- multi, 2- complex
    function initialize(
        IERC20 _enteredToken,
        IERC20 _rewardToken,
        uint256 _decimalsRewardToken,
        address _admin,
        address _treasury,
        address _gameTreasury,
        string memory _gameName,
        string memory _gameCompany,
        uint256 _gameMode
    ) external initializer {
        require(_enteredToken == _rewardToken, "Tokens must be same");
        require(_decimalsRewardToken < 30, "Must be inferior to 30");
        enteredToken = _enteredToken;
        rewardToken = _rewardToken;

        gameInfo.walletAddress = _gameTreasury;
        gameInfo.gameName = _gameName;
        gameInfo.gameCompany = _gameCompany;
        gameInfo.gameMode = _gameMode;
        treasury = _treasury;
        PRECISION_FACTOR = uint256(10**(30 - _decimalsRewardToken));
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        require(msg.sender == GAME_ENGINE_FACTORY, "Not factory");
        roundId = 0;
    }

    /// @notice Create a round in game and initialize it. It is performed by administrators
    /// @dev This function is only callable by admininstrator.
    /// @param _startTime starting time of the round in seconds based on UTC
    /// @param _entryPeriod the period time of entering the round in seconds with the entry fee specified below
    /// @param _minPlayers minimum number of players required
    /// @param _maxPlayers maximum number of players required
    /// @param _playPeriod the period time that a user can play the game in the round
    /// @param _finalPeriod the period time of being reviewed and evaluated by the platform
    /// @param _entryAmount entry fee for the round
    /// @param _adminFeeRate admin's fee percentage between 0 - 99
    /// @param _roundFeeRate game company's fee percentage between 0 - 99 to be sent to game company's treasury
    /// @param _locked lock / unlock of the round
    function createRound(
        uint256 _startTime,
        uint256 _entryPeriod,
        uint256 _minPlayers,
        uint256 _maxPlayers,
        uint256 _playPeriod,
        uint256 _finalPeriod,
        uint256 _entryAmount,
        uint256 _adminFeeRate,
        uint256 _roundFeeRate,
        bool _locked
    ) external onlyOwner {
        require(
            _startTime >= block.timestamp,
            "Round: can't start at prior time"
        );
        require(_entryAmount > 0, "Round: entryAmount is 0");
        require(_maxPlayers > 0, "Round: max players is 0");

        roundId++;

        rounds[roundId] = Round({
            startTime: _startTime,
            entryPeriod: _entryPeriod,
            minPlayers: _minPlayers,
            maxPlayers: _maxPlayers,
            playPeriod: _playPeriod,
            finalPeriod: _finalPeriod,
            entryAmount: _entryAmount,
            adminFeeRate: _adminFeeRate,
            roundFeeRate: _roundFeeRate,
            distributed: false,
            locked: _locked
        });

        emit CreateRound(roundId);
    }

    // define admin role
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @dev throws if the caller is not default admin and not admin role
    modifier onlyOwner() {
        address account = msg.sender;
        require(
            hasRole(DEFAULT_ADMIN_ROLE, account) ||
                hasRole(ADMIN_ROLE, account),
            "Not admin"
        );
        _;
    }

    /// @dev throws if current is not setup period for the reward system configuration
    modifier setupPeriod(uint256 _roundId) {
        Round memory round = rounds[_roundId];
        require(
            block.timestamp < round.startTime + round.entryPeriod,
            "GamePlayV2: not setup period"
        );
        _;
    }
    /// @dev throws if current is not entry period for player deposit
    modifier entryPeriod(uint256 _roundId) {
        Round memory round = rounds[_roundId];
        require(
            round.startTime <= block.timestamp &&
                block.timestamp < round.startTime + round.entryPeriod,
            "GamePlayV2: not entry period"
        );
        _;
    }

    /// @dev throws if current is not active period
    modifier activePeriod(uint256 _roundId) {
        Round memory round = rounds[_roundId];
        require(
            round.startTime <= block.timestamp &&
                block.timestamp <
                round.startTime + round.entryPeriod + round.playPeriod,
            "GamePlayV2: not active period"
        );
        _;
    }

    /// @dev throws if current is not finalizing period
    modifier finalPeriod(uint256 _roundId) {
        Round memory round = rounds[_roundId];
        require(
            round.startTime + round.entryPeriod + round.playPeriod <=
                block.timestamp &&
                block.timestamp <
                round.startTime +
                    round.entryPeriod +
                    round.playPeriod +
                    round.finalPeriod,
            "GamePlayV2: not final period"
        );
        _;
    }

    /// @dev throws if the game is locked(=true)
    modifier notLocked(uint256 _roundId) {
        require(!rounds[_roundId].locked, "GamePlay2: round locked");
        _;
    }

    /// @notice Enter the round with token payment as a player
    /// @dev Not working on finialzing period or locked
    /// @param _roundId round id
    /// @param _amount amount for entry
    function enter(uint256 _roundId, uint256 _amount)
        external
        nonReentrant
        notLocked(_roundId)
        activePeriod(_roundId)
    {
        Round memory thisRound = rounds[_roundId];
        require(
            _amount >= thisRound.entryAmount,
            "GamePlayV2: insufficient deposit amount"
        );

        roundPlayers[_roundId].push(address(msg.sender));
        PlayerInfo storage player = roundPlayerInfo[_roundId][msg.sender];
        player.amount += _amount;

        enteredToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        enteredTokenSupplyMap[_roundId] += _amount;

        emit Enter(address(msg.sender), _amount, _roundId);
    }

    /// @notice Claim reward tokens as player
    /// @dev Works only in final period and unlocked status
    /// @param _roundId round id to be claimed (in rewardToken)
    function claim(uint256 _roundId)
        external
        nonReentrant
        notLocked(_roundId)
        finalPeriod(_roundId)
    {
        PlayerInfo storage player = roundPlayerInfo[_roundId][msg.sender];
        Round memory round = rounds[_roundId];

        uint256 rewards = player.rewards;
        bool claimed = player.claimed;

        require(round.distributed, "Round: not distributed yet");
        require(!claimed, "Round: player already claimed");
        require(rewards > 0, "no rewards");

        rewaredTokenSupplyMap[_roundId] += rewards;
        player.claimed = true;

        rewardToken.safeTransfer(address(msg.sender), rewards);

        emit Claim(msg.sender, rewards, _roundId);
    }

    /// @notice Withdraw entered tokens in the round as a player, without caring about rewards
    /// @dev Available only in the entry period with unlocked status.
    /// @param _roundId round id
    function emergencyWithdraw(uint256 _roundId)
        external
        notLocked(_roundId)
        nonReentrant
        entryPeriod(_roundId)
    {
        PlayerInfo storage player = roundPlayerInfo[_roundId][msg.sender];
        uint256 amountToTransfer = player.amount;
        player.amount = 0;

        enteredToken.safeTransfer(address(msg.sender), amountToTransfer);
        enteredTokenSupplyMap[_roundId] -= amountToTransfer;

        emit EmergencyWithdraw(_roundId, msg.sender, amountToTransfer);
    }

    /// @notice Emergency claim for rewards in the round as an admin
    /// @dev Works at any time as long as not locked and not claimed
    /// @param _roundId round id
    /// @param _player player's address
    /// @param _ranking ranking core
    function emergencyClaim(
        uint256 _roundId,
        address _player,
        uint256 _ranking
    ) external nonReentrant notLocked(_roundId) onlyOwner {
        _updateRankingRewards(_roundId, _player, _ranking);
        PlayerInfo storage player = roundPlayerInfo[_roundId][_player];
        bool claimed = player.claimed;
        require(!claimed, "Round: player already claimed");

        player.claimed = true;
        uint256 rewards = player.rewards;
        rewaredTokenSupplyMap[_roundId] += rewards;

        rewardToken.safeTransfer(_player, rewards);

        emit EmergencyClaim(_roundId, _player, _ranking);
    }

    /// @notice Withdraw system income to treasury
    /// @dev Withdrawal can be only done at once during the final period. the rate will be zero, once it is done
    /// Available only in the final period
    /// @param _roundId round id
    function withdrawToTreasury(uint256 _roundId)
        external
        finalPeriod(_roundId)
        nonReentrant
    {
        Round storage round = rounds[_roundId];
        require(round.adminFeeRate != 0, "admin rate is zero");
        uint256 totalIncome = enteredTokenSupplyMap[_roundId];
        uint256 adminIncome = (totalIncome * round.adminFeeRate) / 100;

        round.adminFeeRate = 0;
        enteredToken.safeTransfer(treasury, adminIncome);

        emit WithdrawToTreasury(_roundId, adminIncome);
    }

    /// @notice Withdraws the income share to game service treasury
    /// @dev Withdrawal can be only done at once during the final period. the rate will be zero, once it is done.
    /// Available only in the final period
    /// @param _roundId round id
    function withdrawToGameService(uint256 _roundId)
        external
        finalPeriod(_roundId)
        nonReentrant
    {
        Round storage round = rounds[_roundId];
        require(round.roundFeeRate != 0, "game service rate is zero");
        uint256 totalIncome = enteredTokenSupplyMap[_roundId];
        uint256 gameIncome = (totalIncome * round.roundFeeRate) / 100;

        round.roundFeeRate = 0;
        enteredToken.safeTransfer(gameInfo.walletAddress, gameIncome);
        emit WithdrawToGameService(_roundId, gameIncome);
    }

    /// @notice Getter remaining rewards
    /// @dev actual token amount is returned after deducting admin fee and game service fee
    /// @param _roundId round id
    /// @return remaining rewards for winners
    function remainingRewards(uint256 _roundId)
        external
        view
        returns (uint256)
    {
        return _remainingRewards(_roundId);
    }

    /// @notice Internal function to calculate remaining rewards
    /// @dev Deduct admin fee, round fee and rewared amount from totalIncome
    /// @param _roundId round id
    /// @return Remaining rewards for winners
    function _remainingRewards(uint256 _roundId)
        internal
        view
        returns (uint256)
    {
        Round memory round = rounds[_roundId];
        uint256 totalIncome = enteredTokenSupplyMap[_roundId];
        uint256 rewardedAmount = rewaredTokenSupplyMap[_roundId];
        uint256 adminRewardFee = (totalIncome * round.adminFeeRate) / 100;
        uint256 roundRewardFee = (totalIncome * round.roundFeeRate) / 100;
        return totalIncome - rewardedAmount - adminRewardFee - roundRewardFee;
    }

    /// @notice Distribute rewards in the round
    /// @dev the length of players should be same as one of rankings, it can be called by only owner.
    /// Able to do as long as not distributed.
    /// @param _roundId round id
    function distributeRewards(uint256 _roundId) external onlyOwner {
        require(
            !rounds[_roundId].distributed,
            "distribute: already distributed"
        );
        rounds[_roundId].distributed = true;
        emit DistributeRewards(_roundId);
    }

    /// @notice Update player's ranking and re-calculate the rewards
    /// @param _roundId round id
    /// @param _player player addresses
    /// @param _ranking player rankings
    function updateRankingRewards(
        uint256 _roundId,
        address _player,
        uint256 _ranking
    ) external onlyOwner activePeriod(_roundId) {
        _updateRankingRewards(_roundId, _player, _ranking);
        emit UpdateRankingRewards(_roundId, _player, _ranking);
    }

    /// @notice Internal function to update player's ranking and the rewards
    /// @param _roundId round id
    /// @param _player player addresses
    /// @param _ranking player rankings
    function _updateRankingRewards(
        uint256 _roundId,
        address _player,
        uint256 _ranking
    ) internal {
        require(_ranking > 0 && _ranking <= rewardRatesMap[_roundId].length, "ranking out of range");
        require(_isPlayerEntered(_roundId, _player), "not entered");
        uint256 oldRanking = roundPlayerInfo[_roundId][_player].ranking;

        if (oldRanking != _ranking) {
            roundPlayerInfo[_roundId][_player].ranking = _ranking;
            numberOfRankingMap[_roundId][_ranking - 1]++;
            totalRewardRateMap[_roundId] += rewardRatesMap[_roundId][_ranking - 1];
            if (oldRanking != 0) {
                totalRewardRateMap[_roundId] -= rewardRatesMap[_roundId][oldRanking - 1];
                numberOfRankingMap[_roundId][oldRanking - 1]--;
            }
            roundPlayerInfo[_roundId][_player].rewards = _calcRankingRewards(
                _roundId,
                _ranking
            );
        }
    }

    /// @notice Internal function to check if the player already entered or not
    /// @dev Checking the amount of player's deposit
    /// @param _roundId round id
    /// @param _player player address
    /// @return true if valid player, else false 
    function _isPlayerEntered(uint256 _roundId, address _player)
        internal
        view
        returns (bool)
    {
        return roundPlayerInfo[_roundId][_player].amount > 0 ? true : false;
    }

    /// @notice Update player's score as an admin
    /// @dev Use internal update function, activated in the active period
    /// @param _roundId round id
    /// @param _player player address
    /// @param _score score update
    function updateScore(
        uint256 _roundId,
        address _player,
        uint256 _score
    ) external onlyOwner activePeriod(_roundId) {
        _updateScore(_roundId, _player, _score);
        emit UpdateScore(_roundId, _player, _score);
    }

    /// @notice Internal function to update player's score
    /// @dev Change the player score
    /// @param _roundId: round id
    /// @param _player: player address
    /// @param _score: score update

    function _updateScore(
        uint256 _roundId,
        address _player,
        uint256 _score
    ) internal {
        unchecked {
            roundPlayerInfo[_roundId][_player].score = _score;
        }
    }

    /// @notice Update the round specified by id as an admin
    /// @dev Don't update locked field, available only in the setup period,
    /// Only can be updated before the round is started
    /// @param _roundId round id
    /// @param _startTime starting time of the round in seconds based on UTC
    /// @param _minPlayers minimum number of players required
    /// @param _maxPlayers maximum number of players required
    /// @param _entryPeriod the period time of entering the round in seconds with the entry fee specified below
    /// @param _playPeriod the period time that a user can play the game in the round
    /// @param _finalPeriod the period time of being reviewed and evaluated by the platform
    /// @param _entryAmount entry fee for the round
    /// @param _adminFeeRate admin's fee percentage between 0 - 99
    /// @param _roundFeeRate game company's fee percentage between 0 - 99 to be sent to game company's treasury
    function updateRound(
        uint256 _roundId,
        uint256 _startTime,
        uint256 _minPlayers,
        uint256 _maxPlayers,
        uint256 _entryPeriod,
        uint256 _playPeriod,
        uint256 _finalPeriod,
        uint256 _entryAmount,
        uint256 _adminFeeRate,
        uint256 _roundFeeRate
    ) external onlyOwner setupPeriod(_roundId) {
        Round storage round = rounds[_roundId];
        require(block.timestamp < _startTime, "Invaild start time");
        require(block.timestamp < round.startTime, "Round has started");

        round.startTime = _startTime;
        round.minPlayers = _minPlayers;
        round.maxPlayers = _maxPlayers;
        round.entryPeriod = _entryPeriod;
        round.playPeriod = _playPeriod;
        round.finalPeriod = _finalPeriod;
        round.entryAmount = _entryAmount;
        round.adminFeeRate = _adminFeeRate;
        round.roundFeeRate = _roundFeeRate;

        emit UpdateRound(
            _roundId,
            _startTime,
            _minPlayers,
            _maxPlayers,
            _entryPeriod,
            _playPeriod,
            _finalPeriod,
            _entryAmount,
            _adminFeeRate,
            _roundFeeRate
        );
    }

    /// @notice Switch the round to locked/unclocked as an admin
    /// @param _roundId round id
    function toogleLockRound(uint256 _roundId) external onlyOwner {
        Round storage round = rounds[_roundId];
        round.locked = !round.locked;
        emit ToggleLockedRound(_roundId);
    }

    /// @notice View function to see pending reward on frontend.
    /// @dev Zero, if the user already claimed
    /// @param _roundId round id
    /// @param _player player address
    /// @return Pending reward for a given player
    function pendingRewards(uint256 _roundId, address _player)
        external
        view
        returns (uint256)
    {
        PlayerInfo storage player = roundPlayerInfo[_roundId][_player];
        if (player.claimed) {
            return 0;
        }

        uint256 rewards = _calcPlayerRewards(_roundId, _player);
        return rewards;
    }

    /// @notice Internal function to calculate rewards according to the ranking
    /// @dev Load array state variables on memory to save gas
    /// @param _roundId round id
    /// @param _ranking player ranking
    /// @return rewards for ranking
    function _calcRankingRewards(uint256 _roundId, uint256 _ranking)
        internal
        view
        returns (uint256)
    {
        uint256 totalRewardRate = totalRewardRateMap[_roundId];
        uint256[] memory rewardRates = rewardRatesMap[_roundId];
        if (_ranking == 0 || _ranking > rewardRates.length) return 0;

        return
            totalRewardRate > 0
                ? (rewardRates[_ranking - 1] * _remainingRewards(_roundId)) /
                    totalRewardRate
                : 0;
    }

    /// @notice Internal function to calculate player rewards
    /// @dev Use _calcRankingRewards internally
    /// @param _roundId round id
    /// @param _player player address
    /// @return rewards for player
    function _calcPlayerRewards(uint256 _roundId, address _player)
        internal
        view
        returns (uint256)
    {
        PlayerInfo storage player = roundPlayerInfo[_roundId][_player];
        return _calcRankingRewards(_roundId, player.ranking);
    }

    /// @notice Set up rewards rate according to rankings as an admin.
    /// @dev Reward rates are entered as an array
    /// @param _roundId round id
    /// @param _rewardRates array of reward rates
    function setRewardRates(uint256 _roundId, uint256[] memory _rewardRates)
        external
        onlyOwner
        setupPeriod(_roundId)
    {
        require(_rewardRates.length > 0, "Round: reward rate list is empty");
        numberOfRankingMap[_roundId] = new uint256[](_rewardRates.length);
        rewardRatesMap[_roundId] = _rewardRates;
        emit SetRewardRates(_roundId, _rewardRates);
    }
}
