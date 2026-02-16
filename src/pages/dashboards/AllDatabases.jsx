import React, { useEffect, useState } from 'react';
import { Card, Button, Spinner, Input, ButtonGroup } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import {
  Database,
  Search,
  Trash2,
  ExternalLink,
  BarChart3,
  Table as TableIcon,
  MoreVertical,
  Calendar,
  FileCode,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AllDatabases = () => {
  const [databases, setDatabases] = useState([]);
  const [filteredDbs, setFilteredDbs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDatabases = async () => {
    try {
      const dbs = await invoke('list_databases');
      setDatabases(dbs);
      setFilteredDbs(dbs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  useEffect(() => {
    const filtered = databases.filter(db =>
      db.name.toLowerCase().includes(search.toLowerCase()) ||
      db.path.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredDbs(filtered);
  }, [search, databases]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to remove this database?')) {
      try {
        await invoke('delete_database', { id });
        fetchDatabases();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" label="Loading databases..." color="primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">All Databases</h1>
          <p className="text-muted-foreground">Manage and explore all your imported SQLite databases.</p>
        </div>

        <div className="w-full md:w-80">
          <Input
            placeholder="Search databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<Search size={18} className="text-muted-foreground" />}
            variant="flat"
            className="bg-background"
            size="lg"
          />
        </div>
      </div>

      {filteredDbs.length === 0 ? (
        <Card className="p-16 border border-border bg-background rounded-3xl flex flex-col items-center justify-center text-center gap-6">
          <div className="bg-muted/20 p-8 rounded-full">
            <Database size={64} className="text-muted-foreground opacity-50" />
          </div>
          <div className="max-w-md">
            <h3 className="text-2xl font-bold mb-2">No databases found</h3>
            <p className="text-muted-foreground mb-6">
              {search ? `No results for "${search}". Try a different term or import a new database.` : "You haven't imported any databases yet."}
            </p>
            {!search && (
              <Button
                onPress={() => navigate('/import')}
                color="primary"
                size="lg"
                className="rounded-2xl font-bold"
              >
                Import Now
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-background border border-border rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-6 py-4 text-sm font-bold text-muted-foreground uppercase tracking-wider">Database</th>
                  <th className="px-6 py-4 text-sm font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Path</th>
                  <th className="px-6 py-4 text-sm font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Imported</th>
                  <th className="px-6 py-4 text-sm font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDbs.map((db) => (
                  <tr key={db.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2.5 rounded-xl">
                          <Database className="text-primary" size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{db.name}</p>
                          <p className="text-xs text-muted-foreground lg:hidden truncate max-w-[200px]">{db.path}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs bg-muted/30 px-3 py-1.5 rounded-lg w-fit">
                        <FileCode size={14} />
                        <span className="truncate max-w-md">{db.path}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell text-muted-foreground">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={14} />
                        {new Date(db.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-3">
                        <ButtonGroup variant="flat" color="primary" size="sm" className="rounded-lg overflow-hidden">
                          <Button
                            onPress={() => navigate(`/table-view?path=${encodeURIComponent(db.path)}`)}
                            className="font-bold"
                            startContent={<TableIcon size={16} />}
                          >
                            Tables
                          </Button>
                          <Button
                            onPress={() => navigate(`/analytics?path=${encodeURIComponent(db.path)}`)}
                            className="font-bold border-l border-primary/20"
                            startContent={<BarChart3 size={16} />}
                          >
                            Stats
                          </Button>
                        </ButtonGroup>
                        <Button
                          variant="light"
                          color="danger"
                          size="sm"
                          isIconOnly
                          onPress={() => handleDelete(db.id)}
                          className="rounded-lg"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Activity size={14} />
            Showing {filteredDbs.length} database{filteredDbs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllDatabases;
