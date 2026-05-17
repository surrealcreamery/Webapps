import React, { useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Divider, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { trackCrossSellShown } from '@/services/analytics';

export const CrossSellModal = ({ open, onClose, products = [], onAdd, triggerProduct }) => {
    const triggerImage = triggerProduct?.imageUrl || triggerProduct?.images?.[0]?.url || triggerProduct?.image;
    const trackedRef = useRef(null);

    // Fire cross_sell_shown when modal opens with products
    useEffect(() => {
        if (open && products.length > 0 && trackedRef.current !== triggerProduct?.id) {
            trackedRef.current = triggerProduct?.id;
            trackCrossSellShown(products.map(p => p.id), triggerProduct?.id || triggerProduct?.sku);
        }
        if (!open) trackedRef.current = null;
    }, [open, products, triggerProduct]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: { borderRadius: 3, m: 2 } }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, pr: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleOutlineIcon sx={{ color: 'success.main' }} />
                    <Typography variant="h6" component="span" sx={{ fontWeight: 600, fontSize: '1.8rem' }}>
                        Added to Cart
                    </Typography>
                </Box>
                <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ px: 3 }}>
                {/* Trigger product */}
                {triggerProduct && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
                        {triggerImage && (
                            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
                                <img src={triggerImage} alt={triggerProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </Box>
                        )}
                        <Typography variant="body1" sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>
                            {triggerProduct.name}
                        </Typography>
                    </Box>
                )}

                {/* Divider with label */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Divider sx={{ flex: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            You Might Also Like
                        </Typography>
                    </Box>
                    <Divider sx={{ flex: 1 }} />
                </Box>

                {/* Cross-sell product list */}
                {products.map((product, idx) => {
                    const firstVariant = product.variants?.[0];
                    const originalPrice = parseFloat(firstVariant?.price || product.price || 0);
                    const discount = product.crossSellDiscount;
                    const discountedPrice = discount
                        ? (discount.valueType === 'PERCENTAGE' ? originalPrice * (1 - discount.value / 100) : originalPrice - discount.value / 100)
                        : null;
                    const displayPrice = discountedPrice != null ? Math.max(0, discountedPrice) : originalPrice;
                    const image = product.imageUrl || product.images?.[0]?.url || product.image;
                    const hasModifiers = product.modifierIds?.length > 0 || product.isMYO;

                    return (
                        <React.Fragment key={product.id}>
                            {idx > 0 && <Divider sx={{ my: 1 }} />}
                            <Box sx={{ py: 1 }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Box sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                                        {image ? (
                                            <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.200' }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>No image</Typography>
                                            </Box>
                                        )}
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.5rem' }}>
                                            {product.name}
                                        </Typography>
                                        {originalPrice > 0 && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                                                {discountedPrice != null ? (
                                                    <>
                                                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                                            ${originalPrice.toFixed(2)}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                                                            ${displayPrice.toFixed(2)}
                                                        </Typography>
                                                    </>
                                                ) : (
                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                        ${originalPrice.toFixed(2)}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => onAdd(product, idx)}
                                        aria-label={`Add ${product.name} to cart`}
                                        sx={{ minWidth: 60, textTransform: 'none', fontWeight: 600 }}
                                    >
                                        {hasModifiers ? 'Select' : 'Add'}
                                    </Button>
                                </Box>
                            </Box>
                        </React.Fragment>
                    );
                })}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button
                    variant="outlined"
                    fullWidth
                    onClick={onClose}
                    sx={{ textTransform: 'none', fontWeight: 500, py: 1.2 }}
                >
                    Continue Shopping
                </Button>
            </DialogActions>
        </Dialog>
    );
};
