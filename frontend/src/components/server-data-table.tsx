import {
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type {
  OnChangeFn,
  PaginationState,
  RowData,
  TableOptions,
} from '@tanstack/react-table'
import { cn } from 'cn'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dataTableFeatures = tableFeatures({ rowPaginationFeature })

export function ServerDataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  loading = false,
  fetching = false,
  rowCount = data.length,
  pagination,
  onPaginationChange,
  showPagination = false,
  emptyState,
  itemName,
}: {
  data: TData[]
  columns: TableOptions<typeof dataTableFeatures, TData>['columns']
  getRowId: TableOptions<typeof dataTableFeatures, TData>['getRowId']
  loading?: boolean
  fetching?: boolean
  rowCount?: number
  pagination: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  showPagination?: boolean
  emptyState: ReactNode
  itemName: string
}) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    manualPagination: true,
    rowCount,
    autoResetPageIndex: false,
    state: { pagination },
    onPaginationChange,
  })
  return (
    <div className="flex flex-col gap-4">
      <div
        className="overflow-hidden rounded-lg border"
        aria-busy={loading || fetching}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.id === 'amount' && 'text-right'
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {table.getAllLeafColumns().map((_, column) => (
                    <TableCell key={column}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.id === 'amount' && 'text-right'
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length}>
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rowCount} {rowCount === 1 ? itemName : `${itemName}s`} · Page{' '}
            {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            {fetching ? ' · Updating…' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage() || fetching}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage() || fetching}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
