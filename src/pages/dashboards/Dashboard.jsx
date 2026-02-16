import React, { useEffect, useState } from 'react';
import { Card, Button, Chip, Spinner, ButtonGroup } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import {
  Database,
  Table,
  Layers,
  ExternalLink,
  Trash2,
  PlusCircle,
  FileText,
  Activity,
  Calendar
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Dashboard = () => {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDbs: 0,
    totalTables: 0,
    totalRecords: 0
  });
  const navigate = useNavigate();

  const fetchDatabases = async () => {
    try {
      const dbs = await invoke('list_databases');
      setDatabases(dbs);

      let tableCount = 0;
      let recordCount = 0;

      for (const db of dbs) {
        try {
          const dbStats = await invoke('get_db_stats', { path: db.path });
          tableCount += dbStats.total_tables;
          recordCount += dbStats.total_records;
        } catch (e) {
          console.error(`Error fetching stats for ${db.name}:`, e);
        }
      }

      setStats({
        totalDbs: dbs.length,
        totalTables: tableCount,
        totalRecords: recordCount
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to remove this database from the visualizer?')) {
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
        <Spinner size="lg" label="Loading dashboard..." color="primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-lg">Quick overview of your database visualizations.</p>
        </div>
        <Button
          onPress={() => navigate('/import')}
          color="primary"
          size="lg"
          className="rounded-xl font-bold"
          startContent={<PlusCircle size={20} />}
        >
          Import Database
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 border border-border bg-background shadow-sm rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database size={80} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Databases</p>
            <h2 className="text-5xl font-black">{stats.totalDbs}</h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-primary font-medium">
            <Activity size={16} />
            <span className="text-sm">Active connections</span>
          </div>
        </Card>

        <Card className="p-8 border border-border bg-background shadow-sm rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers size={80} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Tables</p>
            <h2 className="text-5xl font-black">{stats.totalTables}</h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-success font-medium">
            <Table size={16} />
            <span className="text-sm">Structured data sources</span>
          </div>
        </Card>

        <Card className="p-8 border border-border bg-background shadow-sm rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText size={80} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Records</p>
            <h2 className="text-5xl font-black">
              {stats.totalRecords > 1000 ? (stats.totalRecords / 1000).toFixed(1) + 'k' : stats.totalRecords}
            </h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-warning font-medium">
            <Activity size={16} />
            <span className="text-sm">Total rows visualized</span>
          </div>
        </Card>
      </div>

      {/* Latest Databases */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-2xl font-bold">Latest Databases</h2>
          <Link to="/all-databases" className="text-primary font-semibold hover:underline flex items-center gap-1">
            View all <ExternalLink size={16} />
          </Link>
        </div>

        {databases.length === 0 ? (
          <Card className="p-12 border-2 border-dashed border-border bg-muted/5 rounded-3xl flex flex-col items-center justify-center text-center gap-4">
            <div className="bg-muted/20 p-6 rounded-full">
              <PlusCircle size={48} className="text-muted-foreground" />
            </div>
            <div className="max-w-md">
              <h3 className="text-xl font-bold mb-2">No databases imported yet</h3>
              <p className="text-muted-foreground mb-6">Get started by importing your first SQLite database. You can browse local files or enter a direct path.</p>
              <Button
                onPress={() => navigate('/import')}
                variant="solid"
                color="primary"
                size="lg"
                className="rounded-2xl font-bold"
              >
                Start Visualization
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {databases.slice(0, 10).map((db) => (
              <Card key={db.id} className="p-6 border border-border bg-background hover:border-primary/50 transition-colors rounded-3xl group shadow-sm">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary/20 transition-colors">
                      <Database className="text-primary" size={28} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-xl font-bold truncate">{db.name}</h3>
                      <p className="text-sm text-muted-foreground truncate font-mono bg-muted/30 px-2 py-0.5 rounded mt-1">{db.path}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="hidden lg:flex flex-col items-end">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <Calendar size={14} />
                        <span>Last accessed</span>
                      </div>
                      <p className="text-sm font-bold">{new Date(db.last_accessed).toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <ButtonGroup variant="flat" color="primary" className="rounded-xl overflow-hidden">
                        <Button
                          onPress={() => navigate(`/table-view?path=${encodeURIComponent(db.path)}`)}
                          className="font-bold"
                        >
                          Explore
                        </Button>
                        <Button
                          onPress={() => navigate(`/analytics?path=${encodeURIComponent(db.path)}`)}
                          className="font-bold border-l border-primary/20"
                        >
                          Analytics
                        </Button>
                      </ButtonGroup>
                      <Button
                        variant="light"
                        color="danger"
                        isIconOnly
                        onPress={() => handleDelete(db.id)}
                        className="rounded-xl"
                        aria-label="Delete database"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
