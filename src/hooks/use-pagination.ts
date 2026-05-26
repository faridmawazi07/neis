'use client';

import { useState, useMemo } from 'react';

export function usePagination(totalItems: number, defaultPageSize = 10) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalItems);

  // Clamp current page if it exceeds total pages
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(
    () => <T,>(data: T[]): T[] => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [safePage, pageSize]
  );

  const goToFirst = () => setCurrentPage(1);
  const goToPrev = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNext = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLast = () => setCurrentPage(totalPages);
  const goToPage = (page: number) => setCurrentPage(page);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return {
    pageSize,
    setPageSize: handlePageSizeChange,
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    pageStart,
    pageEnd,
    paginatedData,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToPage,
  };
}
