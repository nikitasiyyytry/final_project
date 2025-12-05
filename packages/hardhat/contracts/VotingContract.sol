// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VotingContract
 * @dev Смарт-контракт для децентрализованного голосования
 */
contract VotingContract {
    
    // Структура для кандидата
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    // Структура для голосования
    struct Poll {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool active;
        address creator;
        mapping(uint256 => Candidate) candidates;
        uint256 candidatesCount;
        mapping(address => bool) hasVoted;
        mapping(address => bool) isRegistered;
        uint256 totalVotes;
    }
    
    // Хранилище голосований
    mapping(uint256 => Poll) public polls;
    uint256 public pollsCount;
    
    // События
    event PollCreated(
        uint256 indexed pollId,
        string title,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );
    
    event CandidateAdded(
        uint256 indexed pollId,
        uint256 candidateId,
        string name
    );
    
    event VoterRegistered(
        uint256 indexed pollId,
        address indexed voter
    );
    
    event Voted(
        uint256 indexed pollId,
        address indexed voter,
        uint256 candidateId
    );
    
    event PollEnded(uint256 indexed pollId);
    
    // Модификаторы
    modifier pollExists(uint256 _pollId) {
        require(_pollId > 0 && _pollId <= pollsCount, "Poll does not exist");
        _;
    }
    
    modifier onlyCreator(uint256 _pollId) {
        require(polls[_pollId].creator == msg.sender, "Only creator can call this");
        _;
    }
    
    modifier pollActive(uint256 _pollId) {
        require(polls[_pollId].active, "Poll is not active");
        require(block.timestamp >= polls[_pollId].startTime, "Poll has not started yet");
        require(block.timestamp <= polls[_pollId].endTime, "Poll has ended");
        _;
    }
    
    /**
     * @dev Создать новое голосование
     */
    function createPoll(
        string memory _title,
        string memory _description,
        uint256 _durationInMinutes,
        string[] memory _candidateNames
    ) public returns (uint256) {
        require(_candidateNames.length >= 2, "Need at least 2 candidates");
        require(_durationInMinutes > 0, "Duration must be positive");
        
        pollsCount++;
        Poll storage newPoll = polls[pollsCount];
        
        newPoll.id = pollsCount;
        newPoll.title = _title;
        newPoll.description = _description;
        newPoll.startTime = block.timestamp;
        newPoll.endTime = block.timestamp + (_durationInMinutes * 1 minutes);
        newPoll.active = true;
        newPoll.creator = msg.sender;
        newPoll.candidatesCount = 0;
        newPoll.totalVotes = 0;
        
        // Добавляем кандидатов
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            _addCandidate(pollsCount, _candidateNames[i]);
        }
        
        emit PollCreated(
            pollsCount,
            _title,
            msg.sender,
            newPoll.startTime,
            newPoll.endTime
        );
        
        return pollsCount;
    }
    
    /**
     * @dev Внутренняя функция добавления кандидата
     */
    function _addCandidate(uint256 _pollId, string memory _name) private {
        Poll storage poll = polls[_pollId];
        poll.candidatesCount++;
        
        poll.candidates[poll.candidatesCount] = Candidate({
            id: poll.candidatesCount,
            name: _name,
            voteCount: 0
        });
        
        emit CandidateAdded(_pollId, poll.candidatesCount, _name);
    }
    
    /**
     * @dev Регистрация избирателя (может сделать создатель или сам избиратель)
     */
    function registerVoter(uint256 _pollId, address _voter) 
        public 
        pollExists(_pollId) 
        pollActive(_pollId) 
    {
        require(
            msg.sender == polls[_pollId].creator || msg.sender == _voter,
            "Only creator or voter can register"
        );
        require(!polls[_pollId].isRegistered[_voter], "Already registered");
        
        polls[_pollId].isRegistered[_voter] = true;
        emit VoterRegistered(_pollId, _voter);
    }
    
    /**
     * @dev Проголосовать
     */
    function vote(uint256 _pollId, uint256 _candidateId) 
        public 
        pollExists(_pollId) 
        pollActive(_pollId) 
    {
        Poll storage poll = polls[_pollId];
        
        require(poll.isRegistered[msg.sender], "Not registered to vote");
        require(!poll.hasVoted[msg.sender], "Already voted");
        require(_candidateId > 0 && _candidateId <= poll.candidatesCount, "Invalid candidate");
        
        poll.hasVoted[msg.sender] = true;
        poll.candidates[_candidateId].voteCount++;
        poll.totalVotes++;
        
        emit Voted(_pollId, msg.sender, _candidateId);
    }
    
    /**
     * @dev Завершить голосование досрочно
     */
    function endPoll(uint256 _pollId) 
        public 
        pollExists(_pollId) 
        onlyCreator(_pollId) 
    {
        require(polls[_pollId].active, "Poll already ended");
        polls[_pollId].active = false;
        emit PollEnded(_pollId);
    }
    
    /**
     * @dev Получить информацию о голосовании
     */
    function getPollInfo(uint256 _pollId) 
        public 
        view 
        pollExists(_pollId) 
        returns (
            string memory title,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            bool active,
            address creator,
            uint256 candidatesCount,
            uint256 totalVotes
        ) 
    {
        Poll storage poll = polls[_pollId];
        return (
            poll.title,
            poll.description,
            poll.startTime,
            poll.endTime,
            poll.active,
            poll.creator,
            poll.candidatesCount,
            poll.totalVotes
        );
    }
    
    /**
     * @dev Получить информацию о кандидате
     */
    function getCandidate(uint256 _pollId, uint256 _candidateId) 
        public 
        view 
        pollExists(_pollId) 
        returns (
            uint256 id,
            string memory name,
            uint256 voteCount
        ) 
    {
        require(_candidateId > 0 && _candidateId <= polls[_pollId].candidatesCount, "Invalid candidate");
        Candidate storage candidate = polls[_pollId].candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }
    
    /**
     * @dev Проверить, зарегистрирован ли избиратель
     */
    function isVoterRegistered(uint256 _pollId, address _voter) 
        public 
        view 
        pollExists(_pollId) 
        returns (bool) 
    {
        return polls[_pollId].isRegistered[_voter];
    }
    
    /**
     * @dev Проверить, проголосовал ли избиратель
     */
    function hasVoterVoted(uint256 _pollId, address _voter) 
        public 
        view 
        pollExists(_pollId) 
        returns (bool) 
    {
        return polls[_pollId].hasVoted[_voter];
    }
    
    /**
     * @dev Получить все голосования
     */
    function getAllPolls() 
        public 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory pollIds = new uint256[](pollsCount);
        for (uint256 i = 1; i <= pollsCount; i++) {
            pollIds[i - 1] = i;
        }
        return pollIds;
    }
}