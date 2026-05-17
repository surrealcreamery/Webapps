import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Floating debug console — bug icon toggle + scrollable log panel.
 */
export function KioskDebugConsole({ logs, showConsole, onToggle, onClear }) {
    return (
        <>
            {/* Toggle button */}
            <Box
                onClick={onToggle}
                sx={{
                    position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
                    width: 40, height: 40, borderRadius: '50%',
                    bgcolor: logs.some(l => l.level === 'error') ? '#d32f2f' : 'rgba(0,0,0,0.6)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
            >
                {showConsole ? 'X' : '\u{1F41B}'}
            </Box>
            {/* Console panel */}
            {showConsole && (
                <Box
                    sx={{
                        position: 'fixed', bottom: 60, right: 8, left: 8, zIndex: 99999,
                        maxHeight: '45vh', bgcolor: 'rgba(0,0,0,0.92)', borderRadius: 2,
                        border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <Typography sx={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>
                            Debug Console ({logs.length} entries)
                        </Typography>
                        <Typography
                            onClick={onClear}
                            sx={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', '&:hover': { color: 'white' } }}
                        >
                            Clear
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 1, display: 'flex', flexDirection: 'column-reverse' }}>
                        <Box>
                            {logs.map((log, i) => (
                                <Box key={i} sx={{ py: 0.25, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Typography
                                        component="pre"
                                        sx={{
                                            fontFamily: 'monospace', fontSize: '10px', m: 0,
                                            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                            color: log.level === 'error' ? '#ff6b6b' : log.level === 'warn' ? '#ffd93d' : '#b8e6b8',
                                        }}
                                    >
                                        <span style={{ color: '#666', marginRight: 4 }}>
                                            {new Date(log.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        {log.level !== 'log' && <span>[{log.level.toUpperCase()}] </span>}
                                        {log.msg}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            )}
        </>
    );
}
