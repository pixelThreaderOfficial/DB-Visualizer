import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell, 
  Pagination, 
  Spinner,
  Select,
  SelectItem,
  Input,
  Card,
  Chip
} from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { useSearchParams } from 'react-router-dom';
import { Search, Table as TableIcon, Database, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const TableView = () => {
  const [searchParams] = useSearchParams();
  const dbPath = searchParams.get('path');
  
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTables = async () => {
    if (!dbPath) return;
    setLoading(true);
    try {
      const tableInfo = await invoke('get_tables', { path: dbPath });
      setTables(tableInfo);
      if (tableInfo.length > 0 && !selectedTable) {
        setSelectedTable(tableInfo[0].name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async () => {
    if (!dbPath || !selectedTable) return;
    setDataLoading(true);
    try {
      const result = await invoke('get_table_data', {
        path: dbPath,
        table: selectedTable,
        page,
        pageSize,
        search: debouncedSearch || null
      });
      setColumns(result.columns);
      setRows(result.rows);
      setTotalPages(result.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [dbPath]);

  useEffect(() => {
    fetchTableData();
  }, [dbPath, selectedTable, page, pageSize, debouncedSearch]);

  const renderCell = (row, columnIdx) => {
    const value = row[columnIdx];
    if (value === null) return <span className="text-muted-foreground italic">null</span>;
    if (typeof value === 'boolean') return <Chip size="sm" color={value ? "success" : "danger"}>{value.toString()}</Chip>;
    if (typeof value === 'object') return JSON.stringify(value);
    return value.toString();
  };

  if (!dbPath) {
    return (
      <Card className="p-12 text-center flex flex-col items-center gap-4 rounded-3xl border border-border">
        <Database size={48} className="text-muted-foreground" />
        <h2 className="text-2xl font-bold">No Database Selected</h2>
        <p className="text-muted-foreground">Go to the dashboard and select a database to view its tables.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TableIcon className="text-primary" /> Data Explorer
          </h1>
          <p className="text-muted-foreground truncate max-w-xl font-mono text-xs">{dbPath}</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select 
            label="Select Table"
            variant="flat"
            className="w-full md:w-64"
            selectedKeys={selectedTable ? [selectedTable] : []}
            onChange={(e) => {
                setSelectedTable(e.target.value);
                setPage(1);
            }}
            isLoading={loading}
          >
            {tables.map((table) => (
              <SelectItem key={table.name} value={table.name} textValue={table.name}>
                <div className="flex justify-between items-center w-full">
                  <span>{table.name}</span>
                  <Chip size="sm" variant="flat">{table.row_count} rows</Chip>
                </div>
              </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <Card className="p-6 border border-border bg-background rounded-3xl shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Input
              placeholder="Search in table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startContent={<Search size={18} className="text-muted-foreground" />}
              className="w-full md:w-80"
              variant="flat"
            />

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <Select
                size="sm"
                variant="flat"
                className="w-24"
                selectedKeys={[pageSize.toString()]}
                onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                }}
              >
                <SelectItem key="10" value="10">10</SelectItem>
                <SelectItem key="25" value="25">25</SelectItem>
                <SelectItem key="50" value="50">50</SelectItem>
                <SelectItem key="100" value="100">100</SelectItem>
                <SelectItem key="200" value="200">200</SelectItem>
              </Select>
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-xl border border-border">
            <Table 
              aria-label="Table Data"
              className="min-w-full"
              shadow="none"
            >
              <TableHeader>
                {columns.map((col) => (
                  <TableColumn key={col} className="bg-muted/30 font-bold uppercase tracking-wider text-xs py-4">
                    <div className="flex items-center gap-2">
                        {col}
                    </div>
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody 
                items={rows}
                loadingContent={<Spinner label="Fetching data..." />}
                loadingState={dataLoading ? "loading" : "idle"}
                emptyContent={selectedTable ? "No data found in this table." : "Select a table to view data."}
              >
                {(row) => (
                  <TableRow key={JSON.stringify(row)}>
                    {columns.map((col, idx) => (
                      <TableCell key={`${col}-${idx}`} className="py-4 border-b border-border/50">
                        {renderCell(row, idx)}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                color="primary"
                variant="flat"
                showControls
                className="rounded-2xl"
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TableView;
