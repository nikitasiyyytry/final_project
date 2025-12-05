import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const deployVotingContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("VotingContract", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Получаем развернутый контракт
  const votingContract = await hre.ethers.getContract<Contract>("VotingContract", deployer);
  console.log("✅ VotingContract deployed at:", await votingContract.getAddress());
};

export default deployVotingContract;

deployVotingContract.tags = ["VotingContract"];