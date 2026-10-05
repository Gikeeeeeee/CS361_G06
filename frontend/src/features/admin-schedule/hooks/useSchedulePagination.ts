import { useState, useCallback } from 'react';

export const useSchedulePagination = () => {
  const [tokenHistory, setTokenHistory] = useState<(string | null)[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);

  const resetPagination = useCallback(() => {
    setTokenHistory([]);
    setCurrentToken(null);
    setNextToken(null);
  }, []);

  const handleNextPage = useCallback(() => {
    if (nextToken) {
      setTokenHistory((prev) => [...prev, currentToken]);
      setCurrentToken(nextToken);
    }
  }, [nextToken, currentToken]);

  const handlePrevPage = useCallback(() => {
    if (tokenHistory.length > 0) {
      const newHistory = [...tokenHistory];
      const prevToken = newHistory.pop() ?? null;
      setTokenHistory(newHistory);
      setCurrentToken(prevToken);
    }
  }, [tokenHistory]);

  return {
    tokenHistory,
    currentToken,
    nextToken,
    setNextToken,
    resetPagination,
    handleNextPage,
    handlePrevPage,
  };
};
