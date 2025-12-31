/**
 * @fileoverview Pagination hook for managing paginated data
 * @module hooks/usePagination
 */

import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook for managing pagination state
 * @param {Object} options - Configuration options
 * @param {number} options.totalItems - Total number of items
 * @param {number} options.initialPage - Initial page number (default: 1)
 * @param {number} options.itemsPerPage - Items per page (default: 10)
 * @param {number} options.siblingCount - Number of siblings on each side (default: 1)
 * @returns {Object} Pagination state and controls
 * @property {number} currentPage - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} itemsPerPage - Items per page
 * @property {number} totalItems - Total number of items
 * @property {number} startIndex - Start index for current page
 * @property {number} endIndex - End index for current page
 * @property {boolean} hasNextPage - Whether there's a next page
 * @property {boolean} hasPrevPage - Whether there's a previous page
 * @property {Array} pageNumbers - Array of page numbers to display
 * @property {Function} nextPage - Go to next page
 * @property {Function} prevPage - Go to previous page
 * @property {Function} goToPage - Go to specific page
 * @property {Function} setItemsPerPage - Change items per page
 * @property {Function} setTotalItems - Update total items count
 *
 * @example
 * const {
 *   currentPage,
 *   totalPages,
 *   pageNumbers,
 *   nextPage,
 *   prevPage,
 *   goToPage,
 *   startIndex,
 *   endIndex
 * } = usePagination({ totalItems: 100, itemsPerPage: 10 });
 *
 * const displayedItems = items.slice(startIndex, endIndex);
 */
const usePagination = (options = {}) => {
  const {
    totalItems: initialTotalItems = 0,
    initialPage = 1,
    itemsPerPage: initialItemsPerPage = 10,
    siblingCount = 1
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);

  /**
   * Calculate total pages
   */
  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / itemsPerPage) || 1;
  }, [totalItems, itemsPerPage]);

  /**
   * Calculate start index for current page (0-based)
   */
  const startIndex = useMemo(() => {
    return (currentPage - 1) * itemsPerPage;
  }, [currentPage, itemsPerPage]);

  /**
   * Calculate end index for current page
   */
  const endIndex = useMemo(() => {
    return Math.min(startIndex + itemsPerPage, totalItems);
  }, [startIndex, itemsPerPage, totalItems]);

  /**
   * Check if there's a next page
   */
  const hasNextPage = useMemo(() => {
    return currentPage < totalPages;
  }, [currentPage, totalPages]);

  /**
   * Check if there's a previous page
   */
  const hasPrevPage = useMemo(() => {
    return currentPage > 1;
  }, [currentPage]);

  /**
   * Generate array of page numbers to display
   */
  const pageNumbers = useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 3; // siblings + first + last + current
    const totalBlocks = totalPageNumbers + 2; // + 2 for dots

    // If total pages fit without truncation
    if (totalPages <= totalBlocks) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < totalPages - 1;

    if (!showLeftDots && showRightDots) {
      const leftRange = Array.from(
        { length: 3 + 2 * siblingCount },
        (_, i) => i + 1
      );
      return [...leftRange, '...', totalPages];
    }

    if (showLeftDots && !showRightDots) {
      const rightRange = Array.from(
        { length: 3 + 2 * siblingCount },
        (_, i) => totalPages - (3 + 2 * siblingCount) + i + 1
      );
      return [1, '...', ...rightRange];
    }

    if (showLeftDots && showRightDots) {
      const middleRange = Array.from(
        { length: 2 * siblingCount + 1 },
        (_, i) => leftSiblingIndex + i
      );
      return [1, '...', ...middleRange, '...', totalPages];
    }

    return [];
  }, [currentPage, totalPages, siblingCount]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  /**
   * Go to first page
   */
  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  /**
   * Go to last page
   */
  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  /**
   * Go to specific page
   * @param {number} page - Page number
   */
  const goToPage = useCallback((page) => {
    const pageNumber = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(pageNumber);
  }, [totalPages]);

  /**
   * Change items per page
   * @param {number} count - New items per page
   */
  const setItemsPerPage = useCallback((count) => {
    setItemsPerPageState(count);
    // Reset to page 1 when changing items per page
    setCurrentPage(1);
  }, []);

  /**
   * Reset pagination to initial state
   */
  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setItemsPerPageState(initialItemsPerPage);
  }, [initialPage, initialItemsPerPage]);

  /**
   * Get pagination info object
   */
  const paginationInfo = useMemo(() => ({
    showing: {
      from: totalItems === 0 ? 0 : startIndex + 1,
      to: endIndex,
      of: totalItems
    },
    text: totalItems === 0
      ? 'No items'
      : `Showing ${startIndex + 1} to ${endIndex} of ${totalItems}`
  }), [startIndex, endIndex, totalItems]);

  return {
    // State
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    startIndex,
    endIndex,
    pageNumbers,

    // Booleans
    hasNextPage,
    hasPrevPage,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,

    // Navigation
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    goToPage,

    // Setters
    setItemsPerPage,
    setTotalItems,
    setCurrentPage,

    // Utils
    reset,
    paginationInfo
  };
};

/**
 * Hook for paginating a local array
 * @param {Array} items - Array of items to paginate
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated items and controls
 *
 * @example
 * const { paginatedItems, ...pagination } = useArrayPagination(users, { itemsPerPage: 10 });
 *
 * {paginatedItems.map(user => <UserCard key={user.id} user={user} />)}
 */
export const useArrayPagination = (items = [], options = {}) => {
  const pagination = usePagination({
    ...options,
    totalItems: items.length
  });

  const paginatedItems = useMemo(() => {
    return items.slice(pagination.startIndex, pagination.endIndex);
  }, [items, pagination.startIndex, pagination.endIndex]);

  return {
    ...pagination,
    paginatedItems,
    allItems: items
  };
};

export default usePagination;
