'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageStart: number;
  pageEnd: number;
  onPageChange: (page: number) => void;
  pageSizes?: number[];
}

export function PaginationBar({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  totalItems,
  pageStart,
  pageEnd,
  onPageChange,
  pageSizes = [10, 20, 50],
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  // Generate page numbers with ellipsis
  const pageNumbers: (number | string)[] = [];
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  pages
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | string)[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, [])
    .forEach(item => pageNumbers.push(item));

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Tampilkan</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {pageSizes.map(size => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>data &middot; {pageStart}-{pageEnd} dari {totalItems}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers.map((p, idx) =>
          typeof p === 'string' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
          ) : (
            <Button key={p} variant={currentPage === p ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => onPageChange(p)}>
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-3" />
        </Button>
      </div>
    </div>
  );
}
