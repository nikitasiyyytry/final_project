"use client";

import { useState, useEffect } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [selectedPoll, setSelectedPoll] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Форма создания голосования
  const [newPollTitle, setNewPollTitle] = useState("");
  const [newPollDescription, setNewPollDescription] = useState("");
  const [newPollDuration, setNewPollDuration] = useState("60");
  const [candidates, setCandidates] = useState(["", ""]);

  // Чтение количества голосований
  const { data: pollsCount } = useScaffoldReadContract({
    contractName: "VotingContract",
    functionName: "pollsCount",
    watch: true,
  });

  // Запись в контракт
  const { writeContractAsync: writeVotingContract } = useScaffoldWriteContract("VotingContract");

  // Создание голосования
  const handleCreatePoll = async () => {
    if (!newPollTitle || !newPollDescription || candidates.some(c => !c)) {
      notification.error("Заполните все поля");
      return;
    }

    try {
      await writeVotingContract({
        functionName: "createPoll",
        args: [newPollTitle, newPollDescription, BigInt(newPollDuration), candidates],
      });
      notification.success("Голосование создано!");
      setShowCreateForm(false);
      setNewPollTitle("");
      setNewPollDescription("");
      setCandidates(["", ""]);
    } catch (e) {
      console.error(e);
      notification.error("Ошибка создания голосования");
    }
  };

  const addCandidate = () => {
    setCandidates([...candidates, ""]);
  };

  const removeCandidate = (index: number) => {
    if (candidates.length > 2) {
      setCandidates(candidates.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full max-w-6xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Децентрализованное голосование</span>
          <span className="block text-2xl mt-2">Блокчейн система для честных выборов</span>
        </h1>

        {/* Кнопка создания голосования */}
        <div className="flex justify-center mb-8">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Отменить" : "➕ Создать голосование"}
          </button>
        </div>

        {/* Форма создания голосования */}
        {showCreateForm && (
          <div className="card bg-base-200 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title">Новое голосование</h2>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Название</span>
                </label>
                <input
                  type="text"
                  placeholder="Например: Выбор языка программирования"
                  className="input input-bordered"
                  value={newPollTitle}
                  onChange={e => setNewPollTitle(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Описание</span>
                </label>
                <textarea
                  placeholder="Опишите цель голосования"
                  className="textarea textarea-bordered"
                  value={newPollDescription}
                  onChange={e => setNewPollDescription(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Длительность (минуты)</span>
                </label>
                <input
                  type="number"
                  placeholder="60"
                  className="input input-bordered"
                  value={newPollDuration}
                  onChange={e => setNewPollDuration(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Кандидаты (минимум 2)</span>
                </label>
                {candidates.map((candidate, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={`Кандидат ${index + 1}`}
                      className="input input-bordered flex-1"
                      value={candidate}
                      onChange={e => {
                        const newCandidates = [...candidates];
                        newCandidates[index] = e.target.value;
                        setCandidates(newCandidates);
                      }}
                    />
                    {candidates.length > 2 && (
                      <button
                        className="btn btn-error btn-square"
                        onClick={() => removeCandidate(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary mt-2" onClick={addCandidate}>
                  + Добавить кандидата
                </button>
              </div>

              <div className="card-actions justify-end mt-4">
                <button className="btn btn-primary" onClick={handleCreatePoll}>
                  Создать
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Список голосований */}
        <div className="grid grid-cols-1 gap-4">
          <h2 className="text-2xl font-bold">Активные голосования</h2>
          {pollsCount && Number(pollsCount) > 0 ? (
            Array.from({ length: Number(pollsCount) }, (_, i) => i + 1).map(pollId => (
              <PollCard
                key={pollId}
                pollId={pollId}
                isSelected={selectedPoll === pollId}
                onSelect={() => setSelectedPoll(selectedPoll === pollId ? null : pollId)}
                connectedAddress={connectedAddress}
              />
            ))
          ) : (
            <div className="alert alert-info">
              <span>Пока нет активных голосований. Создайте первое!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Компонент карточки голосования
function PollCard({
  pollId,
  isSelected,
  onSelect,
  connectedAddress,
}: {
  pollId: number;
  isSelected: boolean;
  onSelect: () => void;
  connectedAddress: string | undefined;
}) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);

  // Чтение информации о голосовании
  const { data: pollInfo } = useScaffoldReadContract({
    contractName: "VotingContract",
    functionName: "getPollInfo",
    args: [BigInt(pollId)],
    watch: true,
  });

  // Проверка регистрации
  const { data: isRegistered } = useScaffoldReadContract({
    contractName: "VotingContract",
    functionName: "isVoterRegistered",
    args: [BigInt(pollId), connectedAddress],
    watch: true,
  });

  // Проверка голосования
  const { data: hasVoted } = useScaffoldReadContract({
    contractName: "VotingContract",
    functionName: "hasVoterVoted",
    args: [BigInt(pollId), connectedAddress],
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract("VotingContract");

  // Регистрация избирателя
  const handleRegister = async () => {
    try {
      await writeContractAsync({
        functionName: "registerVoter",
        args: [BigInt(pollId), connectedAddress],
      });
      notification.success("Вы зарегистрированы!");
    } catch (e) {
      console.error(e);
    }
  };

  // Голосование
  const handleVote = async () => {
    if (!selectedCandidate) {
      notification.error("Выберите кандидата");
      return;
    }
    try {
      await writeContractAsync({
        functionName: "vote",
        args: [BigInt(pollId), BigInt(selectedCandidate)],
      });
      notification.success("Ваш голос учтен!");
    } catch (e) {
      console.error(e);
    }
  };

  // Завершение голосования
  const handleEndPoll = async () => {
    try {
      await writeContractAsync({
        functionName: "endPoll",
        args: [BigInt(pollId)],
      });
      notification.success("Голосование завершено!");
    } catch (e) {
      console.error(e);
    }
  };

  if (!pollInfo) return null;

  const [title, description, startTime, endTime, active, creator, candidatesCount, totalVotes] = pollInfo;
  const timeLeft = Number(endTime) - Math.floor(Date.now() / 1000);
  const isActive = active && timeLeft > 0;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="card-title text-xl">{title}</h3>
            <p className="text-sm opacity-70">{description}</p>
          </div>
          <div className={`badge ${isActive ? "badge-success" : "badge-error"}`}>
            {isActive ? "Активно" : "Завершено"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <span className="opacity-70">Создатель:</span>
            <div className="font-mono text-xs mt-1">{creator}</div>
          </div>
          <div>
            <span className="opacity-70">Всего голосов:</span> <strong>{totalVotes.toString()}</strong>
          </div>
          <div>
            <span className="opacity-70">Время до конца:</span>{" "}
            <strong>{isActive ? `${Math.floor(timeLeft / 60)} мин` : "Завершено"}</strong>
          </div>
          <div>
            <span className="opacity-70">Кандидатов:</span> <strong>{candidatesCount.toString()}</strong>
          </div>
        </div>

        <button className="btn btn-sm mt-4" onClick={onSelect}>
          {isSelected ? "Скрыть детали" : "Показать детали"}
        </button>

        {isSelected && (
          <div className="mt-4 border-t pt-4">
            <h4 className="font-bold mb-2">Кандидаты:</h4>
            <div className="space-y-2">
              {Array.from({ length: Number(candidatesCount) }, (_, i) => i + 1).map(candidateId => (
                <CandidateRow
                  key={candidateId}
                  pollId={pollId}
                  candidateId={candidateId}
                  totalVotes={Number(totalVotes)}
                  isSelected={selectedCandidate === candidateId}
                  onSelect={() => setSelectedCandidate(candidateId)}
                  disabled={!isRegistered || hasVoted || !isActive}
                />
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              {!isRegistered && isActive && (
                <button className="btn btn-primary" onClick={handleRegister}>
                  Зарегистрироваться
                </button>
              )}
              {isRegistered && !hasVoted && isActive && (
                <button className="btn btn-success" onClick={handleVote} disabled={!selectedCandidate}>
                  Проголосовать
                </button>
              )}
              {hasVoted && <div className="alert alert-success">✓ Вы проголосовали</div>}
              {connectedAddress === creator && isActive && (
                <button className="btn btn-error" onClick={handleEndPoll}>
                  Завершить голосование
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Компонент строки кандидата
function CandidateRow({
  pollId,
  candidateId,
  totalVotes,
  isSelected,
  onSelect,
  disabled,
}: {
  pollId: number;
  candidateId: number;
  totalVotes: number;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const { data: candidate } = useScaffoldReadContract({
    contractName: "VotingContract",
    functionName: "getCandidate",
    args: [BigInt(pollId), BigInt(candidateId)],
    watch: true,
  });

  if (!candidate) return null;

  const [, name, voteCount] = candidate;
  const percentage = totalVotes > 0 ? (Number(voteCount) / totalVotes) * 100 : 0;

  return (
    <div className={`border rounded-lg p-3 ${isSelected && !disabled ? "border-primary" : ""}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {!disabled && (
            <input
              type="radio"
              name={`poll-${pollId}`}
              className="radio radio-primary"
              checked={isSelected}
              onChange={onSelect}
            />
          )}
          <span className="font-semibold">{name}</span>
        </div>
        <div className="text-sm">
          <span className="font-bold">{voteCount.toString()}</span> голосов (
          <span className="font-bold">{percentage.toFixed(1)}%</span>)
        </div>
      </div>
      <progress className="progress progress-primary w-full" value={percentage} max="100"></progress>
    </div>
  );
}

export default Home;