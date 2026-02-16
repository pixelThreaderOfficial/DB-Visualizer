import { invoke } from "@tauri-apps/api/core";
import React, { useState, useEffect } from 'react';
import { Listbox, ListboxItem } from '@heroui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  PlusCircle,
  Table,
  BarChart3
} from 'lucide-react';



const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [version, setVersion] = useState('');

  useEffect(() => {
    invoke("versionno", { prefix: true })
      .then(setVersion)
      .catch(err => console.error("Failed to fetch version:", err));
  }, []);

  const menuItems = [
    { id: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: '/all-databases', label: 'All Databases', icon: <Database size={20} /> },
    { id: '/import', label: 'Import DB', icon: <PlusCircle size={20} /> },
    { id: '/table-view', label: 'Table View', icon: <Table size={20} /> },
    { id: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  ];

  // Map subpaths to main paths for selection
  const currentPath = '/' + location.pathname.split('/')[1];

  return (
    <aside className="w-72 border-r border-border h-full p-4 flex flex-col gap-6 bg-background">
      <div className="px-4 py-6 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Database className="text-primary" size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">DB Visualizer</h1>
      </div>

      <div className="flex-1">
        <Listbox
          aria-label="Navigation"
          selectedKeys={new Set([location.pathname])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            if (selected) navigate(selected);
          }}
          selectionMode="single"
          variant="flat"
        >
          {menuItems.map((item) => (
            <ListboxItem
              key={item.id}
              textValue={item.label}
              className="py-3 px-4 rounded-xl mb-1 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary transition-all duration-200"
            >
              <div className="flex items-center gap-4 w-full">
                <div className="flex items-center justify-center w-5">
                  {item.icon}
                </div>
                <span className="font-medium cursor-pointer">{item.label}</span>
              </div>
            </ListboxItem>
          ))}
        </Listbox>
      </div>

      <div className="p-4 bg-muted/30 rounded-2xl border border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{version || '...'} Beta</p>
        <p className="text-sm text-muted-foreground">SQLite DB Visualizer</p>
      </div>
    </aside>
  );
};

export default Sidebar;

