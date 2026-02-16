import React, { useState } from 'react';
import { Card, Input, Button } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Database, FileSearch, FolderPlus, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ImportDb = () => {
  const [dbName, setDbName] = useState('');
  const [dbPath, setDbPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3', 'db3']
        }]
      });
      if (selected) {
        setDbPath(selected);
        // Automatically set name if empty
        if (!dbName) {
          const fileName = selected.split(/[\\/]/).pop();
          setDbName(fileName.split('.')[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImport = async () => {
    if (!dbName || !dbPath) {
      setError('Please provide both a name and a path for the database.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await invoke('import_database', { name: dbName, path: dbPath });
      navigate('/');
    } catch (err) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Import Database</h1>
        <p className="text-muted-foreground">Add a new SQLite database to your collection for visualization and analysis.</p>
      </div>

      <Card className="p-8 border border-border bg-background shadow-xl rounded-3xl">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-muted-foreground px-1">DATABASE NAME</label>
              <Input
                placeholder="e.g., Sales Production"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                variant="flat"
                className="bg-muted/30"
                size="lg"
                startContent={<Database className="text-muted-foreground" size={18} />}
                aria-label="Database name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-muted-foreground px-1">DATABASE PATH</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Select or enter path to .db file"
                  value={dbPath}
                  onChange={(e) => setDbPath(e.target.value)}
                  variant="flat"
                  className="bg-muted/30 flex-1"
                  size="lg"
                  startContent={<FileSearch className="text-muted-foreground" size={18} />}
                  aria-label="Database path"
                />
                <Button
                  onPress={handleSelectFile}
                  color="primary"
                  variant="flat"
                  size="lg"
                  className="font-medium rounded-xl"
                >
                  Browse
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <Button
            onPress={handleImport}
            isLoading={loading}
            color="primary"
            size="lg"
            className="w-full font-bold h-14 rounded-2xl text-lg shadow-lg shadow-primary/20"
          >
            {loading ? 'Importing' : 'Import Database'}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
          <h3 className="font-bold text-primary mb-2">Supported Formats</h3>
          <p className="text-sm text-muted-foreground">Standard SQLite files with extensions: .db, .sqlite, .sqlite3, .db3</p>
        </div>
        <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10">
          <h3 className="font-bold text-secondary mb-2">Local Processing</h3>
          <p className="text-sm text-muted-foreground">Data is processed locally on your machine for maximum security and performance.</p>
        </div>
      </div>
    </div>
  );
};

export default ImportDb;
