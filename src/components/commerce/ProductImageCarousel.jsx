import React, { useState, useCallback } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=Product';

/**
 * ProductImageCarousel - Image carousel with thumbnail navigation
 * ADA Compliant: Keyboard navigation, ARIA labels, focus management
 * 
 * Supports configurable alt text per image:
 * - images: ['url1', 'url2'] - Uses fallback alt text
 * - images: [{ url: 'url1', alt: 'Description 1' }, ...] - Uses provided alt
 * 
 * @param {Array} images - Array of image URLs or objects with { url, alt }
 * @param {string} fallbackImage - Fallback if no images provided
 * @param {string} productName - Product name for fallback alt text
 * @param {string} primaryAlt - Alt text for single image (imageAlt field)
 * @param {number} maxVisibleThumbnails - Max thumbnails before showing "View more" (default: 5)
 */
export const ProductImageCarousel = ({ 
    images = [], 
    fallbackImage,
    productName = 'Product',
    primaryAlt,
    maxVisibleThumbnails = 5
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [showAllThumbnails, setShowAllThumbnails] = useState(false);

    // Normalize images array - handle both string URLs and objects
    // Priority for alt text: image.alt > primaryAlt > auto-generated
    const normalizedImages = images.length > 0 
        ? images.map((img, i) => {
            const isObject = typeof img === 'object' && img !== null;
            const url = isObject ? img.url : img;
            
            // Use provided alt, or primaryAlt for first image, or generate one
            let alt;
            if (isObject && img.alt) {
                alt = img.alt;
            } else if (i === 0 && primaryAlt) {
                alt = primaryAlt;
            } else {
                alt = `${productName} - Image ${i + 1} of ${images.length}`;
            }
            
            return { url, alt };
        })
        : [{ 
            url: fallbackImage || PLACEHOLDER_IMAGE, 
            alt: primaryAlt || productName 
        }];

    const handlePrevious = useCallback(() => {
        setActiveIndex((prev) => {
            const newIndex = prev === 0 ? normalizedImages.length - 1 : prev - 1;
            setAnnouncement(`Showing image ${newIndex + 1} of ${normalizedImages.length}`);
            return newIndex;
        });
    }, [normalizedImages.length]);

    const handleNext = useCallback(() => {
        setActiveIndex((prev) => {
            const newIndex = prev === normalizedImages.length - 1 ? 0 : prev + 1;
            setAnnouncement(`Showing image ${newIndex + 1} of ${normalizedImages.length}`);
            // Auto-expand when clicking next beyond visible thumbnails
            if (!showAllThumbnails && newIndex >= maxVisibleThumbnails) {
                setShowAllThumbnails(true);
            }
            return newIndex;
        });
    }, [normalizedImages.length, showAllThumbnails, maxVisibleThumbnails]);

    const handleThumbnailClick = (index) => {
        setActiveIndex(index);
        setAnnouncement(`Showing image ${index + 1} of ${normalizedImages.length}`);
    };

    // Keyboard navigation
    const handleKeyDown = useCallback((event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            handlePrevious();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            handleNext();
        }
    }, [handlePrevious, handleNext]);

    const showNavigation = normalizedImages.length > 1;
    
    // Calculate visible thumbnails and remaining count
    const hasMoreThumbnails = normalizedImages.length > maxVisibleThumbnails;
    const visibleThumbnails = showAllThumbnails 
        ? normalizedImages 
        : normalizedImages.slice(0, maxVisibleThumbnails);
    const remainingCount = normalizedImages.length - maxVisibleThumbnails;

    return (
        <Box 
            sx={{ width: '100%' }}
            role="region"
            aria-label={`${productName} image gallery`}
            aria-roledescription="carousel"
        >
            {/* Screen reader announcements */}
            <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0
                }}
            >
                {announcement}
            </Box>

            {/* Main Image Container */}
            <Box 
                sx={{ 
                    position: 'relative',
                    width: '100%',
                    backgroundColor: 'grey.100'
                }}
                onKeyDown={showNavigation ? handleKeyDown : undefined}
                tabIndex={showNavigation ? 0 : -1}
                role="group"
                aria-roledescription="slide"
                aria-label={`${activeIndex + 1} of ${normalizedImages.length}`}
            >
                {/* Main Image */}
                <img
                    src={normalizedImages[activeIndex].url}
                    alt={normalizedImages[activeIndex].alt}
                    style={{ 
                        width: '100%', 
                        height: 'auto', 
                        display: 'block',
                        aspectRatio: '1/1',
                        objectFit: 'cover'
                    }}
                />

                {/* Navigation Arrows */}
                {showNavigation && (
                    <>
                        {/* Previous Arrow */}
                        <IconButton
                            onClick={handlePrevious}
                            aria-label={`Previous image (${activeIndex === 0 ? normalizedImages.length : activeIndex} of ${normalizedImages.length})`}
                            sx={{
                                position: 'absolute',
                                left: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                boxShadow: 1,
                                '&:hover': {
                                    backgroundColor: 'white',
                                },
                                '&:focus': {
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: 2
                                }
                            }}
                        >
                            <ChevronLeftIcon />
                        </IconButton>

                        {/* Next Arrow */}
                        <IconButton
                            onClick={handleNext}
                            aria-label={`Next image (${activeIndex === normalizedImages.length - 1 ? 1 : activeIndex + 2} of ${normalizedImages.length})`}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                boxShadow: 1,
                                '&:hover': {
                                    backgroundColor: 'white',
                                },
                                '&:focus': {
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: 2
                                }
                            }}
                        >
                            <ChevronRightIcon />
                        </IconButton>
                    </>
                )}
            </Box>

            {/* Thumbnail Strip */}
            {showNavigation && (
                <Box 
                    sx={{ 
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        p: 1,
                        backgroundColor: 'grey.50',
                    }}
                    role="tablist"
                    aria-label="Product image thumbnails"
                >
                    {visibleThumbnails.map((image, index) => (
                        <Box
                            key={index}
                            onClick={() => handleThumbnailClick(index)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleThumbnailClick(index);
                                }
                            }}
                            role="tab"
                            tabIndex={0}
                            aria-selected={index === activeIndex}
                            aria-label={`View image ${index + 1} of ${normalizedImages.length}`}
                            sx={{
                                flexShrink: 0,
                                width: 60,
                                height: 60,
                                borderRadius: 1,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: index === activeIndex ? '3px solid black' : '3px solid transparent',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: index === activeIndex ? 'black' : 'grey.400'
                                },
                                '&:focus': {
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: 2
                                }
                            }}
                        >
                            <img
                                src={image.url}
                                alt="" // Decorative, main alt is on the tab
                                aria-hidden="true"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        </Box>
                    ))}
                    
                    {/* View More Button */}
                    {hasMoreThumbnails && !showAllThumbnails && (
                        <Box
                            onClick={() => setShowAllThumbnails(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setShowAllThumbnails(true);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`View ${remainingCount} more images`}
                            sx={{
                                flexShrink: 0,
                                width: 60,
                                height: 60,
                                borderRadius: 1,
                                backgroundColor: 'grey.200',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: '3px solid transparent',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    backgroundColor: 'grey.300',
                                    borderColor: 'grey.400'
                                },
                                '&:focus': {
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: 2
                                }
                            }}
                        >
                            <Typography 
                                sx={{ 
                                    fontWeight: 600, 
                                    fontSize: '1.6rem',
                                    lineHeight: 1,
                                }}
                            >
                                +{remainingCount}
                            </Typography>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};
