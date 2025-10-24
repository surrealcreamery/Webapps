import React from 'react';
import { Box, Paper, Typography, List, ListItemButton, ListItemText, Divider } from '@mui/material';

export default function ReportSelectionList({ onSelectReport }) {
    return (
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: '60px' }}>
            <Typography variant="h4" gutterBottom>Select a Report</Typography>
            <Paper>
                <List component="nav">
                    <ListItemButton onClick={() => onSelectReport('Daily Profit and Loss')}>
                        <ListItemText
                            primary="Daily Profit and Loss"
                            secondary="View daily financial performance, including profitability, labor, and sales breakdowns."
                        />
                    </ListItemButton>
                    <Divider />
                    <ListItemButton onClick={() => onSelectReport('Historical Sales Report')}>
                        <ListItemText
                            primary="Historical Sales Report"
                            secondary="Analyze 1-year and 3-year sales trends by revenue source."
                        />
                    </ListItemButton>
                </List>
            </Paper>
        </Box>
    );
}