import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import { fetchModifiersBySku } from '@/services/squareModifiers';

/**
 * ModifierSelector Component (Catering-style Staged Approach)
 *
 * Fetches and displays product modifiers from Square in a step-by-step flow.
 * Uses visual card selection similar to the catering Make Your Own Cake Jar.
 */
export const ModifierSelector = forwardRef(({
    sku,
    onSelectionsChange,
    onPriceChange,
    onValidationChange,
    onAllStepsComplete,
    onCanContinueChange,
    onIsLastStepChange,
}, ref) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modifierData, setModifierData] = useState(null);
    const [selections, setSelections] = useState({});
    const [currentStep, setCurrentStep] = useState(0);

    // Fetch modifiers when SKU changes
    useEffect(() => {
        if (!sku) {
            setLoading(false);
            setModifierData(null);
            return;
        }

        const loadModifiers = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchModifiersBySku(sku);
                setModifierData(data);

                // Initialize selections with defaults
                const initialSelections = {};
                data?.modifierCategories?.forEach(category => {
                    if (category.selectionType === 'SINGLE' && category.required) {
                        // Pre-select first option for required single-select
                        const firstMod = category.modifiers[0];
                        if (firstMod) {
                            initialSelections[category.id] = [firstMod.id];
                        }
                    } else {
                        initialSelections[category.id] = [];
                    }
                });
                setSelections(initialSelections);
                setCurrentStep(0);

            } catch (err) {
                console.error('Failed to load modifiers:', err);
                // Don't show error for "product not found" - just means no modifiers
                if (err.message?.includes('not found') || err.message?.includes('404')) {
                    setModifierData({ hasModifiers: false });
                } else {
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        loadModifiers();
    }, [sku]);

    // Calculate total price and validation when selections change
    useEffect(() => {
        if (!modifierData?.modifierCategories) return;

        // Calculate total price
        let totalPrice = 0;
        modifierData.modifierCategories.forEach(category => {
            const selectedIds = selections[category.id] || [];
            selectedIds.forEach(modId => {
                const modifier = category.modifiers.find(m => m.id === modId);
                if (modifier) {
                    totalPrice += modifier.price || 0;
                }
            });
        });
        onPriceChange?.(totalPrice);

        // Validate selections
        const errors = [];
        modifierData.modifierCategories.forEach(category => {
            const selectedIds = selections[category.id] || [];
            const count = selectedIds.length;

            if (category.required && count === 0) {
                errors.push(`Please select a ${category.name}`);
            }
            if (category.minSelections > 0 && count < category.minSelections) {
                errors.push(`Please select at least ${category.minSelections} for ${category.name}`);
            }
            if (category.maxSelections > 0 && count > category.maxSelections) {
                errors.push(`Maximum ${category.maxSelections} selections for ${category.name}`);
            }
        });

        onValidationChange?.({
            valid: errors.length === 0,
            errors,
        });

        // Notify parent of selections
        onSelectionsChange?.(selections, modifierData.modifierCategories);

    }, [selections, modifierData]);

    // Notify parent when all steps are complete
    useEffect(() => {
        if (!modifierData?.modifierCategories) {
            onAllStepsComplete?.(false);
            return;
        }

        const categories = modifierData.modifierCategories;
        const isLastStep = currentStep === categories.length - 1;
        const allStepsComplete = isLastStep && canContinue();

        onAllStepsComplete?.(allStepsComplete);
    }, [currentStep, selections, modifierData]);

    // Handle single selection (radio-style)
    const handleSingleSelect = (categoryId, modifierId) => {
        setSelections(prev => ({
            ...prev,
            [categoryId]: [modifierId],
        }));
    };

    // Handle multiple selection (checkbox-style)
    const handleMultiSelect = (categoryId, modifierId, maxSelections) => {
        setSelections(prev => {
            const current = prev[categoryId] || [];
            const isSelected = current.includes(modifierId);

            if (isSelected) {
                return {
                    ...prev,
                    [categoryId]: current.filter(id => id !== modifierId),
                };
            } else {
                if (maxSelections > 0 && current.length >= maxSelections) {
                    return {
                        ...prev,
                        [categoryId]: [...current.slice(1), modifierId],
                    };
                }
                return {
                    ...prev,
                    [categoryId]: [...current, modifierId],
                };
            }
        });
    };

    // Check if current step can proceed
    const canContinue = () => {
        if (!modifierData?.modifierCategories) return false;
        const category = modifierData.modifierCategories[currentStep];
        if (!category) return false;

        const selectedIds = selections[category.id] || [];
        const count = selectedIds.length;

        if (category.required && count === 0) return false;
        if (category.minSelections > 0 && count < category.minSelections) return false;

        return true;
    };

    const handleContinue = () => {
        if (currentStep < (modifierData?.modifierCategories?.length || 0) - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        continueToNextStep: handleContinue,
        canContinue: canContinue,
    }));

    // Notify parent of canContinue and isLastStep changes
    useEffect(() => {
        const categories = modifierData?.modifierCategories || [];
        const isLast = categories.length > 0 && currentStep === categories.length - 1;
        onCanContinueChange?.(canContinue());
        onIsLastStepChange?.(isLast);
    }, [currentStep, selections, modifierData]);

    const handleEditStep = (stepIndex) => {
        setCurrentStep(stepIndex);
    };

    // Get selected modifier names for a category (for collapsed summary)
    const getSelectedNames = (category) => {
        const selectedIds = selections[category.id] || [];
        return selectedIds
            .map(id => category.modifiers.find(m => m.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    };

    // Expose current step info to parent
    const isLastStep = modifierData?.modifierCategories
        ? currentStep === modifierData.modifierCategories.length - 1
        : false;

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ py: 2 }}>
                <Typography color="error" variant="body2">
                    Failed to load customization options
                </Typography>
                <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    SKU: {sku} | Error: {error}
                </Typography>
            </Box>
        );
    }

    if (!modifierData?.hasModifiers) {
        return null;
    }

    const categories = modifierData.modifierCategories || [];

    return (
        <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '2rem' }}>
                Customize Your Order
            </Typography>

            {categories.map((category, index) => {
                const selectedIds = selections[category.id] || [];
                const isSingle = category.selectionType === 'SINGLE';
                const maxSelections = category.maxSelections > 0 ? category.maxSelections : null;
                const isCurrentStep = currentStep === index;
                const isPastStep = currentStep > index;
                const isFutureStep = currentStep < index;

                // Don't show future steps
                if (isFutureStep) return null;

                return (
                    <Box key={category.id} sx={{ mb: 3 }}>
                        {/* Collapsed view for completed steps */}
                        {isPastStep ? (
                            <Box
                                onClick={() => handleEditStep(index)}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'grey.100',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: 'grey.200',
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: '2.4rem' }} />
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '1.6rem' }}>
                                            {category.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                            {getSelectedNames(category) || 'None selected'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <EditIcon sx={{ color: 'text.secondary', fontSize: '2rem' }} />
                            </Box>
                        ) : (
                            <>
                                {/* Category Header */}
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: '1.8rem' }}>
                                        {isSingle ? `Select Your ${category.name.replace(' Flavors', '').replace(' (Up To 4 Toppings, Alphabetical Order)', '')}` : `Choose ${category.name}`}
                                        {category.required && (
                                            <Typography
                                                component="span"
                                                sx={{ color: 'error.main', ml: 0.5 }}
                                            >
                                                *
                                            </Typography>
                                        )}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.4rem' }}>
                                        {isSingle ? 'Select one' : (
                                            maxSelections
                                                ? `Select up to ${maxSelections}`
                                                : 'Select as many as you like'
                                        )}
                                    </Typography>
                                </Box>

                                {/* Modifier Options - Visual Card Grid */}
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 1.5,
                                }}>
                                    {category.modifiers.map((modifier) => {
                                        const isSelected = selectedIds.includes(modifier.id);
                                        const hasPrice = modifier.price > 0;

                                        return (
                                            <Box
                                                key={modifier.id}
                                                onClick={() => {
                                                    if (isSingle) {
                                                        handleSingleSelect(category.id, modifier.id);
                                                    } else {
                                                        handleMultiSelect(category.id, modifier.id, maxSelections);
                                                    }
                                                }}
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    cursor: 'pointer',
                                                    backgroundColor: isSelected ? 'primary.main' : 'grey.100',
                                                    color: isSelected ? 'white' : 'text.primary',
                                                    border: '3px solid',
                                                    borderColor: isSelected ? 'primary.main' : 'transparent',
                                                    transition: 'all 0.2s ease',
                                                    position: 'relative',
                                                    '&:hover': {
                                                        backgroundColor: isSelected ? 'primary.dark' : 'grey.200',
                                                        transform: 'scale(1.02)',
                                                    },
                                                }}
                                            >
                                                {/* Selection checkmark */}
                                                {isSelected && (
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 4,
                                                        right: 4,
                                                    }}>
                                                        <CheckCircleIcon sx={{
                                                            fontSize: '2rem',
                                                            color: 'white',
                                                        }} />
                                                    </Box>
                                                )}

                                                {/* Modifier name */}
                                                <Typography
                                                    sx={{
                                                        fontSize: '1.3rem',
                                                        fontWeight: 500,
                                                        textAlign: 'center',
                                                        lineHeight: 1.2,
                                                    }}
                                                >
                                                    {modifier.name}
                                                </Typography>

                                                {/* Price */}
                                                {hasPrice && (
                                                    <Typography
                                                        sx={{
                                                            fontSize: '1.2rem',
                                                            fontWeight: 600,
                                                            mt: 0.5,
                                                            color: isSelected ? 'rgba(255,255,255,0.9)' : 'text.secondary',
                                                        }}
                                                    >
                                                        +${modifier.price.toFixed(2)}
                                                    </Typography>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>

                            </>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
});

ModifierSelector.displayName = 'ModifierSelector';

export default ModifierSelector;
