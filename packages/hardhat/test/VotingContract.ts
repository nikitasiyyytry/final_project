import { expect } from "chai";
import { ethers } from "hardhat";
import { VotingContract } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("VotingContract", function () {
  let votingContract: VotingContract;
  let owner: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let voter3: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    const VotingContractFactory = await ethers.getContractFactory("VotingContract");
    votingContract = (await VotingContractFactory.deploy()) as VotingContract;
    await votingContract.waitForDeployment();
  });

  describe("Создание голосования", function () {
    it("Должно создать голосование с правильными параметрами", async function () {
      const title = "Выбор лучшего языка программирования";
      const description = "Голосование за самый популярный язык";
      const duration = 60; // 60 минут
      const candidates = ["JavaScript", "Python", "Solidity"];

      await expect(
        votingContract.createPoll(title, description, duration, candidates)
      ).to.emit(votingContract, "PollCreated");

      const pollInfo = await votingContract.getPollInfo(1);
      expect(pollInfo.title).to.equal(title);
      expect(pollInfo.description).to.equal(description);
      expect(pollInfo.candidatesCount).to.equal(3);
      expect(pollInfo.active).to.be.true;
    });

    it("Должно отклонить создание с менее чем 2 кандидатами", async function () {
      await expect(
        votingContract.createPoll("Test", "Description", 60, ["Only One"])
      ).to.be.revertedWith("Need at least 2 candidates");
    });
  });

  describe("Регистрация избирателей", function () {
    beforeEach(async () => {
      await votingContract.createPoll(
        "Test Poll",
        "Description",
        60,
        ["Option A", "Option B"]
      );
    });

    it("Создатель может регистрировать избирателей", async function () {
      await expect(
        votingContract.registerVoter(1, voter1.address)
      ).to.emit(votingContract, "VoterRegistered");

      const isRegistered = await votingContract.isVoterRegistered(1, voter1.address);
      expect(isRegistered).to.be.true;
    });

    it("Избиратель может зарегистрироваться сам", async function () {
      await expect(
        votingContract.connect(voter1).registerVoter(1, voter1.address)
      ).to.emit(votingContract, "VoterRegistered");
    });

    it("Должно отклонить повторную регистрацию", async function () {
      await votingContract.registerVoter(1, voter1.address);
      await expect(
        votingContract.registerVoter(1, voter1.address)
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Голосование", function () {
    beforeEach(async () => {
      await votingContract.createPoll(
        "Test Poll",
        "Description",
        60,
        ["Candidate 1", "Candidate 2", "Candidate 3"]
      );
      await votingContract.registerVoter(1, voter1.address);
      await votingContract.registerVoter(1, voter2.address);
    });

    it("Зарегистрированный избиратель может проголосовать", async function () {
      await expect(
        votingContract.connect(voter1).vote(1, 1)
      ).to.emit(votingContract, "Voted");

      const candidate = await votingContract.getCandidate(1, 1);
      expect(candidate.voteCount).to.equal(1);

      const hasVoted = await votingContract.hasVoterVoted(1, voter1.address);
      expect(hasVoted).to.be.true;
    });

    it("Должно отклонить голосование незарегистрированного избирателя", async function () {
      await expect(
        votingContract.connect(voter3).vote(1, 1)
      ).to.be.revertedWith("Not registered to vote");
    });

    it("Должно отклонить повторное голосование", async function () {
      await votingContract.connect(voter1).vote(1, 1);
      await expect(
        votingContract.connect(voter1).vote(1, 2)
      ).to.be.revertedWith("Already voted");
    });

    it("Должно правильно подсчитывать голоса", async function () {
      await votingContract.connect(voter1).vote(1, 1);
      await votingContract.connect(voter2).vote(1, 1);

      const candidate = await votingContract.getCandidate(1, 1);
      expect(candidate.voteCount).to.equal(2);

      const pollInfo = await votingContract.getPollInfo(1);
      expect(pollInfo.totalVotes).to.equal(2);
    });
  });

  describe("Завершение голосования", function () {
    beforeEach(async () => {
      await votingContract.createPoll(
        "Test Poll",
        "Description",
        60,
        ["Option A", "Option B"]
      );
    });

    it("Создатель может завершить голосование", async function () {
      await expect(
        votingContract.endPoll(1)
      ).to.emit(votingContract, "PollEnded");

      const pollInfo = await votingContract.getPollInfo(1);
      expect(pollInfo.active).to.be.false;
    });

    it("Не создатель не может завершить голосование", async function () {
      await expect(
        votingContract.connect(voter1).endPoll(1)
      ).to.be.revertedWith("Only creator can call this");
    });
  });

  describe("Получение информации", function () {
    beforeEach(async () => {
      await votingContract.createPoll(
        "Poll 1",
        "Description 1",
        60,
        ["A", "B"]
      );
      await votingContract.createPoll(
        "Poll 2",
        "Description 2",
        30,
        ["X", "Y"]
      );
    });

    it("Должно возвращать список всех голосований", async function () {
      const allPolls = await votingContract.getAllPolls();
      expect(allPolls.length).to.equal(2);
      expect(allPolls[0]).to.equal(1n);
      expect(allPolls[1]).to.equal(2n);
    });

    it("Должно возвращать информацию о кандидате", async function () {
      const candidate = await votingContract.getCandidate(1, 1);
      expect(candidate.name).to.equal("A");
      expect(candidate.voteCount).to.equal(0);
    });
  });
});