// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title  Simian Order
/// @notice ERC-721A collection with three signed mint phases and on-chain royalties.
/// @dev    Single mint entry-point gated by an ECDSA allowance signed off-chain by `signer`.
///         The signed digest binds chain id, contract address, caller, phase and maxAllowed,
///         which prevents cross-contract / cross-chain replay and signature swap between users.
contract SimianOrder is ERC721A, ERC2981, Ownable, ReentrancyGuard {
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MAX_SUPPLY          = 3333;
    uint96  public constant DEFAULT_ROYALTY_BPS = 690; // 6.90%

    uint8 public constant PHASE_GTD    = 0;
    uint8 public constant PHASE_FCFS   = 1;
    uint8 public constant PHASE_PUBLIC = 2;

    // ─── Storage ──────────────────────────────────────────────────────────────

    address public signer;
    string  private _baseTokenURI;

    /// @notice Tokens minted by a wallet across all phases.
    mapping(address => uint256) public mintedPerWallet;

    /// @notice Whether each phase (0..2) is currently accepting mints.
    mapping(uint8 => bool) public phaseActive;

    /// @notice Optional per-phase price in wei. Defaults to 0.
    mapping(uint8 => uint256) public phasePrice;

    // ─── Events ───────────────────────────────────────────────────────────────

    event PhaseActiveSet(uint8 indexed phase, bool active);
    event PhasePriceSet (uint8 indexed phase, uint256 price);
    event SignerUpdated (address indexed signer);
    event BaseURIUpdated(string baseURI);
    event Withdrawn     (address indexed to, uint256 amount);
    event Minted        (address indexed buyer, uint8 indexed phase, uint256 quantity);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidPhase();
    error PhaseInactive();
    error MaxSupplyExceeded();
    error ExceedsAllowance();
    error InvalidSignature();
    error InvalidQuantity();
    error InsufficientPayment();
    error ZeroAddress();
    error WithdrawFailed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        string memory name_,
        string memory symbol_,
        address royaltyReceiver_,
        address signer_,
        string memory baseURI_
    ) ERC721A(name_, symbol_) Ownable(msg.sender) {
        if (royaltyReceiver_ == address(0) || signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        _baseTokenURI = baseURI_;
        _setDefaultRoyalty(royaltyReceiver_, DEFAULT_ROYALTY_BPS);
        emit SignerUpdated(signer_);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /// @notice Mint `quantity` tokens for `phase`. The signature authorises caller
    ///         up to `maxAllowed` cumulative tokens across all phases.
    /// @param  quantity   Number of tokens to mint in this call.
    /// @param  phase      0=GTD, 1=FCFS, 2=Public.
    /// @param  maxAllowed Cumulative cap on caller's mints (signed off-chain).
    /// @param  signature  ECDSA signature over the message produced by `digestFor`.
    function mint(
        uint256 quantity,
        uint8   phase,
        uint256 maxAllowed,
        bytes calldata signature
    ) external payable nonReentrant {
        if (quantity == 0)                          revert InvalidQuantity();
        if (phase > PHASE_PUBLIC)                   revert InvalidPhase();
        if (!phaseActive[phase])                    revert PhaseInactive();
        if (_totalMinted() + quantity > MAX_SUPPLY) revert MaxSupplyExceeded();

        uint256 newCount = mintedPerWallet[msg.sender] + quantity;
        if (newCount > maxAllowed)                  revert ExceedsAllowance();

        uint256 cost = phasePrice[phase] * quantity;
        if (msg.value < cost)                       revert InsufficientPayment();

        if (!_isValidSignature(msg.sender, phase, maxAllowed, signature)) {
            revert InvalidSignature();
        }

        mintedPerWallet[msg.sender] = newCount;
        _mint(msg.sender, quantity);

        emit Minted(msg.sender, phase, quantity);
    }

    /// @notice Returns the exact eth-signed digest the contract recovers against.
    /// @dev    Off-chain signers should sign this digest verbatim.
    function digestFor(
        address wallet,
        uint8 phase,
        uint256 maxAllowed
    ) external view returns (bytes32) {
        return _digest(wallet, phase, maxAllowed);
    }

    function _isValidSignature(
        address wallet,
        uint8 phase,
        uint256 maxAllowed,
        bytes calldata signature
    ) internal view returns (bool) {
        return _digest(wallet, phase, maxAllowed).recover(signature) == signer;
    }

    function _digest(
        address wallet,
        uint8 phase,
        uint256 maxAllowed
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(block.chainid, address(this), wallet, phase, maxAllowed)
        ).toEthSignedMessageHash();
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setPhaseActive(uint8 phase, bool active) external onlyOwner {
        if (phase > PHASE_PUBLIC) revert InvalidPhase();
        phaseActive[phase] = active;
        emit PhaseActiveSet(phase, active);
    }

    function setPhasePrice(uint8 phase, uint256 price) external onlyOwner {
        if (phase > PHASE_PUBLIC) revert InvalidPhase();
        phasePrice[phase] = price;
        emit PhasePriceSet(phase, price);
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function setRoyalty(address receiver, uint96 fee) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        _setDefaultRoyalty(receiver, fee);
    }

    function setBaseURI(string calldata newBase) external onlyOwner {
        _baseTokenURI = newBase;
        emit BaseURIUpdated(newBase);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        (bool ok, ) = payable(owner()).call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner(), bal);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    // ─── ERC721A overrides ────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721A, ERC2981) returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
