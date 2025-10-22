// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title UserRegistry - Phone number to EVM address mapping for DeXa Hedera Last Mile Access (Hedera)
/// @notice Minimal contract for early integration. Owner can register/unregister mappings.
///         Phone numbers are not stored in plaintext; only keccak256(phone) is stored on-chain.
contract UserRegistry {
    address public owner;

    // phoneHash -> EVM address
    mapping(bytes32 => address) private phoneToAddress;

    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event UserRegistered(bytes32 indexed phoneHash, address indexed user);
    event UserUnregistered(bytes32 indexed phoneHash, address indexed user);

    error NotOwner();
    error ZeroAddress();

    constructor(address _owner) {
        owner = _owner == address(0) ? msg.sender : _owner;
        emit OwnerChanged(address(0), owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function phoneHash(string memory phone) public pure returns (bytes32) {
        // Normalize the input on the client side (e.g., E.164) before passing it in.
        return keccak256(abi.encodePacked(phone));
    }

    function registerUser(string memory phone, address user) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        bytes32 h = phoneHash(phone);
        phoneToAddress[h] = user;
        emit UserRegistered(h, user);
    }

    function unregisterUser(string memory phone) external onlyOwner {
        bytes32 h = phoneHash(phone);
        address prev = phoneToAddress[h];
        require(prev != address(0), "No mapping");
        delete phoneToAddress[h];
        emit UserUnregistered(h, prev);
    }

    function resolve(string memory phone) external view returns (address) {
        return phoneToAddress[phoneHash(phone)];
    }
}

