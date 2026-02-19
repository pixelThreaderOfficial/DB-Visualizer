import React, { useEffect, useState, useMemo } from 'react';
import {
    Card,
    Spinner,
    Divider,
    Chip,
    Button,
    Progress
} from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSearchParams } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import {
    BarChart3,
    PieChart as PieChartIcon,
    Database,
    Table as TableIcon,
    FileText,
    HardDrive,
    Activity,
    Info,
    Play,
    Square,
    Clock,
    Zap,
    Hash,
    Type,
    Code
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const Analytics = () => {
    const [searchParams] = useSearchParams();
    const dbPath = searchParams.get('path');

    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState([]);
    const [stats, setStats] = useState(null);
    const [metadata, setMetadata] = useState(null);

    // Advanced Analysis State
    const [analyzing, setAnalyzed] = useState(false);
    const [progress, setProgress] = useState(null);
    const [analysisResults, setAnalysisResults] = useState(null);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
    const TYPE_COLORS = {
        numeric: 'var(--primary)',
        alphabets: 'var(--chart-2)',
        special: 'var(--chart-3)',
        unknown: 'var(--muted)'
    };

    const rowChartConfig = {
        row_count: {
            label: "Rows",
            color: "var(--primary)",
        },
    };

    const charChartConfig = {
        count: {
            label: "Count",
            color: "var(--secondary)",
        },
    };

    const pieChartConfig = {
        Numeric: { label: "Numeric", color: "var(--primary)" },
        Alphabets: { label: "Alphabets", color: "var(--chart-2)" },
        Special: { label: "Special", color: "var(--chart-3)" },
        Unknown: { label: "Unknown", color: "var(--muted)" },
    };

    const fetchData = async () => {
        if (!dbPath) return;
        setLoading(true);
        try {
            const [tableData, dbStats, allDbs] = await Promise.all([
                invoke('get_tables', { path: dbPath }),
                invoke('get_db_stats', { path: dbPath }),
                invoke('list_databases')
            ]);
            setTables(tableData);
            setStats(dbStats);

            const currentMeta = allDbs.find(db => db.path === dbPath);
            setMetadata(currentMeta);
            if (currentMeta?.analysis_results) {
                setAnalysisResults(JSON.parse(currentMeta.analysis_results));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dbPath]);

    useEffect(() => {
        let unlistenPromise = listen('analysis-progress', (event) => {
            if (event.payload.db_path === dbPath) {
                setProgress(event.payload);
                if (event.payload.is_finished) {
                    setAnalyzed(false);
                    fetchData(); // Refresh results
                }
            }
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [dbPath]);

    const handleStartAnalysis = async () => {
        try {
            setAnalyzed(true);
            await invoke('start_db_analysis', { path: dbPath });
        } catch (err) {
            console.error(err);
            setAnalyzed(false);
        }
    };

    const handleStopAnalysis = async () => {
        try {
            await invoke('stop_db_analysis', { path: dbPath });
            setAnalyzed(false);
            setProgress(null);
        } catch (err) {
            console.error(err);
        }
    };

    const typeData = useMemo(() => {
        if (!analysisResults?.type_distribution) return [];
        const dist = analysisResults.type_distribution;
        return [
            { name: 'Numeric', value: dist.numeric, fill: TYPE_COLORS.numeric },
            { name: 'Alphabets', value: dist.alphabets, fill: TYPE_COLORS.alphabets },
            { name: 'Special', value: dist.special, fill: TYPE_COLORS.special },
            { name: 'Unknown', value: dist.unknown, fill: TYPE_COLORS.unknown }
        ].filter(d => d.value > 0);
    }, [analysisResults]);

    const charFrequencyData = useMemo(() => {
        if (!analysisResults?.char_frequency) return [];
        return Object.entries(analysisResults.char_frequency)
            .map(([unicode, count]) => ({
                char: String.fromCharCode(parseInt(unicode)),
                unicode: `U+${parseInt(unicode).toString(16).toUpperCase().padStart(4, '0')}`,
                count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [analysisResults]);

    if (!dbPath) {
        return (
            <Card className="p-12 text-center flex flex-col items-center gap-4 rounded-3xl border border-border">
                <Database size={48} className="text-muted-foreground" />
                <h2 className="text-2xl font-bold">No Database Selected</h2>
                <p className="text-muted-foreground">Select a database from the dashboard to view its analytics.</p>
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Spinner size="lg" label="Generating analytics..." color="primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-10">
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-4">
                        <BarChart3 className="text-primary" size={36} /> Database Analytics
                    </h1>
                    <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl w-fit">
                        <Database size={14} className="text-muted-foreground" />
                        <p className="text-muted-foreground font-mono text-xs truncate max-w-xl">{dbPath}</p>
                    </div>
                </div>

                {!analyzing ? (
                    <Button
                        onPress={handleStartAnalysis}
                        color="primary"
                        size="lg"
                        startContent={<Play size={18} />}
                        className="rounded-xl font-bold"
                    >
                        {analysisResults ? 'Re-run Deep Analysis' : 'Start Deep Analysis'}
                    </Button>
                ) : (
                    <Button
                        onPress={handleStopAnalysis}
                        color="danger"
                        variant="flat"
                        size="lg"
                        startContent={<Square size={18} />}
                        className="rounded-xl font-bold"
                    >
                        Stop Analysis
                    </Button>
                )}
            </div>

            {/* Progress Bar for Analysis */}
            {analyzing && progress && (
                <Card className="p-8 border border-primary/20 bg-primary/5 rounded-3xl shadow-lg">
                    <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Activity className="text-primary animate-pulse" size={20} />
                                    Analyzing Database Contents...
                                </h3>
                                <p className="text-sm text-muted-foreground">Scanning every cell for character patterns and formats</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-primary">{progress.progress.toFixed(1)}%</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Completed</p>
                            </div>
                        </div>

                        <Progress
                            value={progress.progress}
                            color="primary"
                            className="h-3 rounded-full"
                            isStriped
                            aria-label="Analysis progress"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-center gap-3 bg-background/50 p-4 rounded-2xl border border-border/50">
                                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500">
                                    <Hash size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Records</p>
                                    <p className="font-bold">{progress.records_processed.toLocaleString()} / {progress.total_records.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-background/50 p-4 rounded-2xl border border-border/50">
                                <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time Remaining</p>
                                    <p className="font-bold">
                                        {progress.time_remaining_secs > 60
                                            ? `${Math.floor(progress.time_remaining_secs / 60)}m ${progress.time_remaining_secs % 60}s`
                                            : `${progress.time_remaining_secs}s`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-background/50 p-4 rounded-2xl border border-border/50">
                                <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Speed</p>
                                    <p className="font-bold">{Math.round(progress.speed_records_per_sec).toLocaleString()} rec/s</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 border border-border bg-background rounded-3xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-500">
                            <TableIcon size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tables</p>
                            <h3 className="text-2xl font-black">{stats?.total_tables || 0}</h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border border-border bg-background rounded-3xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-500">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Rows</p>
                            <h3 className="text-2xl font-black">
                                {stats?.total_records > 1000 ? (stats.total_records / 1000).toFixed(1) + 'k' : stats?.total_records || 0}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border border-border bg-background rounded-3xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-500">
                            <HardDrive size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">File Size</p>
                            <h3 className="text-2xl font-black">
                                {stats?.file_size_kb > 1024 ? (stats.file_size_kb / 1024).toFixed(1) + ' MB' : (stats?.file_size_kb || 0) + ' KB'}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border border-border bg-background rounded-3xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-500">
                            <Type size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Characters</p>
                            <h3 className="text-2xl font-black">
                                {analysisResults?.total_chars
                                    ? (analysisResults.total_chars > 1000000
                                        ? (analysisResults.total_chars / 1000000).toFixed(1) + 'M'
                                        : (analysisResults.total_chars > 1000
                                            ? (analysisResults.total_chars / 1000).toFixed(1) + 'k'
                                            : analysisResults.total_chars))
                                    : 'N/A'}
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bar Chart: Rows per Table */}
                <Card className="p-8 border border-border bg-background rounded-3xl shadow-sm h-[500px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl text-primary">
                                <BarChart3 size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Rows per Table</h3>
                        </div>
                        <Chip size="sm" variant="flat" color="primary">Distribution</Chip>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ChartContainer config={rowChartConfig} className="h-full w-full aspect-auto">
                            <BarChart data={tables}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    content={<ChartTooltipContent />}
                                />
                                <Bar
                                    dataKey="row_count"
                                    fill="var(--color-row_count)"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={60}
                                />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </Card>

                {/* Pie Chart: Data Composition (Types) */}
                <Card className="p-8 border border-border bg-background rounded-3xl shadow-sm h-[500px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-secondary/10 p-2 rounded-xl text-secondary">
                                <PieChartIcon size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Data Composition (Types)</h3>
                        </div>
                        <Chip size="sm" variant="flat" color="secondary">Character level</Chip>
                    </div>
                    <div className="flex-1 min-h-0">
                        {analysisResults ? (
                            <ChartContainer config={pieChartConfig} className="h-full w-full aspect-auto">
                                <PieChart>
                                    <Pie
                                        data={typeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={140}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                    >
                                        {typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <ChartTooltip
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-xs font-medium text-muted-foreground">{value}</span>}
                                    />
                                </PieChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                <Info size={48} className="text-muted-foreground opacity-20" />
                                <p className="text-muted-foreground max-w-xs text-sm">Run "Deep Analysis" to see data type composition at the character level.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Character Frequency Chart */}
                <Card className="p-8 border border-border bg-background rounded-3xl shadow-sm h-[500px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-500/10 p-2 rounded-xl text-purple-500">
                                <Type size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Top Characters</h3>
                        </div>
                        <Chip size="sm" variant="flat" color="secondary">Frequency</Chip>
                    </div>
                    <div className="flex-1 min-h-0">
                        {analysisResults ? (
                            <ChartContainer config={charChartConfig} className="h-full w-full aspect-auto">
                                <BarChart data={charFrequencyData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="char"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                        tick={{ fill: 'var(--foreground)', fontSize: 16, fontWeight: 'bold' }}
                                    />
                                    <ChartTooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                        content={<ChartTooltipContent />}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 6, 6, 0]}
                                        maxBarSize={30}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                <Type size={48} className="text-muted-foreground opacity-20" />
                                <p className="text-muted-foreground max-w-xs text-sm">Character frequency data will appear here after analysis.</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Column Format detection */}
                <Card className="p-8 border border-border bg-background rounded-3xl shadow-sm h-[500px] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500">
                                <Code size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Format Insights</h3>
                        </div>
                        <Chip size="sm" variant="flat" color="primary">Pattern detection</Chip>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {analysisResults?.column_formats && Object.keys(analysisResults.column_formats).length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {Object.entries(analysisResults.column_formats).map(([col, formats]) => (
                                    <div key={col} className="p-4 bg-muted/20 rounded-2xl border border-border/50">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{col}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {formats.map(f => (
                                                <Chip key={f} size="sm" variant="dot" color="primary">{f}</Chip>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                <Code size={48} className="text-muted-foreground opacity-20" />
                                <p className="text-muted-foreground max-w-xs text-sm">Automated format detection (Email, URL, etc.) results will appear here.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Table details list */}
            <Card className="p-8 border border-border bg-background rounded-3xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-muted/30 p-2 rounded-xl">
                        <Info size={20} />
                    </div>
                    <h3 className="text-xl font-bold">Detailed Table Inventory</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="pb-4 font-bold text-xs uppercase tracking-widest">Table Name</th>
                                <th className="pb-4 font-bold text-xs uppercase tracking-widest text-right">Row Count</th>
                                <th className="pb-4 font-bold text-xs uppercase tracking-widest text-right">Weight</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {tables.map((table, index) => (
                                <tr key={table.name} className="group hover:bg-muted/5 transition-colors">
                                    <td className="py-4 font-bold flex items-center gap-3">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        {table.name}
                                    </td>
                                    <td className="py-4 text-right font-mono text-sm">{table.row_count.toLocaleString()}</td>
                                    <td className="py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {stats?.total_records > 0 ? ((table.row_count / stats.total_records) * 100).toFixed(1) : 0}%
                                            </span>
                                            <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${stats?.total_records > 0 ? (table.row_count / stats.total_records) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Analytics;
