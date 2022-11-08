// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @author The PlayEstates Developer Team
/// @title A Factory contract to create multiple game engines.
/// @notice Use this contract only if a new game is registered on the platform.
/// @dev Singleton factory to deploy game engine contracts, which is deployed only once

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GamePlayV2.sol";

contract GamePlayV2Factory is AccessControl {
    /// @notice emitted when a new game engine is deployed
    event NewGamePlayV2Contract(address indexed gamePlayV2);
    /// @dev constant to represent admin role
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @dev Constructor
    /// grant msg.sender with owner permission
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice check if a caller has admin role or not
    /// @dev implements it when a new game engine is deployed,
    /// game engines can be deployed by the contract owner or admin
    modifier onlyOwner() {
        address account = msg.sender;
        require(
            hasRole(DEFAULT_ADMIN_ROLE, account) ||
                hasRole(ADMIN_ROLE, account),
            "Not admin"
        );
        _;
    }

    /// @notice Deployment function to deploy a game engine contract with the basic information required
    /// @dev Only deployer can deploy a new game engine
    /// @param _enteredToken: entry token address for deposit
    /// @param _rewardToken: reward token address for claim
    /// @param _decimalsRewardToken: decimals for reward token
    /// @param _admin: system admin address as an owner
    /// @param _treasury: singer address
    /// @param _gameName: game name
    /// @param _gameCompany: game company name
    /// @param _gameMode: game mode (0: single, 1: multi)
    function deployGamePlayV2(
        IERC20 _enteredToken,
        IERC20 _rewardToken,
        uint256 _decimalsRewardToken,
        address _admin,
        address _treasury,
        address _gameTreasury,
        string memory _gameName,
        string memory _gameCompany,
        uint256 _gameMode
    ) external onlyOwner {
        /// reward tokens and entry tokens should be supplied prior to deployment
        require(_enteredToken.totalSupply() > 0, "No supply");
        require(_rewardToken.totalSupply() > 0, "No supply");

        bytes memory bytecode = type(GamePlayV2).creationCode;
        bytes32 salt = keccak256(
            abi.encodePacked(_enteredToken, _rewardToken, block.number)
        );
        address gamePlayV2Address;

        assembly {
            gamePlayV2Address := create2(
                0,
                add(bytecode, 32),
                mload(bytecode),
                salt
            )
        }
        /// Initialize the game engine created. it can be done only once, during the deployment
        GamePlayV2(gamePlayV2Address).initialize(
            _enteredToken,
            _rewardToken,
            _decimalsRewardToken,
            _admin,
            _treasury,
            _gameTreasury,
            _gameName,
            _gameCompany,
            _gameMode
        );

        emit NewGamePlayV2Contract(gamePlayV2Address);
    }
}
