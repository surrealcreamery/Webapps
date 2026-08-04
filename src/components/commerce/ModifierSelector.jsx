import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { fetchModifiersBySku } from '@/services/squareModifiers';
import { trackModifierSelected } from '@/services/analytics';

/**
 * ModifierSelector Component (Catering-style Staged Approach)
 *
 * Fetches and displays product modifiers from Square in a step-by-step flow.
 * Uses visual card selection similar to the catering Make Your Own Cake Jar.
 */
export const ModifierSelector = forwardRef(({
    sku,
    title,
    description,
    layout = 'stepper',
    preSelectedModifier = null,
    autoAdvance = false,
    onSelectionsChange,
    onPriceChange,
    onValidationChange,
    onAllStepsComplete,
    onCanContinueChange,
    onIsLastStepChange,
    onShowIntroChange,
    onLoadingChange,
}, ref) => {
    const isFlat = layout === 'flat';
    const isGrid = layout === 'grid';
    const isAllAtOnce = isFlat || isGrid;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modifierData, setModifierData] = useState(null);
    const [selections, setSelections] = useState({});
    const [currentStep, setCurrentStep] = useState(0);
    const [showIntro, setShowIntro] = useState(false);

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

                // Initialize selections with empty arrays
                const initialSelections = {};
                data?.modifierCategories?.forEach(category => {
                    initialSelections[category.id] = [];
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
                onLoadingChange?.(false);
            }
        };

        loadModifiers();
    }, [sku]);

    // Apply pre-selected modifier from MYO teaser grid (runs after data loads or when preSelectedModifier changes)
    useEffect(() => {
        if (!preSelectedModifier || !modifierData?.modifierCategories) return;

        const { categoryId, optionId } = preSelectedModifier;
        const category = modifierData.modifierCategories.find(c => c.id === categoryId);
        const option = category?.modifiers?.find(m => m.id === optionId);

        if (category && option) {
            setSelections(prev => ({
                ...prev,
                [categoryId]: [optionId],
            }));
            setShowIntro(false);
            setCurrentStep(1);
        }
    }, [preSelectedModifier, modifierData]);

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
        const linkedIds = modifierData.totalModifierCategoryIds || [];
        const hasLinked = !!modifierData.totalModifierSelections && linkedIds.length > 0;
        modifierData.modifierCategories.forEach(category => {
            const selectedIds = selections[category.id] || [];
            const count = selectedIds.length;

            if (category.required && count === 0) {
                errors.push(`Please select a ${category.name}`);
            }
            if (category.minSelections > 0 && count < category.minSelections) {
                errors.push(`Please select at least ${category.minSelections} for ${category.name}`);
            }
            // Skip per-category max for linked categories (total limit controls them)
            const isLinked = hasLinked && linkedIds.includes(category.id);
            if (!isLinked && category.maxSelections > 0 && count > category.maxSelections) {
                errors.push(`Maximum ${category.maxSelections} selections for ${category.name}`);
            }
        });

        onValidationChange?.({
            valid: errors.length === 0,
            errors,
        });

        // Notify parent of selections (include full modifierData for Square catalog IDs)
        onSelectionsChange?.(selections, modifierData.modifierCategories, modifierData);

    }, [selections, modifierData]);

    const autoAdvanceTimer = useRef(null);

    const categories = modifierData?.modifierCategories || [];

    // Group linked categories into a single step, keep others as individual steps
    const steps = useMemo(() => {
        if (!categories.length) return [];
        const linkedIds = modifierData?.totalModifierCategoryIds || [];
        if (linkedIds.length <= 1) {
            return categories.map(cat => ({ categories: [cat], isGrouped: false }));
        }
        const result = [];
        let linkedGroup = null;
        categories.forEach(cat => {
            if (linkedIds.includes(cat.id)) {
                if (!linkedGroup) {
                    linkedGroup = { categories: [], isGrouped: true };
                    result.push(linkedGroup);
                }
                linkedGroup.categories.push(cat);
            } else {
                result.push({ categories: [cat], isGrouped: false });
            }
        });
        return result;
    }, [categories, modifierData?.totalModifierCategoryIds]);

    // Notify parent when all steps are complete (last step with valid selections)
    useEffect(() => {
        if (!modifierData?.modifierCategories?.length) {
            // Still loading (null) — don't change parent state; confirmed no modifiers — report valid
            if (modifierData) onAllStepsComplete?.(true);
            return;
        }
        if (isAllAtOnce) {
            // In flat/grid mode, check all categories at once
            const allValid = categories.every(category => {
                const selectedIds = selections[category.id] || [];
                if (category.required && selectedIds.length === 0) return false;
                if (category.minSelections > 0 && selectedIds.length < category.minSelections) return false;
                return true;
            });
            onAllStepsComplete?.(allValid);
            return;
        }
        if (!steps.length) {
            onAllStepsComplete?.(false);
            return;
        }
        const isLastStep = currentStep === steps.length - 1;
        const stepValid = (() => {
            const step = steps[currentStep];
            if (!step) return false;
            for (const category of step.categories) {
                const selectedIds = selections[category.id] || [];
                if (category.required && selectedIds.length === 0) return false;
                if (category.minSelections > 0 && selectedIds.length < category.minSelections) return false;
            }
            return true;
        })();
        onAllStepsComplete?.(isLastStep && stepValid);
    }, [currentStep, selections, modifierData, steps]);

    // Count total selections across linked categories (or all if none specified)
    const getTotalSelectionCount = () => {
        const linkedIds = modifierData?.totalModifierCategoryIds;
        const entries = linkedIds?.length > 0
            ? Object.entries(selections).filter(([catId]) => linkedIds.includes(catId))
            : Object.entries(selections);
        return entries.reduce((sum, [, ids]) => sum + ids.length, 0);
    };

    // Check if a category counts toward the total limit
    const isCategoryLinked = (categoryId) => {
        const linkedIds = modifierData?.totalModifierCategoryIds;
        return !linkedIds?.length || linkedIds.includes(categoryId);
    };

    // Scroll to next category after a selection is made
    const scrollToNextCategory = (categoryId) => {
        const cats = modifierData?.modifierCategories || [];
        const idx = cats.findIndex(cat => cat.id === categoryId);
        const nextCat = cats[idx + 1];
        if (nextCat) {
            setTimeout(() => {
                const el = document.getElementById(`modifier-category-${nextCat.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }
    };

    // Handle single selection (radio-style)
    const handleSingleSelect = (categoryId, modifierId) => {
        const currentSelection = selections[categoryId] || [];
        const isReplacingExisting = currentSelection.length > 0;
        const totalLimit = modifierData?.totalModifierSelections;

        // If at total limit and not replacing an existing selection, block (only for linked categories)
        if (totalLimit && !isReplacingExisting && isCategoryLinked(categoryId)) {
            const totalCount = getTotalSelectionCount();
            if (totalCount >= totalLimit) return;
        }

        const wasEmpty = currentSelection.length === 0;
        setSelections(prev => ({
            ...prev,
            [categoryId]: [modifierId],
        }));
        const category = categories.find(c => c.id === categoryId);
        const modifier = category?.modifiers?.find(m => m.id === modifierId);
        if (modifier) trackModifierSelected(sku, category?.name, modifier.name, modifier.price || 0);
        if (wasEmpty) scrollToNextCategory(categoryId);
        if (autoAdvance) {
            clearTimeout(autoAdvanceTimer.current);
            autoAdvanceTimer.current = setTimeout(() => handleContinue(), 300);
        }
    };

    // Handle multiple selection (allows duplicates — tap again to add more)
    const handleMultiSelect = (categoryId, modifierId, maxSelections) => {
        setSelections(prev => {
            const current = prev[categoryId] || [];
            // Always try to add another instance
            // Check total limit (only for linked categories)
            const totalLimit = modifierData?.totalModifierSelections;
            if (totalLimit && isCategoryLinked(categoryId)) {
                const linkedCatIds = modifierData?.totalModifierCategoryIds;
                const entries = linkedCatIds?.length > 0
                    ? Object.entries(prev).filter(([catId]) => linkedCatIds.includes(catId))
                    : Object.entries(prev);
                const totalCount = entries.reduce((sum, [, ids]) => sum + ids.length, 0);
                if (totalCount >= totalLimit) return prev; // Block
            }
            // Check per-category max — block if full
            if (maxSelections > 0 && current.length >= maxSelections) {
                return prev;
            }
            return {
                ...prev,
                [categoryId]: [...current, modifierId],
            };
        });
        const category = categories.find(c => c.id === categoryId);
        const modifier = category?.modifiers?.find(m => m.id === modifierId);
        if (modifier) trackModifierSelected(sku, category?.name, modifier.name, modifier.price || 0);
    };

    // Remove one instance of a modifier from a category
    const handleRemoveOne = (categoryId, modifierId) => {
        setSelections(prev => {
            const current = prev[categoryId] || [];
            const idx = current.indexOf(modifierId);
            if (idx === -1) return prev;
            const updated = [...current];
            updated.splice(idx, 1);
            return { ...prev, [categoryId]: updated };
        });
    };

    // Check if current step has valid selections (used internally and for parent notification)
    const canContinueCheck = () => {
        if (showIntro) return false;
        const step = steps[currentStep];
        if (!step) return false;
        for (const category of step.categories) {
            const selectedIds = selections[category.id] || [];
            const count = selectedIds.length;
            if (category.required && count === 0) return false;
            if (category.minSelections > 0 && count < category.minSelections) return false;
        }
        return true;
    };

    // Check if current step can proceed
    const canContinue = canContinueCheck;

    const handleContinue = () => {
        const totalSteps = steps.length;
        if (currentStep < totalSteps - 1) {
            setCurrentStep(currentStep + 1);
        }
        // On last step, parent handles add-to-cart directly
    };

    // Expose methods to parent via ref
    const [showRequiredErrors, setShowRequiredErrors] = useState(false);

    useImperativeHandle(ref, () => ({
        continueToNextStep: handleContinue,
        canContinue: canContinue,
        dismissIntro: () => setShowIntro(false),
        removeSelection: (categoryId, modifierId) => {
            setSelections(prev => {
                const current = prev[categoryId] || [];
                const idx = current.indexOf(modifierId);
                if (idx === -1) return prev;
                const updated = [...current];
                updated.splice(idx, 1);
                return { ...prev, [categoryId]: updated };
            });
        },
        highlightRequired: () => {
            setShowRequiredErrors(true);
            const missing = categories.find(cat => cat.required && (selections[cat.id] || []).length === 0);
            if (missing) {
                const el = document.getElementById(`modifier-category-${missing.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        },
    }));

    // Notify parent of canContinue and isLastStep changes
    useEffect(() => {
        if (isAllAtOnce) {
            onCanContinueChange?.(true);
            onIsLastStepChange?.(true);
            onShowIntroChange?.(false);
        } else {
            onCanContinueChange?.(canContinue());
            onIsLastStepChange?.(currentStep === steps.length - 1);
            onShowIntroChange?.(showIntro);
        }
    }, [currentStep, selections, modifierData, steps, showIntro, isAllAtOnce]);

    const handleEditStep = (stepIndex) => {
        setCurrentStep(stepIndex);
    };

    if (loading) {
        return (
            <Box role="status" aria-live="polite" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} aria-label="Loading" />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ py: 2 }}>
                <Typography color="error" variant="body2">
                    Failed to load customization options
                </Typography>
                <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: '1.6rem' }}>
                    SKU: {sku} | Error: {error}
                </Typography>
            </Box>
        );
    }

    if (!modifierData?.hasModifiers) {
        return null;
    }

    // Render a single modifier item (circle + name + price)
    // size: 'large' (stepper grid), 'fill' (flat horizontal — fills available height)
    const renderModifierItem = (category, modifier, size = 'large') => {
        const selectedIds = selections[category.id] || [];
        const isSelected = selectedIds.includes(modifier.id);
        const selectionCount = selectedIds.filter(id => id === modifier.id).length;
        const hasPrice = modifier.price > 0;
        const imageUrl = modifier.imageVariants?.thumb?.url || modifier.image || modifier.imageUrl;
        const totalLimit = modifierData?.totalModifierSelections;
        const linkedFull = totalLimit && isCategoryLinked(category.id) && getTotalSelectionCount() >= totalLimit;
        const categoryMax = category.maxSelections > 0 ? category.maxSelections : null;
        const categoryFull = categoryMax && selectedIds.length >= categoryMax && !isCategoryLinked(category.id);
        const isAtLimit = linkedFull || categoryFull;
        const isDisabled = isAtLimit && !isSelected;
        const hasLinkedTotal = modifierData?.totalModifierSelections && isCategoryLinked(category.id);
        const isSingle = !hasLinkedTotal && category.selectionType === 'SINGLE';
        const maxSelections = hasLinkedTotal ? null : (category.maxSelections > 0 ? category.maxSelections : null);
        const isFill = size === 'fill';
        // fill mode: circle sized to fill the row height, clamped so it never shrinks below 60px on small screens
        const circleSize = isFill ? 'clamp(60px, calc((50dvh - 200px) / 2), 120px)' : 68;
        const fontSize = isFill ? '1.6rem' : '1.6rem';
        const initialFontSize = isFill ? '1.6rem' : '1.6rem';

        return (
            <Box
                key={modifier.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-label={`${modifier.name}${isSelected ? ', selected' : ''}${selectionCount > 1 ? `, ${selectionCount} selected` : ''}${hasPrice ? `, +$${modifier.price.toFixed(2)}` : ''}`}
                onClick={() => {
                    if (isDisabled) return;
                    if (isSingle) {
                        handleSingleSelect(category.id, modifier.id);
                    } else {
                        handleMultiSelect(category.id, modifier.id, maxSelections);
                    }
                }}
                onKeyDown={(e) => {
                    if (isDisabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (isSingle) {
                            handleSingleSelect(category.id, modifier.id);
                        } else {
                            handleMultiSelect(category.id, modifier.id, maxSelections);
                        }
                    }
                }}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    pointerEvents: isDisabled ? 'none' : 'auto',
                    flexShrink: 0,
                    ...(isFill && {
                        width: 'clamp(76px, calc((50dvh - 200px) / 2 + 16px), 136px)',
                        overflow: 'hidden',
                        minHeight: 0,
                    }),
                }}
            >
                <Box sx={{ position: 'relative' }}>
                    <Box
                        sx={{
                            width: circleSize,
                            height: circleSize,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: isSelected ? '3px solid #1976d2' : '2px solid #e0e0e0',
                            boxShadow: isSelected ? '0 0 0 2px #1976d2' : '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f0e6',
                        }}
                    >
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={modifier.name}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <Typography sx={{ fontSize: initialFontSize, color: 'text.secondary' }}>
                                {modifier.name.charAt(0).toUpperCase()}
                            </Typography>
                        )}
                    </Box>
                    {selectionCount > 1 && (
                        <Box sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            bgcolor: '#1976d2',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            fontWeight: 700,
                            border: '2px solid white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}>
                            {selectionCount}
                        </Box>
                    )}
                    {selectionCount > 0 && !isSingle && (
                        <Box
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove one ${modifier.name}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOne(category.id, modifier.id);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveOne(category.id, modifier.id);
                                }
                            }}
                            sx={{
                                position: 'absolute',
                                top: -4,
                                left: -4,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                bgcolor: 'grey.600',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.6rem',
                                fontWeight: 700,
                                border: '2px solid white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                lineHeight: 1,
                            }}
                        >
                            −
                        </Box>
                    )}
                </Box>
                <Typography sx={{ fontSize, mt: isFill ? 0.5 : 2, textAlign: 'center', lineHeight: 1.2 }}>
                    {modifier.name}
                </Typography>
                {hasPrice && (
                    <Typography sx={{ fontSize, color: 'text.secondary' }}>
                        +${modifier.price.toFixed(2)}
                    </Typography>
                )}
            </Box>
        );
    };

    // Render a single category's modifier grid
    const renderCategoryGrid = (category, gridColumns) => {
        const hasLinkedTotal = modifierData?.totalModifierSelections && isCategoryLinked(category.id);
        const isSingle = !hasLinkedTotal && category.selectionType === 'SINGLE';
        const maxSelections = hasLinkedTotal ? null : (category.maxSelections > 0 ? category.maxSelections : null);

        return (
            <Box key={category.id} id={`modifier-category-${category.id}`} sx={{ mb: 3, scrollMarginTop: '16px' }}>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, textAlign: 'center' }}>
                    {category.name}
                </Typography>
                <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
                    {isSingle
                        ? category.required ? 'Select one' : 'Select one (optional)'
                        : maxSelections
                            ? category.required ? `Select up to ${maxSelections}` : `Select up to ${maxSelections} (optional)`
                            : category.required ? 'Select one or more' : 'Select one or more (optional)'}
                </Typography>
                {!isSingle && (
                    <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mt: 0.25, textAlign: 'center' }}>
                        Tap to add the same modifier more than once
                    </Typography>
                )}
                {showRequiredErrors && category.required && (selections[category.id] || []).length === 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mt: 1, mx: 'auto', px: 2, py: 0.75, bgcolor: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.4)', borderRadius: 2, maxWidth: 'fit-content' }}>
                        <Typography sx={{ fontSize: '1.6rem', color: '#6d4c00', fontWeight: 600 }}>
                            Selection Required
                        </Typography>
                    </Box>
                )}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridColumns || 3}, 1fr)`,
                    gap: 1.5,
                    justifyItems: 'center',
                }}>
                    {category.modifiers.map((modifier) => renderModifierItem(category, modifier))}
                </Box>
            </Box>
        );
    };

    // Grid mode: all categories at once, 3-column grid, vertical scroll
    if (layout === 'grid') {
        return (
            <Box sx={{ pt: 2 }}>
                {categories.map((category) => renderCategoryGrid(category, 3))}
            </Box>
        );
    }

    // Flat mode: horizontal scroll with category name on top, modifiers in 2 rows filling height
    if (isFlat) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 2,
                px: 2,
                minWidth: 'max-content',
                height: '100%',
            }}>
                {categories.map((category) => {
                    const topRowCount = Math.ceil(category.modifiers.length / 2);
                    return (
                        <Box key={category.id} sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', pt: 1.5, pb: 1, overflow: 'hidden' }}>
                            {/* Category name */}
                            <Typography sx={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 700, textAlign: 'left', lineHeight: 1.2, pb: 1, flexShrink: 0 }}>
                                {category.name}
                            </Typography>
                            {showRequiredErrors && category.required && (selections[category.id] || []).length === 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, mb: 1, px: 2, py: 0.75, bgcolor: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.4)', borderRadius: 2, maxWidth: 'fit-content', flexShrink: 0 }}>
                                    <Typography sx={{ fontSize: '1.6rem', color: '#8b6508', fontWeight: 600 }}>
                                        Selection Required
                                    </Typography>
                                </Box>
                            )}
                            {/* 2-row grid of modifiers */}
                            <Box sx={{
                                display: 'grid',
                                gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
                                gridAutoFlow: 'column',
                                gridTemplateColumns: `repeat(${topRowCount}, auto)`,
                                rowGap: 0.5,
                                columnGap: 2,
                                justifyItems: 'center',
                                flex: 1,
                                minHeight: 0,
                                overflow: 'hidden',
                            }}>
                                {category.modifiers.map((modifier) => renderModifierItem(category, modifier, 'fill'))}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    }

    // Stepper mode (default)
    return (
        <Box sx={{ mb: 3 }}>
            {/* Progress Indicator — only show with 3+ steps */}
            {steps.length > 2 && <Box role="group" aria-label="Customization progress" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', mb: 1 }}>
                {steps.map((step, idx) => {
                    const isComplete = step.categories.every(cat => (selections[cat.id] || []).length > 0) && idx < currentStep;
                    const isCurrent = idx === currentStep;
                    const stepLabel = step.isGrouped
                        ? step.categories.map(c => c.name).join(' & ')
                        : step.categories[0].name;
                    return (
                        <React.Fragment key={idx}>
                            {idx > 0 && (
                                <Box sx={{ flex: 1, height: 2, mt: '11px',
                                    bgcolor: isComplete || isCurrent ? 'black' : 'grey.300' }} />
                            )}
                            <Box
                                role={isComplete ? 'button' : undefined}
                                tabIndex={isComplete ? 0 : undefined}
                                aria-label={isComplete ? `Edit step: ${stepLabel}` : undefined}
                                onClick={() => isComplete && handleEditStep(idx)}
                                onKeyDown={isComplete ? (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleEditStep(idx);
                                    }
                                } : undefined}
                                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    cursor: isComplete ? 'pointer' : 'default',
                                    flex: `0 0 ${100 / steps.length}%`, maxWidth: 120 }}
                            >
                                <Box sx={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    bgcolor: isComplete || isCurrent ? 'black' : 'transparent',
                                    border: '2px solid', borderColor: isComplete || isCurrent ? 'black' : 'grey.400',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    mb: 0.5,
                                }}>
                                    {isComplete && <CheckIcon sx={{ color: 'white', fontSize: 14 }} />}
                                    {isCurrent && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />}
                                </Box>
                                <Typography sx={{
                                    fontSize: '1.6rem', fontWeight: isComplete || isCurrent ? 600 : 400,
                                    color: isComplete || isCurrent ? 'text.primary' : 'text.secondary',
                                    textAlign: 'center', lineHeight: 1.2,
                                }}>
                                    {stepLabel}
                                </Typography>
                            </Box>
                        </React.Fragment>
                    );
                })}
            </Box>}

            {/* Total selections counter — only show on steps with linked categories */}
            {modifierData.totalModifierSelections && steps[currentStep]?.categories.some(cat => isCategoryLinked(cat.id)) && (
                <Typography sx={{ textAlign: 'center', fontSize: '1.6rem', color: 'text.secondary', mb: 1 }}>
                    {getTotalSelectionCount()} / {modifierData.totalModifierSelections} selections
                </Typography>
            )}

            {steps.map((step, stepIndex) => {
                if (stepIndex !== currentStep) return null;
                const isFirstStep = stepIndex === 0;

                return (
                    <Box key={stepIndex}>
                        {/* Title + description above first step */}
                        {isFirstStep && title && (
                            <Typography sx={{ fontSize: '2rem', fontWeight: 700, mb: 1, textAlign: 'center' }}>
                                {title}
                            </Typography>
                        )}
                        {isFirstStep && description && (
                            <Typography sx={{ fontSize: '1.6rem', color: 'grey.600', lineHeight: 1.6, mb: 2, textAlign: 'center' }}>
                                {description}
                            </Typography>
                        )}
                        {step.categories.map((category) => renderCategoryGrid(category, 3))}
                    </Box>
                );
            })}
        </Box>
    );
});

ModifierSelector.displayName = 'ModifierSelector';

export default ModifierSelector;
