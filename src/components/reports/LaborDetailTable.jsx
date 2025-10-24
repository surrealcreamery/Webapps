import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import { format, parseISO } from 'date-fns';

// --- HELPER FUNCTIONS ---

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return currencyFormatter.format(value);
};

// --- MAIN COMPONENT ---

const LaborDetailTable = ({ laborDetails, teamMembers }) => {
    const teamMemberMap = useMemo(() => {
        if (!teamMembers) return {};
        return teamMembers.reduce((acc, member) => {
            acc[member.id] = `${member.given_name} ${member.family_name}`;
            return acc;
        }, {});
    }, [teamMembers]);

    if (!laborDetails || laborDetails.length === 0) {
        return null;
    }

    const formatTime = (isoString) => {
        if (!isoString) return '—';
        try {
            return format(parseISO(isoString), 'p');
        } catch {
            return isoString;
        }
    };

    return (
        <Box sx={{ my: 4 }}>
            <Typography variant="h6" gutterBottom>Labor Details</Typography>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Team Member</TableCell>
                            <TableCell>Start At</TableCell>
                            <TableCell>End At</TableCell>
                            <TableCell>Wage Hours</TableCell>
                            <TableCell>Hourly Rate</TableCell>
                            <TableCell>Wage Cost</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {laborDetails.map((detail, index) => {
                            const wageCost = detail['Wage Hours'] * detail['Hourly Rate'];
                            const taxedWageCost = wageCost * 1.12; // Assuming 12% payroll tax/overhead
                            return (
                                <TableRow key={detail['Team Member ID'] || index}>
                                    <TableCell>{teamMemberMap[detail['Team Member ID']] || detail['Team Member ID']}</TableCell>
                                    <TableCell>{formatTime(detail['Start At'])}</TableCell>
                                    <TableCell>{formatTime(detail['End At'])}</TableCell>
                                    <TableCell>{detail['Wage Hours'] ? detail['Wage Hours'].toFixed(2) : '—'}</TableCell>
                                    <TableCell>{formatCurrency(detail['Hourly Rate'])}</TableCell>
                                    <TableCell>{formatCurrency(taxedWageCost)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

LaborDetailTable.propTypes = {
    laborDetails: PropTypes.array,
    teamMembers: PropTypes.array,
};

export default LaborDetailTable;