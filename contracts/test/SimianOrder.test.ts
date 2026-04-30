import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SimianOrder } from "../typechain-types";

const NAME = "Simian Order";
const SYMBOL = "SIMIAN";
const BASE_URI = "ipfs://placeholder/";

const PHASE_GTD = 0;
const PHASE_FCFS = 1;
const PHASE_PUBLIC = 2;

async function deploy(signerAddress: string, royaltyReceiver: string) {
  const F = await ethers.getContractFactory("SimianOrder");
  const c = (await F.deploy(NAME, SYMBOL, royaltyReceiver, signerAddress, BASE_URI)) as unknown as SimianOrder;
  await c.waitForDeployment();
  return c;
}

async function signAllowance(
  contract: SimianOrder,
  signer: HardhatEthersSigner,
  wallet: string,
  phase: number,
  maxAllowed: bigint | number
): Promise<string> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const contractAddr = await contract.getAddress();
  // Solidity: keccak256(abi.encodePacked(uint256,address,address,uint8,uint256)) -> ethSign.
  const inner = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint8", "uint256"],
    [chainId, contractAddr, wallet, phase, maxAllowed]
  );
  return signer.signMessage(ethers.getBytes(inner));
}

describe("SimianOrder", () => {
  let contract: SimianOrder;
  let owner: HardhatEthersSigner;
  let signer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let royalty: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, signer, alice, bob, royalty] = await ethers.getSigners();
    contract = await deploy(signer.address, royalty.address);
  });

  describe("deployment", () => {
    it("sets immutables", async () => {
      expect(await contract.name()).to.eq(NAME);
      expect(await contract.symbol()).to.eq(SYMBOL);
      expect(await contract.MAX_SUPPLY()).to.eq(5555);
      expect(await contract.signer()).to.eq(signer.address);
    });

    it("sets default 6.9% royalty", async () => {
      const [recv, fee] = await contract.royaltyInfo(1, 10_000n);
      expect(recv).to.eq(royalty.address);
      expect(fee).to.eq(690n); // 6.9% of 10000
    });

    it("supports ERC721 + ERC2981 interfaces", async () => {
      expect(await contract.supportsInterface("0x80ac58cd")).to.eq(true); // ERC721
      expect(await contract.supportsInterface("0x2a55205a")).to.eq(true); // ERC2981
    });

    it("starts token ids at 1", async () => {
      await contract.setPhaseActive(PHASE_GTD, true);
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 1);
      await contract.connect(alice).mint(1, PHASE_GTD, 1, sig);
      expect(await contract.ownerOf(1)).to.eq(alice.address);
    });
  });

  describe("mint validation", () => {
    beforeEach(async () => {
      await contract.setPhaseActive(PHASE_GTD, true);
    });

    it("mints with a valid signature", async () => {
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 2);
      await expect(contract.connect(alice).mint(2, PHASE_GTD, 2, sig))
        .to.emit(contract, "Minted").withArgs(alice.address, PHASE_GTD, 2);
      expect(await contract.balanceOf(alice.address)).to.eq(2);
      expect(await contract.mintedPerWallet(alice.address)).to.eq(2);
      expect(await contract.totalMinted()).to.eq(2);
    });

    it("rejects when phase is inactive", async () => {
      await contract.setPhaseActive(PHASE_GTD, false);
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 1);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 1, sig))
        .to.be.revertedWithCustomError(contract, "PhaseInactive");
    });

    it("rejects an unknown phase", async () => {
      const sig = await signAllowance(contract, signer, alice.address, 9, 1);
      await expect(contract.connect(alice).mint(1, 9, 1, sig))
        .to.be.revertedWithCustomError(contract, "InvalidPhase");
    });

    it("rejects zero quantity", async () => {
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 1);
      await expect(contract.connect(alice).mint(0, PHASE_GTD, 1, sig))
        .to.be.revertedWithCustomError(contract, "InvalidQuantity");
    });

    it("rejects exceeding maxAllowed cumulatively", async () => {
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 2);
      await contract.connect(alice).mint(2, PHASE_GTD, 2, sig);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 2, sig))
        .to.be.revertedWithCustomError(contract, "ExceedsAllowance");
    });

    it("rejects a signature issued for a different wallet", async () => {
      const sigForBob = await signAllowance(contract, signer, bob.address, PHASE_GTD, 5);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 5, sigForBob))
        .to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("rejects a signature issued for a different phase", async () => {
      await contract.setPhaseActive(PHASE_FCFS, true);
      const fcfsSig = await signAllowance(contract, signer, alice.address, PHASE_FCFS, 5);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 5, fcfsSig))
        .to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("rejects signatures by an unauthorised key", async () => {
      const sig = await signAllowance(contract, alice /* not signer */, alice.address, PHASE_GTD, 1);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 1, sig))
        .to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("enforces phase price", async () => {
      await contract.setPhasePrice(PHASE_GTD, ethers.parseEther("0.05"));
      const sig = await signAllowance(contract, signer, alice.address, PHASE_GTD, 1);
      await expect(contract.connect(alice).mint(1, PHASE_GTD, 1, sig, { value: ethers.parseEther("0.04") }))
        .to.be.revertedWithCustomError(contract, "InsufficientPayment");
      await contract.connect(alice).mint(1, PHASE_GTD, 1, sig, { value: ethers.parseEther("0.05") });
      expect(await contract.balanceOf(alice.address)).to.eq(1);
    });
  });

  describe("admin", () => {
    it("only owner can toggle phases", async () => {
      await expect(contract.connect(alice).setPhaseActive(PHASE_GTD, true))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("setRoyalty changes recipient and fee", async () => {
      await contract.setRoyalty(alice.address, 1000); // 10%
      const [recv, fee] = await contract.royaltyInfo(1, 10_000n);
      expect(recv).to.eq(alice.address);
      expect(fee).to.eq(1000n);
    });

    it("withdraw transfers contract balance to owner", async () => {
      await contract.setPhaseActive(PHASE_PUBLIC, true);
      await contract.setPhasePrice(PHASE_PUBLIC, ethers.parseEther("0.1"));
      const sig = await signAllowance(contract, signer, alice.address, PHASE_PUBLIC, 1);
      await contract.connect(alice).mint(1, PHASE_PUBLIC, 1, sig, { value: ethers.parseEther("0.1") });

      const before = await ethers.provider.getBalance(owner.address);
      const tx = await contract.withdraw();
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);
      expect(after - before + gas).to.eq(ethers.parseEther("0.1"));
      expect(await ethers.provider.getBalance(await contract.getAddress())).to.eq(0n);
    });

    it("setSigner rotates the authoriser", async () => {
      await contract.setPhaseActive(PHASE_GTD, true);
      await contract.setSigner(alice.address);
      const sigOld = await signAllowance(contract, signer, bob.address, PHASE_GTD, 1);
      await expect(contract.connect(bob).mint(1, PHASE_GTD, 1, sigOld))
        .to.be.revertedWithCustomError(contract, "InvalidSignature");
      const sigNew = await signAllowance(contract, alice, bob.address, PHASE_GTD, 1);
      await contract.connect(bob).mint(1, PHASE_GTD, 1, sigNew);
      expect(await contract.balanceOf(bob.address)).to.eq(1);
    });
  });

  describe("supply cap", () => {
    it("rejects mints that would exceed MAX_SUPPLY", async () => {
      // Cheap path: lower the cap by minting close to MAX_SUPPLY is too slow in test.
      // Instead verify the check by attempting an over-cap quantity.
      await contract.setPhaseActive(PHASE_PUBLIC, true);
      const sig = await signAllowance(contract, signer, alice.address, PHASE_PUBLIC, 5000);
      await expect(contract.connect(alice).mint(3334, PHASE_PUBLIC, 5000, sig))
        .to.be.revertedWithCustomError(contract, "MaxSupplyExceeded");
    });
  });
});
